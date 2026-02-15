import { mergeSorted } from "@real1ty-obsidian-plugins";
import { DateTime } from "luxon";
import type { Subscription } from "rxjs";
import BTree from "sorted-btree";
import type { AllDayEvent, CalendarEvent, TimedEvent } from "../../types/calendar";
import { isTimedEvent } from "../../types/calendar";
import type { ISO } from "../../types/index";
import { IndexedCacheStore } from "./indexed-cache-store";
import type { Indexer, IndexerEvent, RawEventSource } from "../indexer";
import type { Parser } from "../parser";
import type { RecurringEventManager } from "../recurring-event-manager";
import type { HolidayStore } from "../holidays";

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
	// Navigation BTrees — non-skipped timed events only (for fill-from-previous/next)
	private eventsByStartTime = new BTree<string, TimedEvent>();
	// Query BTrees — non-skipped events for range queries
	private timedByEndTime = new BTree<string, TimedEvent>();
	private allDayByDate = new BTree<string, AllDayEvent>();
	// Query BTrees — skipped events (separate so callers get exactly what they need)
	private skippedTimedByEndTime = new BTree<string, TimedEvent>();
	private skippedAllDayByDate = new BTree<string, AllDayEvent>();
	private holidayStore: HolidayStore | null = null;

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

	setHolidayStore(holidayStore: HolidayStore): void {
		this.holidayStore = holidayStore;
	}

	/**
	 * Triggers a refresh notification without modifying the cache.
	 * Used when virtual events (like holidays) need to be refreshed.
	 */
	refreshVirtualEvents(): void {
		this.notifyChange();
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
		this.clearAllTrees();
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
		this.clearAllTrees();
	}

	updateEvent(filePath: string, template: CalendarEvent, mtime: number): void {
		this.upsert(filePath, template, mtime);
	}

	/**
	 * Returns non-skipped events in the given range: physical + virtual + holidays.
	 */
	async getEvents(query: EventQuery): Promise<CalendarEvent[]> {
		const physical = this.queryNonSkippedPhysical(query);
		const queryStart = DateTime.fromISO(query.start, { zone: "utc" });
		const queryEnd = DateTime.fromISO(query.end, { zone: "utc" });
		const virtualEvents = this.recurringEventManager.generateAllVirtualInstances(queryStart, queryEnd);

		let holidays: CalendarEvent[] = [];
		if (this.holidayStore) {
			holidays = await this.holidayStore.getHolidaysForRange(queryStart, queryEnd);
		}

		// Physical events are pre-sorted. Sort only the supplementary arrays
		// (typically small) and merge, avoiding a full O(N log N) re-sort.
		const supplementary = [...virtualEvents, ...holidays];
		if (supplementary.length === 0) return physical;

		supplementary.sort(EventStore.compareByStart);
		return mergeSorted(physical, supplementary, EventStore.compareByStart);
	}

	private static compareByStart(a: CalendarEvent, b: CalendarEvent): number {
		return a.start.localeCompare(b.start);
	}

	/**
	 * Returns only skipped physical events in the given range.
	 * Uses dedicated skipped BTrees — O(log n + k), no filtering needed.
	 */
	getSkippedEvents(query: EventQuery): CalendarEvent[] {
		return this.querySkippedPhysical(query);
	}

	/**
	 * Returns ALL physical events (both skipped and non-skipped) in the given range.
	 * Used by callers that need the full set (e.g., global search with filter toggles).
	 */
	getPhysicalEvents(query: EventQuery): CalendarEvent[] {
		const nonSkipped = this.queryNonSkippedPhysical(query);
		const skipped = this.querySkippedPhysical(query);
		return mergeSorted(nonSkipped, skipped, EventStore.compareByStart);
	}

	private queryNonSkippedPhysical(query: EventQuery): CalendarEvent[] {
		return this.queryPhysicalFromTrees(query, this.timedByEndTime, this.allDayByDate);
	}

	private querySkippedPhysical(query: EventQuery): CalendarEvent[] {
		return this.queryPhysicalFromTrees(query, this.skippedTimedByEndTime, this.skippedAllDayByDate);
	}

	/**
	 * Queries physical events from the given BTree pair using range scans.
	 * Timed: events whose [start, end) intersects [queryStart, queryEnd).
	 * All-day: events whose start falls within [queryStart, queryEnd).
	 */
	private queryPhysicalFromTrees(
		query: EventQuery,
		timedTree: BTree<string, TimedEvent>,
		allDayTree: BTree<string, AllDayEvent>
	): CalendarEvent[] {
		let queryStartNorm: string;
		let queryEndNorm: string;
		try {
			queryStartNorm = this.normIso(query.start);
			queryEndNorm = this.normIso(query.end);
		} catch {
			return [];
		}

		const timedResults: CalendarEvent[] = [];
		const timedLowKey = `${queryStartNorm}${EventStore.SEP}`;
		timedTree.forRange(timedLowKey, `${EventStore.MAX}`, true, (_key, event) => {
			if (this.normIso(event.start) < queryEndNorm) {
				timedResults.push(event);
			}
		});

		const allDayResults: CalendarEvent[] = [];
		const allDayLowKey = `${queryStartNorm}${EventStore.SEP}`;
		const allDayHighKey = `${queryEndNorm}${EventStore.SEP}`;
		allDayTree.forRange(allDayLowKey, allDayHighKey, false, (_key, event) => {
			allDayResults.push(event);
		});

		timedResults.sort(EventStore.compareByStart);
		return mergeSorted(timedResults, allDayResults, EventStore.compareByStart);
	}

	getAllEvents(): CalendarEvent[] {
		return this.getAll().sort(EventStore.compareByStart);
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
			this.timedByEndTime,
			(tree, key) => tree.nextLowerPair(key),
			(t) => `${t}${EventStore.SEP}${EventStore.MAX}`
		);
	}

	/**
	 * Normalizes an ISO string to a consistent UTC format for BTree key comparison.
	 * Both keys and query bounds pass through this, ensuring consistent comparison.
	 */
	private normIso(iso: string): string {
		return new Date(iso).toISOString();
	}

	private makeTreeKey(time: string, filePath: string): string {
		return `${time}${EventStore.SEP}${filePath}`;
	}

	private addToSortedSets(event: CalendarEvent): void {
		if (isTimedEvent(event)) {
			const endKey = this.makeTreeKey(this.normIso(event.end), event.ref.filePath);
			if (event.skipped) {
				this.skippedTimedByEndTime.set(endKey, event);
			} else {
				this.timedByEndTime.set(endKey, event);
				// Navigation index — non-skipped only
				const startKey = this.makeTreeKey(this.normIso(event.start), event.ref.filePath);
				this.eventsByStartTime.set(startKey, event);
			}
		} else {
			const dateKey = this.makeTreeKey(this.normIso(event.start), event.ref.filePath);
			if (event.skipped) {
				this.skippedAllDayByDate.set(dateKey, event);
			} else {
				this.allDayByDate.set(dateKey, event);
			}
		}
	}

	private removeFromSortedSets(event: CalendarEvent): void {
		if (isTimedEvent(event)) {
			const endKey = this.makeTreeKey(this.normIso(event.end), event.ref.filePath);
			if (event.skipped) {
				this.skippedTimedByEndTime.delete(endKey);
			} else {
				this.timedByEndTime.delete(endKey);
				const startKey = this.makeTreeKey(this.normIso(event.start), event.ref.filePath);
				this.eventsByStartTime.delete(startKey);
			}
		} else {
			const dateKey = this.makeTreeKey(this.normIso(event.start), event.ref.filePath);
			if (event.skipped) {
				this.skippedAllDayByDate.delete(dateKey);
			} else {
				this.allDayByDate.delete(dateKey);
			}
		}
	}

	private clearAllTrees(): void {
		this.eventsByStartTime.clear();
		this.timedByEndTime.clear();
		this.allDayByDate.clear();
		this.skippedTimedByEndTime.clear();
		this.skippedAllDayByDate.clear();
	}

	private findAdjacentEventInTree(
		currentTimeISO: string,
		excludeFilePath: string | undefined,
		tree: BTree<string, TimedEvent>,
		getNextPair: (tree: BTree<string, TimedEvent>, key: string) => [string, TimedEvent] | undefined,
		makeSearchKey: (currentTime: string) => string
	): TimedEvent | null {
		const currentTime = this.normIso(currentTimeISO);
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
