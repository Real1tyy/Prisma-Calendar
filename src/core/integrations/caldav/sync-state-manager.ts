import type { BehaviorSubject } from "rxjs";
import type { SingleCalendarConfig } from "../../../types/settings";
import type { Indexer } from "../../indexer";
import { BaseSyncStateManager, type TrackedSyncEvent } from "../base-sync-state-manager";
import { type CalDAVSyncMetadata, CalDAVSyncMetadataSchema } from "./types";

type TrackedCalDAVEvent = TrackedSyncEvent<CalDAVSyncMetadata>;

export class CalDAVSyncStateManager extends BaseSyncStateManager<CalDAVSyncMetadata> {
	/**
	 * Maps: accountId -> calendarHref -> uid -> TrackedCalDAVEvent
	 * This structure allows efficient lookups during sync
	 */
	private syncState: Map<string, Map<string, Map<string, TrackedCalDAVEvent>>> = new Map();

	constructor(indexer: Indexer, settings$: BehaviorSubject<SingleCalendarConfig>) {
		super(indexer, settings$, (s) => s.caldavProp, CalDAVSyncMetadataSchema);
	}

	findByUid(accountId: string, calendarHref: string, uid: string): TrackedCalDAVEvent | null {
		return this.syncState.get(accountId)?.get(calendarHref)?.get(uid) || null;
	}

	getAllForCalendar(accountId: string, calendarHref: string): TrackedCalDAVEvent[] {
		const calendarState = this.syncState.get(accountId)?.get(calendarHref);
		return calendarState ? Array.from(calendarState.values()) : [];
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

	protected trackEvent(filePath: string, metadata: CalDAVSyncMetadata): void {
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

	protected untrackByPath(filePath: string): boolean {
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

	protected clearState(): void {
		this.syncState.clear();
	}
}
