import type { App } from "obsidian";
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

	/**
	 * Global uid index for cross-account/calendar dedup: uid -> TrackedCalDAVEvent
	 */
	private globalUidIndex: Map<string, TrackedCalDAVEvent> = new Map();

	constructor(app: App, indexer: Indexer, settings$: BehaviorSubject<SingleCalendarConfig>) {
		super(app, indexer, settings$, (s) => s.caldavProp, CalDAVSyncMetadataSchema);
	}

	findByUid(accountId: string, calendarHref: string, uid: string): TrackedCalDAVEvent | null {
		return this.syncState.get(accountId)?.get(calendarHref)?.get(uid) || null;
	}

	findByUidGlobal(uid: string): TrackedCalDAVEvent | null {
		return this.globalUidIndex.get(uid) || null;
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
		const tracked = { filePath, metadata };
		if (
			!this.tryTrackInGlobalIndex(
				this.globalUidIndex,
				metadata.uid,
				filePath,
				tracked,
				`CalDAV event (UID: ${metadata.uid})`
			)
		) {
			return;
		}

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

		calendarState.set(metadata.uid, tracked);
	}

	protected untrackByPath(filePath: string): boolean {
		for (const accountState of this.syncState.values()) {
			if (this.untrackByPathFromMaps(accountState, this.globalUidIndex, filePath)) {
				return true;
			}
		}
		return false;
	}

	protected clearState(): void {
		this.syncState.clear();
		this.globalUidIndex.clear();
	}
}
