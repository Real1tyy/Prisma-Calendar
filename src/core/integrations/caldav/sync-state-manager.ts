import type { BehaviorSubject, Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import type { SingleCalendarConfig } from "../../../types/settings";
import type { Indexer, IndexerEvent } from "../../indexer";
import { type CalDAVSyncMetadata, CalDAVSyncMetadataSchema } from "./types";

/**
 * Represents a CalDAV-synced event tracked in the local vault
 */
export interface TrackedCalDAVEvent {
	filePath: string;
	metadata: CalDAVSyncMetadata;
}

/**
 * CalDAVSyncStateManager reactively builds an in-memory sync state from frontmatter
 * by listening to indexer events. This avoids storing sync state in data.json
 * and keeps state synchronized with the vault automatically.
 */
export class CalDAVSyncStateManager {
	private indexerSubscription: Subscription | null = null;
	private indexingCompleteSubscription: Subscription | null = null;
	private settingsSubscription: Subscription | null = null;
	private caldavProp: string;

	/**
	 * Maps: accountId -> calendarHref -> uid -> TrackedCalDAVEvent
	 * This structure allows efficient lookups during sync
	 */
	private syncState: Map<string, Map<string, Map<string, TrackedCalDAVEvent>>> = new Map();

	constructor(
		private indexer: Indexer,
		settings$: BehaviorSubject<SingleCalendarConfig>
	) {
		// Get initial caldavProp from settings
		this.caldavProp = settings$.value.caldavProp;

		// Subscribe to settings changes to update caldavProp
		this.settingsSubscription = settings$.subscribe((settings) => {
			this.caldavProp = settings.caldavProp;
		});

		// Subscribe to indexer events immediately (reactive pattern like event-store)
		this.indexerSubscription = this.indexer.events$
			.pipe(filter((event: IndexerEvent) => event.type === "file-changed" || event.type === "file-deleted"))
			.subscribe((event: IndexerEvent) => {
				this.handleIndexerEvent(event);
			});

		// Track when initial indexing completes (for cleanup)
		this.indexingCompleteSubscription = this.indexer.indexingComplete$.subscribe(() => {
			// State is tracked reactively via indexer events
		});
	}

	destroy(): void {
		this.indexerSubscription?.unsubscribe();
		this.indexerSubscription = null;
		this.indexingCompleteSubscription?.unsubscribe();
		this.indexingCompleteSubscription = null;
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.syncState.clear();
	}

	/**
	 * Finds a tracked event by UID for a specific account and calendar
	 */
	findByUid(accountId: string, calendarHref: string, uid: string): TrackedCalDAVEvent | null {
		const accountState = this.syncState.get(accountId);
		if (!accountState) return null;

		const calendarState = accountState.get(calendarHref);
		if (!calendarState) return null;

		return calendarState.get(uid) || null;
	}

	/**
	 * Gets all tracked events for a specific account and calendar
	 */
	getAllForCalendar(accountId: string, calendarHref: string): TrackedCalDAVEvent[] {
		const accountState = this.syncState.get(accountId);
		if (!accountState) return [];

		const calendarState = accountState.get(calendarHref);
		if (!calendarState) return [];

		return Array.from(calendarState.values());
	}

	getAllForAccount(accountId: string): TrackedCalDAVEvent[] {
		const accountState = this.syncState.get(accountId);
		if (!accountState) return [];

		const events: TrackedCalDAVEvent[] = [];
		for (const calendarState of accountState.values()) {
			events.push(...Array.from(calendarState.values()));
		}
		return events;
	}

	/**
	 * Tracks a new or updated CalDAV event
	 */
	track(filePath: string, metadata: CalDAVSyncMetadata): void {
		let accountState = this.syncState.get(metadata.accountId);
		if (!accountState) {
			accountState = new Map();
			this.syncState.set(metadata.accountId, accountState);
		}

		let calendarState = accountState.get(metadata.calendarHref);
		if (!calendarState) {
			calendarState = new Map();
			accountState.set(metadata.calendarHref, calendarState);
		}

		calendarState.set(metadata.uid, { filePath, metadata });
	}

	/**
	 * Removes a tracked event by file path
	 * @returns true if the file was tracked and removed, false otherwise
	 */
	private untrackByPath(filePath: string): boolean {
		for (const accountState of this.syncState.values()) {
			for (const calendarState of accountState.values()) {
				for (const [uid, tracked] of calendarState.entries()) {
					if (tracked.filePath === filePath) {
						calendarState.delete(uid);
						return true;
					}
				}
			}
		}
		return false;
	}

	private handleIndexerEvent(event: IndexerEvent): void {
		switch (event.type) {
			case "file-changed":
				if (event.source) {
					this.processFileChange(event.filePath, event.source.frontmatter);
				}
				break;
			case "file-deleted":
				this.processFileDeletion(event.filePath);
				break;
		}
	}

	private processFileChange(filePath: string, frontmatter: Record<string, unknown>): void {
		// Look for CalDAV metadata in the configured caldavProp
		const caldavData = frontmatter[this.caldavProp] as Record<string, unknown> | undefined;

		if (caldavData && typeof caldavData === "object") {
			const metadata = this.parseCaldavMetadata(caldavData);
			if (metadata) {
				this.track(filePath, metadata);
				return;
			}
		}

		// If we reach here, no valid CalDAV metadata was found
		// Remove from tracking if it was previously tracked
		this.untrackByPath(filePath);
	}

	private processFileDeletion(filePath: string): void {
		this.untrackByPath(filePath);
	}

	private parseCaldavMetadata(caldav: Record<string, unknown>): CalDAVSyncMetadata | null {
		const result = CalDAVSyncMetadataSchema.safeParse(caldav);
		return result.success ? result.data : null;
	}
}
