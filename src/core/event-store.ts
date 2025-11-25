import { DebouncedNotifier } from "@real1ty-obsidian-plugins/utils";
import { DateTime } from "luxon";
import type { Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import type { ISO } from "../types/index";
import type { Indexer, IndexerEvent, RawEventSource } from "./indexer";
import type { ParsedEvent, Parser } from "./parser";
import type { RecurringEventManager } from "./recurring-event-manager";

export interface EventQuery {
	start: ISO;
	end: ISO;
}

export interface VaultEventId {
	filePath: string;
}

export interface CachedEvent {
	template: ParsedEvent;
	mtime: number;
}

export class EventStore extends DebouncedNotifier {
	private cache = new Map<string, CachedEvent>();
	private subscription: Subscription | null = null;
	private indexingCompleteSubscription: Subscription | null = null;

	constructor(
		private indexer: Indexer,
		private parser: Parser,
		private recurringEventManager: RecurringEventManager
	) {
		super();
		this.subscription = this.indexer.events$
			.pipe(filter((event: IndexerEvent) => event.type === "file-changed" || event.type === "file-deleted"))
			.subscribe((event: IndexerEvent) => {
				this.handleIndexerEvent(event);
			});

		// Subscribe to indexing complete to flush any pending refreshes
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

	updateEvent(filePath: string, template: ParsedEvent, mtime: number): void {
		this.cache.set(filePath, { template, mtime });
		this.scheduleRefresh();
	}

	invalidate(filePath: string): void {
		if (this.cache.delete(filePath)) {
			this.notifyChange();
		}
	}

	isUpToDate(filePath: string, mtime: number): boolean {
		const cached = this.cache.get(filePath);
		return cached ? cached.mtime === mtime : false;
	}

	getEvents(query: EventQuery): ParsedEvent[] {
		const results: ParsedEvent[] = this.getPhysicalEvents(query);
		const queryStart = DateTime.fromISO(query.start, { zone: "utc" });
		const queryEnd = DateTime.fromISO(query.end, { zone: "utc" });
		const virtualEvents = this.recurringEventManager.generateAllVirtualInstances(queryStart, queryEnd);
		results.push(...virtualEvents);

		return results.sort((a, b) => a.start.localeCompare(b.start));
	}

	getSkippedEvents(query: EventQuery): ParsedEvent[] {
		const allEvents = this.getEvents(query);
		return allEvents.filter((event) => event.skipped && !event.isVirtual);
	}

	getNonSkippedEvents(query: EventQuery): ParsedEvent[] {
		const allEvents = this.getEvents(query);
		return allEvents.filter((event) => !event.skipped);
	}

	getPhysicalEvents(query: EventQuery): ParsedEvent[] {
		const results: ParsedEvent[] = [];
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

	getAllEvents(): ParsedEvent[] {
		const results: ParsedEvent[] = [];

		for (const cached of this.cache.values()) {
			results.push(cached.template);
		}

		return results.sort((a, b) => a.start.localeCompare(b.start));
	}

	getEventByPath(filePath: string): ParsedEvent | undefined {
		const cached = this.cache.get(filePath);
		return cached?.template;
	}

	clear(): void {
		this.cache.clear();
		// Clear is immediate - no debouncing
		this.notifyChange();
	}

	/**
	 * Clears the cache without notifying subscribers.
	 * Used during resync to avoid triggering a refresh before new data is loaded.
	 */
	clearWithoutNotify(): void {
		this.cache.clear();
	}

	private eventIntersectsRange(event: ParsedEvent, rangeStart: DateTime, rangeEnd: DateTime): boolean {
		const eventStart = DateTime.fromISO(event.start, { zone: "utc" });
		const eventEnd = event.end ? DateTime.fromISO(event.end, { zone: "utc" }) : eventStart.endOf("day");

		return eventStart < rangeEnd && eventEnd > rangeStart;
	}
}
