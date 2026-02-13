import { DateTime } from "luxon";
import type { Subscription } from "rxjs";
import BTree from "sorted-btree";
import type { CalendarEvent, TimedEvent } from "../types/calendar";
import { isTimedEvent } from "../types/calendar";
import type { ISO } from "../types/index";
import { IndexedCacheStore } from "./indexed-cache-store";
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

export class EventStore extends IndexedCacheStore<CalendarEvent> {
	private static readonly SEP = "\0";
	private static readonly MAX = "\uffff";

	private indexingCompleteSubscription: Subscription | null = null;
	private eventsByStartTime = new BTree<string, TimedEvent>();
	private eventsByEndTime = new BTree<string, TimedEvent>();

	constructor(
		indexer: Indexer,
		private parser: Parser,
		private recurringEventManager: RecurringEventManager
	) {
		super(indexer, new Set(["file-changed", "untracked-file-changed", "file-deleted"]));

		this.indexingCompleteSubscription = this.indexer.indexingComplete$.subscribe((isComplete) => {
			if (isComplete) {
				this.flushPendingRefresh();
			} else {
				// Indexing restarted (e.g., filter expressions changed or directory changed).
				// Clear the cache so events are re-parsed with updated settings.
				// Without this, isUpToDate() would skip files whose mtime hasn't changed.
				this.clearWithoutNotify();
			}
		});
	}

	protected buildTemplate(source: RawEventSource): CalendarEvent | null {
		return this.parser.parseEventSource(source);
	}

	protected override handleIndexerEvent(event: IndexerEvent): void {
		switch (event.type) {
			case "file-changed":
				if (event.source) {
					this.processFileChange(event.source);
				}
				break;
			case "untracked-file-changed":
				this.invalidate(event.filePath);
				break;
			case "file-deleted":
				this.invalidate(event.filePath);
				break;
		}
	}

	protected override onAfterUpsert(event: CalendarEvent): void {
		this.addToSortedSets(event);
	}

	protected override onBeforeRemove(event: CalendarEvent): void {
		this.removeFromSortedSets(event);
	}

	override clear(): void {
		super.clear();
		this.eventsByStartTime.clear();
		this.eventsByEndTime.clear();
	}

	override destroy(): void {
		this.indexingCompleteSubscription?.unsubscribe();
		this.indexingCompleteSubscription = null;
		super.destroy();
	}

	/**
	 * Clears the cache without notifying subscribers.
	 * Used during resync to avoid triggering a refresh before new data is loaded.
	 */
	clearWithoutNotify(): void {
		for (const cached of this.cache.values()) {
			this.onBeforeRemove(cached.template);
		}
		this.cache.clear();
		this.eventsByStartTime.clear();
		this.eventsByEndTime.clear();
	}

	updateEvent(filePath: string, template: CalendarEvent, mtime: number): void {
		this.upsert(filePath, template, mtime);
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
		return this.getAll().sort((a, b) => a.start.localeCompare(b.start));
	}

	getEventByPath(filePath: string): CalendarEvent | null {
		return this.getByPath(filePath);
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
}
