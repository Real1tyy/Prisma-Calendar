import type { App } from "obsidian";
import type { BehaviorSubject } from "rxjs";

import type { SingleCalendarConfig } from "../../../types/settings";
import type { Indexer } from "../../indexer";
import { BaseSyncStateManager, type TrackedSyncEvent } from "../base-sync-state-manager";
import { type ICSSubscriptionSyncMetadata, ICSSubscriptionSyncMetadataSchema } from "./types";

type TrackedICSSubscriptionEvent = TrackedSyncEvent<ICSSubscriptionSyncMetadata>;

export class ICSSubscriptionSyncStateManager extends BaseSyncStateManager<ICSSubscriptionSyncMetadata> {
	/**
	 * Maps: subscriptionId -> uid -> TrackedICSSubscriptionEvent
	 */
	private syncState: Map<string, Map<string, TrackedICSSubscriptionEvent>> = new Map();

	/**
	 * Global uid index for cross-subscription dedup: uid -> TrackedICSSubscriptionEvent
	 */
	private globalUidIndex: Map<string, TrackedICSSubscriptionEvent> = new Map();

	constructor(app: App, indexer: Indexer, settings$: BehaviorSubject<SingleCalendarConfig>) {
		super(app, indexer, settings$, (s) => s.icsSubscriptionProp, ICSSubscriptionSyncMetadataSchema);
	}

	findByUid(subscriptionId: string, uid: string): TrackedICSSubscriptionEvent | null {
		return this.syncState.get(subscriptionId)?.get(uid) || null;
	}

	findByUidGlobal(uid: string): TrackedICSSubscriptionEvent | null {
		return this.globalUidIndex.get(uid) || null;
	}

	getAllForSubscription(subscriptionId: string): TrackedICSSubscriptionEvent[] {
		const subscriptionState = this.syncState.get(subscriptionId);
		return subscriptionState ? Array.from(subscriptionState.values()) : [];
	}

	protected trackEvent(filePath: string, metadata: ICSSubscriptionSyncMetadata): void {
		const tracked = { filePath, metadata };
		if (
			!this.tryTrackInGlobalIndex(
				this.globalUidIndex,
				metadata.uid,
				filePath,
				tracked,
				`ICS event (UID: ${metadata.uid})`
			)
		) {
			return;
		}

		let subscriptionState = this.syncState.get(metadata.subscriptionId);
		if (!subscriptionState) {
			subscriptionState = new Map();
			this.syncState.set(metadata.subscriptionId, subscriptionState);
		}

		subscriptionState.set(metadata.uid, tracked);
	}

	protected untrackByPath(filePath: string): boolean {
		return this.untrackByPathFromMaps(this.syncState, this.globalUidIndex, filePath);
	}

	protected clearState(): void {
		this.syncState.clear();
		this.globalUidIndex.clear();
	}
}
