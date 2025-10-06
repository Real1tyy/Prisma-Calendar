import { DateTime } from "luxon";
import type { Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import type { ISO } from "../types/index";
import { ChangeNotifier } from "../utils/change-notifier";
import type { Indexer, IndexerEvent, RawEventSource } from "./indexer";
import type { ParsedEvent, Parser } from "./parser";
import type { RecurringEventManager } from "./recurring-event-manager";
import type { CalendarSettingsStore } from "./settings-store";

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

export class EventStore extends ChangeNotifier {
	private cache = new Map<string, CachedEvent>();
	private googleIdCache = new Map<string, string>(); // googleId -> filePath
	private eventsSubscription: Subscription | null = null;
	private settingsSubscription: Subscription | null = null;
	private lastGoogleIdProp: string;

	constructor(
		private indexer: Indexer,
		private parser: Parser,
		private recurringEventManager: RecurringEventManager,
		private settingsStore: CalendarSettingsStore
	) {
		super();

		this.lastGoogleIdProp = this.settingsStore.currentSettings.googleIdProp;

		// Subscribe to file change events
		this.eventsSubscription = this.indexer.events$
			.pipe(filter((event: IndexerEvent) => event.type === "file-changed" || event.type === "file-deleted"))
			.subscribe((event: IndexerEvent) => {
				this.handleIndexerEvent(event);
			});

		// Subscribe to settings changes to detect googleIdProp changes
		this.settingsSubscription = this.settingsStore.settings$.subscribe((newSettings) => {
			const newGoogleIdProp = newSettings.googleIdProp;
			if (newGoogleIdProp !== this.lastGoogleIdProp) {
				this.lastGoogleIdProp = newGoogleIdProp;
				this.rebuildGoogleIdCache();
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
		this.eventsSubscription?.unsubscribe();
		this.eventsSubscription = null;
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		super.destroy();
		this.clear();
	}

	updateEvent(filePath: string, template: ParsedEvent, mtime: number): void {
		const googleIdProp = this.settingsStore.currentSettings.googleIdProp;

		// Remove old googleId mapping if this file had a different googleId
		const oldCached = this.cache.get(filePath);
		const oldGoogleId = oldCached?.template.meta?.[googleIdProp];
		if (oldGoogleId && typeof oldGoogleId === "string") {
			this.googleIdCache.delete(oldGoogleId);
		}

		// Update main cache
		this.cache.set(filePath, { template, mtime });

		// Update googleId cache if event has googleId
		const googleId = template.meta?.[googleIdProp];
		if (googleId && typeof googleId === "string") {
			this.googleIdCache.set(googleId, filePath);
		}

		this.notifyChange();
	}

	invalidate(filePath: string): void {
		const cached = this.cache.get(filePath);

		const googleIdProp = this.settingsStore.currentSettings.googleIdProp;

		// Remove from googleId cache if it exists
		const googleId = cached?.template.meta?.[googleIdProp];
		if (googleId && typeof googleId === "string") {
			this.googleIdCache.delete(googleId);
		}

		// Remove from main cache
		if (this.cache.delete(filePath)) {
			this.notifyChange();
		}
	}

	isUpToDate(filePath: string, mtime: number): boolean {
		const cached = this.cache.get(filePath);
		return cached ? cached.mtime === mtime : false;
	}

	async getEvents(query: EventQuery): Promise<ParsedEvent[]> {
		const results: ParsedEvent[] = [];
		const queryStart = DateTime.fromISO(query.start);
		const queryEnd = DateTime.fromISO(query.end);

		for (const cached of this.cache.values()) {
			const { template: event } = cached;
			if (this.eventIntersectsRange(event, queryStart, queryEnd)) {
				results.push(event);
			}
		}
		const virtualEvents = await this.recurringEventManager.generateAllVirtualInstances(queryStart, queryEnd);
		results.push(...virtualEvents);

		return results.sort((a, b) => a.start.localeCompare(b.start));
	}

	async getSkippedEvents(query: EventQuery): Promise<ParsedEvent[]> {
		const allEvents = await this.getEvents(query);
		return allEvents.filter((event) => event.skipped && !event.isVirtual);
	}

	async getNonSkippedEvents(query: EventQuery): Promise<ParsedEvent[]> {
		const allEvents = await this.getEvents(query);
		return allEvents.filter((event) => !event.skipped);
	}

	findEventByGoogleId(googleId: string): ParsedEvent | null {
		const filePath = this.googleIdCache.get(googleId);
		if (!filePath) {
			return null;
		}

		const cached = this.cache.get(filePath);
		return cached?.template || null;
	}

	clear(): void {
		this.cache.clear();
		this.googleIdCache.clear();
		this.notifyChange();
	}

	rebuildGoogleIdCache(): void {
		this.googleIdCache.clear();

		const googleIdProp = this.settingsStore.currentSettings.googleIdProp;

		for (const [filePath, cached] of this.cache.entries()) {
			const googleId = cached.template.meta?.[googleIdProp];
			if (googleId && typeof googleId === "string") {
				this.googleIdCache.set(googleId, filePath);
			}
		}

		console.log(`[EventStore] Rebuilt Google ID cache with ${this.googleIdCache.size} entries`);
	}

	private eventIntersectsRange(event: ParsedEvent, rangeStart: DateTime, rangeEnd: DateTime): boolean {
		const eventStart = DateTime.fromISO(event.start);
		const eventEnd = event.end ? DateTime.fromISO(event.end) : eventStart.endOf("day");

		return eventStart < rangeEnd && eventEnd > rangeStart;
	}
}
