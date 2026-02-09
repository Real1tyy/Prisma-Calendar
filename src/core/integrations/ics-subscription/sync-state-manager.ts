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

	constructor(indexer: Indexer, settings$: BehaviorSubject<SingleCalendarConfig>) {
		super(indexer, settings$, (s) => s.icsSubscriptionProp, ICSSubscriptionSyncMetadataSchema);
	}

	findByUid(subscriptionId: string, uid: string): TrackedICSSubscriptionEvent | null {
		return this.syncState.get(subscriptionId)?.get(uid) || null;
	}

	getAllForSubscription(subscriptionId: string): TrackedICSSubscriptionEvent[] {
		const subscriptionState = this.syncState.get(subscriptionId);
		return subscriptionState ? Array.from(subscriptionState.values()) : [];
	}

	protected trackEvent(filePath: string, metadata: ICSSubscriptionSyncMetadata): void {
		let subscriptionState = this.syncState.get(metadata.subscriptionId);
		if (!subscriptionState) {
			subscriptionState = new Map();
			this.syncState.set(metadata.subscriptionId, subscriptionState);
		}

		subscriptionState.set(metadata.uid, { filePath, metadata });
	}

	protected untrackByPath(filePath: string): boolean {
		for (const subscriptionState of this.syncState.values()) {
			for (const [uid, tracked] of subscriptionState.entries()) {
				if (tracked.filePath === filePath) {
					subscriptionState.delete(uid);
					return true;
				}
			}
		}
		return false;
	}

	protected clearState(): void {
		this.syncState.clear();
	}
}
