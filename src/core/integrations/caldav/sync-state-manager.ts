import type { App } from "obsidian";
import type { BehaviorSubject } from "rxjs";

import type { CalendarEventSource } from "../../../types/event-source";
import type { SingleCalendarConfig } from "../../../types/settings";
import { BaseSyncStateManager, type TrackedSyncEvent } from "../base-sync-state-manager";
import { type CalDAVSyncMetadata, CalDAVSyncMetadataSchema } from "./types";

type TrackedCalDAVEvent = TrackedSyncEvent<CalDAVSyncMetadata>;

/**
 * Tracks every locally-synced CalDAV event under a single UID-keyed map
 * (inherited from `BaseSyncStateManager`). UID is the only field guaranteed
 * to be O(1)-lookup hot — it's consulted per-remote-event by the planner.
 * All other lookups (scoped by account + calendar, or keyed by object href
 * for tombstone resolution) fire a handful of times per sync, so a linear
 * scan over the single map is cheaper overall than maintaining parallel
 * indexes that would need to stay in sync on every track / untrack / rename.
 */
export class CalDAVSyncStateManager extends BaseSyncStateManager<CalDAVSyncMetadata> {
	constructor(app: App, eventSource: CalendarEventSource, settings$: BehaviorSubject<SingleCalendarConfig>) {
		super(app, eventSource, settings$, (s) => s.caldavProp, CalDAVSyncMetadataSchema);
	}

	findByUid(accountId: string, calendarHref: string, uid: string): TrackedCalDAVEvent | null {
		const tracked = this.byUid.get(uid);
		if (!tracked) return null;
		if (tracked.metadata.accountId !== accountId) return null;
		if (tracked.metadata.calendarHref !== calendarHref) return null;
		return tracked;
	}

	findByObjectHref(accountId: string, calendarHref: string, objectHref: string): TrackedCalDAVEvent | null {
		for (const tracked of this.byUid.values()) {
			if (
				tracked.metadata.accountId === accountId &&
				tracked.metadata.calendarHref === calendarHref &&
				tracked.metadata.objectHref === objectHref
			) {
				return tracked;
			}
		}
		return null;
	}

	getAllForCalendar(accountId: string, calendarHref: string): TrackedCalDAVEvent[] {
		const out: TrackedCalDAVEvent[] = [];
		for (const tracked of this.byUid.values()) {
			if (tracked.metadata.accountId === accountId && tracked.metadata.calendarHref === calendarHref) {
				out.push(tracked);
			}
		}
		return out;
	}

	getAllForAccount(accountId: string): TrackedCalDAVEvent[] {
		const out: TrackedCalDAVEvent[] = [];
		for (const tracked of this.byUid.values()) {
			if (tracked.metadata.accountId === accountId) {
				out.push(tracked);
			}
		}
		return out;
	}

	protected getIntegrationLabel(): string {
		return "CalDAV";
	}
}
