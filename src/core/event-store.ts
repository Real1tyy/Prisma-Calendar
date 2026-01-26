import { DebouncedNotifier } from "@real1ty-obsidian-plugins";
import { DateTime } from "luxon";
import type { Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import BTree from "sorted-btree";
import type { CalendarEvent, TimedEvent } from "../types/calendar";
import { isTimedEvent } from "../types/calendar";
import type { ISO } from "../types/index";
import type { Indexer, IndexerEvent, RawEventSource } from "./indexer";
import type { Parser } from "./parser";
import type { RecurringEventManager } from "./recurring-event-manager";

export interface EventQuery {
	start: ISO;
	end: ISO;
}

export interface VaultEventId {
	filePath: string;
}

interface CachedCalendarEvent {
	template: CalendarEvent;
	mtime: number;
}

export class EventStore extends DebouncedNotifier {
	private static readonly SEP = "\0";
	private static readonly MAX = "\uffff";

	private cache = new Map<string, CachedCalendarEvent>();
	private subscription: Subscription | null = null;
	private indexingCompleteSubscription: Subscription | null = null;
	private eventsByStartTime = new BTree<string, TimedEvent>();
	private eventsByEndTime = new BTree<string, TimedEvent>();

	constructor(
		private indexer: Indexer,
		private parser: Parser,
		private recurringEventManager: RecurringEventManager
	) {
		super();
		this.subscription = this.indexer.events$
			.pipe(
				filter(
					(event: IndexerEvent) =>
						event.type === "file-changed" || event.type === "untracked-file-changed" || event.type === "file-deleted"
				)
			)
			.subscribe((event: IndexerEvent) => {
				this.handleIndexerEvent(event);
			});

		this.indexingCompleteSubscription = this.indexer.indexingComplete$.subscribe((isComplete) => {
			if (isComplete) {
				this.flushPendingRefresh();
			}
		});
	}

	private handleIndexerEvent(event: IndexerEvent): void {
		switch (event.type) {
			case "file-changed":
				if (event.source) {
					this.processFileChange(event.source);
				}
				break;
			case "untracked-file-changed":
				// A file transitioned from tracked -> untracked (e.g. undo/remove date props).
				// Ensure any previously cached tracked event is removed so the calendar doesn't go stale.
				this.invalidate(event.filePath);
				break;
			case "file-deleted":
				this.invalidate(event.filePath);
				break;
		}
	}

	private processFileChange(source: RawEventSource): void {
		if (this.isUpToDate(source.filePath, source.mtime)) {
			return;
		}

		const event = this.parser.parseEventSource(source);

		if (event) {
			this.updateEvent(source.filePath, event, source.mtime);
		} else {
			this.invalidate(source.filePath);
		}
	}

	destroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
		this.indexingCompleteSubscription?.unsubscribe();
		this.indexingCompleteSubscription = null;
		super.destroy();
		this.clear();
	}

	updateEvent(filePath: string, template: CalendarEvent, mtime: number): void {
		const oldCached = this.cache.get(filePath);
		if (oldCached) {
			this.removeFromSortedSets(oldCached.template);
		}

		this.cache.set(filePath, { template, mtime });
		this.addToSortedSets(template);
		this.scheduleRefresh();
	}

	invalidate(filePath: string): void {
		const cached = this.cache.get(filePath);

		if (cached && this.cache.delete(filePath)) {
			this.removeFromSortedSets(cached.template);
			this.notifyChange();
		}
	}

	private normIso(iso: string): string {
		return new Date(iso).toISOString();
	}

	private makeTreeKey(time: string, filePath: string): string {
		return `${time}${EventStore.SEP}${filePath}`;
	}

	private addToSortedSets(event: CalendarEvent): void {
		if (!isTimedEvent(event) || event.skipped) return;

		const startKey = this.makeTreeKey(this.normIso(event.start), event.ref.filePath);
		this.eventsByStartTime.set(startKey, event);

		const endKey = this.makeTreeKey(this.normIso(event.end), event.ref.filePath);
		this.eventsByEndTime.set(endKey, event);
	}

	private removeFromSortedSets(event: CalendarEvent): void {
		if (!isTimedEvent(event) || event.skipped) return;

		const startKey = this.makeTreeKey(this.normIso(event.start), event.ref.filePath);
		this.eventsByStartTime.delete(startKey);

		const endKey = this.makeTreeKey(this.normIso(event.end), event.ref.filePath);
		this.eventsByEndTime.delete(endKey);
	}

	isUpToDate(filePath: string, mtime: number): boolean {
		const cached = this.cache.get(filePath);
		return cached ? cached.mtime === mtime : false;
	}

	getEvents(query: EventQuery): CalendarEvent[] {
		const results: CalendarEvent[] = this.getPhysicalEvents(query);
		const queryStart = DateTime.fromISO(query.start, { zone: "utc" });
		const queryEnd = DateTime.fromISO(query.end, { zone: "utc" });
		const virtualEvents = this.recurringEventManager.generateAllVirtualInstances(queryStart, queryEnd);
		results.push(...virtualEvents);

		return results.sort((a, b) => a.start.localeCompare(b.start));
	}

	getSkippedEvents(query: EventQuery): CalendarEvent[] {
		const allEvents = this.getEvents(query);
		return allEvents.filter((event) => event.skipped && !event.isVirtual);
	}

	getNonSkippedEvents(query: EventQuery): CalendarEvent[] {
		const allEvents = this.getEvents(query);
		return allEvents.filter((event) => !event.skipped);
	}

	getPhysicalEvents(query: EventQuery): CalendarEvent[] {
		const results: CalendarEvent[] = [];
		const queryStart = DateTime.fromISO(query.start, { zone: "utc" });
		const queryEnd = DateTime.fromISO(query.end, { zone: "utc" });

		for (const cached of this.cache.values()) {
			const { template: event } = cached;
			if (this.eventIntersectsRange(event, queryStart, queryEnd)) {
				results.push(event);
			}
		}

		return results.sort((a, b) => a.start.localeCompare(b.start));
	}

	getAllEvents(): CalendarEvent[] {
		const results: CalendarEvent[] = [];

		for (const cached of this.cache.values()) {
			results.push(cached.template);
		}

		return results.sort((a, b) => a.start.localeCompare(b.start));
	}

	getEventByPath(filePath: string): CalendarEvent | null {
		return this.cache.get(filePath)?.template ?? null;
	}

	clear(): void {
		this.cache.clear();
		this.eventsByStartTime.clear();
		this.eventsByEndTime.clear();
		this.notifyChange();
	}

	/**
	 * Clears the cache without notifying subscribers.
	 * Used during resync to avoid triggering a refresh before new data is loaded.
	 */
	clearWithoutNotify(): void {
		this.cache.clear();
		this.eventsByStartTime.clear();
		this.eventsByEndTime.clear();
	}

	private eventIntersectsRange(event: CalendarEvent, rangeStart: DateTime, rangeEnd: DateTime): boolean {
		const eventStart = DateTime.fromISO(event.start, { zone: "utc" });
		const eventEnd = isTimedEvent(event) ? DateTime.fromISO(event.end, { zone: "utc" }) : eventStart.endOf("day");

		return eventStart < rangeEnd && eventEnd > rangeStart;
	}

	private findAdjacentEventInTree(
		currentTimeISO: string,
		excludeFilePath: string | undefined,
		tree: BTree<string, TimedEvent>,
		getNextPair: (tree: BTree<string, TimedEvent>, key: string) => [string, TimedEvent] | undefined,
		makeSearchKey: (currentTime: string) => string
	): TimedEvent | null {
		const currentTime = new Date(currentTimeISO).toISOString();
		let pair = getNextPair(tree, makeSearchKey(currentTime));

		while (pair) {
			const [key, event] = pair;
			if (!excludeFilePath || event.ref.filePath !== excludeFilePath) {
				return event;
			}
			pair = getNextPair(tree, key);
		}

		return null;
	}

	findNextEventByStartTime(currentStartISO: string, excludeFilePath?: string): CalendarEvent | null {
		return this.findAdjacentEventInTree(
			currentStartISO,
			excludeFilePath,
			this.eventsByStartTime,
			(tree, key) => tree.nextHigherPair(key),
			(t) => `${t}${EventStore.SEP}`
		);
	}

	findPreviousEventByEndTime(currentEndISO: string, excludeFilePath?: string): CalendarEvent | null {
		return this.findAdjacentEventInTree(
			currentEndISO,
			excludeFilePath,
			this.eventsByEndTime,
			(tree, key) => tree.nextLowerPair(key),
			(t) => `${t}${EventStore.SEP}${EventStore.MAX}`
		);
	}
}
