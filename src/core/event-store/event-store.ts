import { mergeSorted } from "@real1ty-obsidian-plugins";
import { DateTime } from "luxon";
import type { BehaviorSubject, Subscription } from "rxjs";
import BTree from "sorted-btree";

import { MARK_DONE_SCAN_INTERVAL_MS } from "../../constants";
import type { AllDayEvent, CalendarEvent, TimedEvent, VirtualEventData } from "../../types/calendar";
import { eventDefaults, isAnyVirtual, isTimedEvent } from "../../types/calendar";
import type { CalendarEventSource, IndexerEvent, RawEventSource } from "../../types/event-source";
import type { ISO } from "../../types/index";
import type { SingleCalendarConfig } from "../../types/settings";
import { stripZ } from "../../utils/iso";
import type { HolidayStore } from "../holidays";
import { MinimizedModalManager } from "../minimized-modal-manager";
import type { Parser } from "../parser";
import type { RecurringEventManager } from "../recurring-event-manager";
import type { VirtualEventStore } from "../virtual-event-store";
import { IndexedCacheStore } from "./indexed-cache-store";

export interface EventQuery {
	start: ISO;
	end: ISO;
}

export class EventStore extends IndexedCacheStore<CalendarEvent> {
	private static readonly SEP = "\0";
	private static readonly MAX = "\uffff";

	private indexingCompleteSubscription: Subscription | null = null;
	private settingsSubscription: Subscription | null = null;
	private settings: SingleCalendarConfig;
	private markDoneScanInterval: number | null = null;
	// Navigation BTrees — non-skipped timed events only (for fill-from-previous/next)
	private eventsByStartTime = new BTree<string, TimedEvent>();
	// Query BTrees — non-skipped events for range queries
	private timedByEndTime = new BTree<string, TimedEvent>();
	private allDayByDate = new BTree<string, AllDayEvent>();
	// Query BTrees — skipped events (separate so callers get exactly what they need)
	private skippedTimedByEndTime = new BTree<string, TimedEvent>();
	private skippedAllDayByDate = new BTree<string, AllDayEvent>();
	private holidayStore: HolidayStore | null = null;
	private virtualEventStore: VirtualEventStore | null = null;
	private virtualEventSubscription: Subscription | null = null;

	// ─── Lifecycle ────────────────────────────────────────────────

	constructor(
		eventSource: CalendarEventSource,
		private parser: Parser,
		private recurringEventManager: RecurringEventManager,
		settingsStore: BehaviorSubject<SingleCalendarConfig>
	) {
		super(eventSource, new Set(["file-changed", "untracked-file-changed", "file-deleted"]));

		this.settings = settingsStore.value;

		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
			const markDoneChanged = this.settings.markPastInstancesAsDone !== newSettings.markPastInstancesAsDone;
			this.settings = newSettings;

			if (markDoneChanged) {
				if (newSettings.markPastInstancesAsDone) {
					this.startMarkDonePeriodicScan();
				} else {
					this.stopMarkDonePeriodicScan();
				}
			}
		});

		this.indexingCompleteSubscription = this.eventSource.indexingComplete$.subscribe((isComplete) => {
			if (isComplete) {
				this.flushPendingRefresh();
				if (this.settings.markPastInstancesAsDone) {
					this.startMarkDonePeriodicScan();
				}
			} else {
				// Indexing restarted (e.g., filter expressions changed or directory changed).
				// Clear the cache so events are re-parsed with updated settings.
				this.clearWithoutNotify();
			}
		});
	}

	override destroy(): void {
		this.stopMarkDonePeriodicScan();
		this.indexingCompleteSubscription?.unsubscribe();
		this.indexingCompleteSubscription = null;
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.virtualEventSubscription?.unsubscribe();
		this.virtualEventSubscription = null;
		super.destroy();
	}

	override clear(): void {
		super.clear();
		this.clearAllTrees();
	}

	/**
	 * Clears the cache without notifying subscribers.
	 * Used during resync to avoid triggering a refresh before new data is loaded.
	 */
	clearWithoutNotify(): void {
		for (const cached of this.cache.values()) {
			this.onBeforeRemove(cached);
		}
		this.cache.clear();
		this.clearAllTrees();
	}

	// ─── Cache Hooks ──────────────────────────────────────────────

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

	// ─── Public Event API ─────────────────────────────────────────

	/**
	 * Returns non-skipped events in the given range: physical + virtual + holidays + manual virtual.
	 */
	async getEvents(query: EventQuery): Promise<CalendarEvent[]> {
		const physical = this.queryNonSkippedPhysical(query);
		const queryStart = DateTime.fromISO(stripZ(query.start));
		const queryEnd = DateTime.fromISO(stripZ(query.end));
		const virtualEvents = this.recurringEventManager.generateAllVirtualInstances(queryStart, queryEnd);

		let holidays: CalendarEvent[] = [];
		if (this.holidayStore) {
			holidays = await this.holidayStore.getHolidaysForRange(queryStart, queryEnd);
		}

		const manualVirtual = this.virtualEventStore
			? this.virtualEventStore
					.getInRange(queryStart, queryEnd)
					.map((v) => toCalendarEvent(v, this.virtualEventStore!.getFilePath()))
			: [];

		// Physical events are pre-sorted. Sort only the supplementary arrays
		// (typically small) and merge, avoiding a full O(N log N) re-sort.
		const supplementary = [...virtualEvents, ...holidays, ...manualVirtual];
		if (supplementary.length === 0) return physical;

		supplementary.sort(EventStore.compareByStart);
		return mergeSorted(physical, supplementary, EventStore.compareByStart);
	}

	/**
	 * Returns only skipped physical events in the given range.
	 * Uses dedicated skipped BTrees — O(log n + k), no filtering needed.
	 */
	getSkippedEvents(query: EventQuery): CalendarEvent[] {
		return this.querySkippedPhysical(query);
	}

	/**
	 * Returns the count of skipped physical events in the given range.
	 * Reuses the shared scan logic but only increments a counter — no array allocation or sorting.
	 */
	countSkippedEvents(query: EventQuery): number {
		let count = 0;
		this.scanPhysicalFromTrees(query, this.skippedTimedByEndTime, this.skippedAllDayByDate, () => {
			count++;
		});
		return count;
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

	getAllEvents(): CalendarEvent[] {
		return this.getAll().sort(EventStore.compareByStart);
	}

	getEventByPath(filePath: string): CalendarEvent | null {
		return this.getByPath(filePath);
	}

	updateEvent(filePath: string, template: CalendarEvent): void {
		this.upsert(filePath, template);
	}

	/**
	 * Triggers a refresh notification without modifying the cache.
	 * Used when virtual events (like holidays) need to be refreshed.
	 */
	refreshVirtualEvents(): void {
		this.notifyChange();
	}

	setHolidayStore(holidayStore: HolidayStore): void {
		this.holidayStore = holidayStore;
	}

	setVirtualEventStore(store: VirtualEventStore): void {
		this.virtualEventSubscription?.unsubscribe();
		this.virtualEventStore = store;
		this.virtualEventSubscription = store.changes$.subscribe(() => {
			this.notifyChange();
		});
	}

	// ─── Query Helpers ────────────────────────────────────────────

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
		const timedResults: CalendarEvent[] = [];
		const allDayResults: CalendarEvent[] = [];

		this.scanPhysicalFromTrees(query, timedTree, allDayTree, (event) => {
			if (isTimedEvent(event)) {
				timedResults.push(event);
			} else {
				allDayResults.push(event);
			}
		});

		timedResults.sort(EventStore.compareByStart);
		return mergeSorted(timedResults, allDayResults, EventStore.compareByStart);
	}

	/**
	 * Shared BTree range scan logic. Visits each matching event via the callback.
	 * Used by both queryPhysicalFromTrees (collects into arrays) and
	 * countSkippedEvents (increments a counter) to avoid duplicating scan logic.
	 */
	private scanPhysicalFromTrees(
		query: EventQuery,
		timedTree: BTree<string, TimedEvent>,
		allDayTree: BTree<string, AllDayEvent>,
		visitor: (event: CalendarEvent) => void
	): void {
		let queryStartNorm: string;
		let queryEndNorm: string;
		try {
			queryStartNorm = this.normIso(query.start);
			queryEndNorm = this.normIso(query.end);
		} catch {
			return;
		}

		const timedLowKey = `${queryStartNorm}${EventStore.SEP}`;
		timedTree.forRange(timedLowKey, `${EventStore.MAX}`, true, (_key, event) => {
			if (this.normIso(event.start) < queryEndNorm) {
				visitor(event);
			}
		});

		const allDayLowKey = `${queryStartNorm}${EventStore.SEP}`;
		const allDayHighKey = `${queryEndNorm}${EventStore.SEP}`;
		allDayTree.forRange(allDayLowKey, allDayHighKey, false, (_key, event) => {
			visitor(event);
		});
	}

	// ─── Navigation ───────────────────────────────────────────────

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

	// ─── Tree Management ──────────────────────────────────────────

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

	// ─── Mark Done Periodic Scan ─────────────────────────────────

	private startMarkDonePeriodicScan(): void {
		this.stopMarkDonePeriodicScan();
		this.markDoneScanInterval = window.setInterval(() => {
			this.scanPastEventsForMarkDone();
		}, MARK_DONE_SCAN_INTERVAL_MS);
	}

	private stopMarkDonePeriodicScan(): void {
		if (this.markDoneScanInterval !== null) {
			window.clearInterval(this.markDoneScanInterval);
			this.markDoneScanInterval = null;
		}
	}

	private scanPastEventsForMarkDone(): void {
		if (!this.settings.markPastInstancesAsDone) return;

		const now = DateTime.now();
		const nowIso = now.toISO({ suppressMilliseconds: true, includeOffset: false }) ?? "";
		// All-day events are past only after the end of that day (23:59:59),
		// matching the indexer's markPastEventAsDone logic
		const endOfTodayIso = now.endOf("day").toISO({ suppressMilliseconds: true, includeOffset: false }) ?? "";
		const doneValue = this.settings.doneValue;
		const minimizedFilePath = MinimizedModalManager.getState()?.filePath ?? null;

		for (const event of this.cache.values()) {
			if (isAnyVirtual(event.virtualKind)) continue;
			if (event.metadata.rruleType) continue;
			if (event.metadata.status === doneValue) continue;
			// Skip events actively being tracked by the stopwatch
			if (event.ref.filePath === minimizedFilePath) continue;

			const isPast = isTimedEvent(event) ? event.end < nowIso : event.start < endOfTodayIso;
			if (!isPast) continue;

			void this.eventSource.markFileAsDone(event.ref.filePath);
		}
	}

	// ─── Utilities ────────────────────────────────────────────────

	private static compareByStart(a: CalendarEvent, b: CalendarEvent): number {
		return a.start.localeCompare(b.start);
	}

	/**
	 * Normalizes an ISO string to a consistent format for BTree key comparison.
	 * Strips any Z suffix and ensures a fixed-length `YYYY-MM-DDTHH:MM:SS` format.
	 * Both keys and query bounds pass through this, ensuring consistent comparison.
	 */
	private normIso(iso: string): string {
		const stripped = stripZ(iso);
		if (stripped.length === 19) return stripped;
		if (stripped.length === 10) return `${stripped}T00:00:00`;
		return stripped.slice(0, 19);
	}

	private makeTreeKey(time: string, filePath: string): string {
		return `${time}${EventStore.SEP}${filePath}`;
	}
}

export function toCalendarEvent(data: VirtualEventData, virtualFilePath: string): CalendarEvent {
	const base = {
		...eventDefaults(),
		id: data.id,
		ref: { filePath: virtualFilePath },
		title: data.title,
		virtualKind: "manual" as const,
		meta: data.properties,
	};

	return data.allDay
		? {
				...base,
				type: "allDay" as const,
				start: data.start,
				allDay: true as const,
			}
		: {
				...base,
				type: "timed" as const,
				start: data.start,
				end: data.end ?? data.start,
				allDay: false as const,
			};
}
