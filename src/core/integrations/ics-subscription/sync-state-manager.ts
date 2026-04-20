import type { App } from "obsidian";
import type { BehaviorSubject } from "rxjs";

import type { CalendarEventSource } from "../../../types/event-source";
import type { SingleCalendarConfig } from "../../../types/settings";
import { BaseSyncStateManager, type TrackedSyncEvent } from "../base-sync-state-manager";
import { type ICSSubscriptionSyncMetadata, ICSSubscriptionSyncMetadataSchema } from "./types";

type TrackedICSSubscriptionEvent = TrackedSyncEvent<ICSSubscriptionSyncMetadata>;

/**
 * Tracks every locally-synced ICS URL subscription event under a single
 * UID-keyed map (inherited from `BaseSyncStateManager`). Per-subscription
 * views (`getAllForSubscription`) scan the map once per sync rather than
 * maintaining parallel nested indexes — the storage cost of one O(n) scan
 * during sync is much smaller than the invariant burden of keeping two maps
 * in lockstep.
 */
export class ICSSubscriptionSyncStateManager extends BaseSyncStateManager<ICSSubscriptionSyncMetadata> {
	constructor(app: App, eventSource: CalendarEventSource, settings$: BehaviorSubject<SingleCalendarConfig>) {
		super(app, eventSource, settings$, (s) => s.icsSubscriptionProp, ICSSubscriptionSyncMetadataSchema);
	}

	findByUid(subscriptionId: string, uid: string): TrackedICSSubscriptionEvent | null {
		const tracked = this.byUid.get(uid);
		if (!tracked) return null;
		if (tracked.metadata.subscriptionId !== subscriptionId) return null;
		return tracked;
	}

	getAllForSubscription(subscriptionId: string): TrackedICSSubscriptionEvent[] {
		const out: TrackedICSSubscriptionEvent[] = [];
		for (const tracked of this.byUid.values()) {
			if (tracked.metadata.subscriptionId === subscriptionId) {
				out.push(tracked);
			}
		}
		return out;
	}

	protected getIntegrationLabel(): string {
		return "ICS";
	}
}
