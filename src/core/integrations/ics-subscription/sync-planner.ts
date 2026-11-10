import type { IntegrationDeletionTombstone } from "../../../types/integrations";
import { isIntegrationEventDeleted } from "../deleted-event-tombstones";
import type { ImportedEvent } from "../ics-import";
import type { ICSSubscriptionSyncMetadata } from "./types";

export type TrackedRef = { filePath: string; metadata: ICSSubscriptionSyncMetadata };

export type SyncPlanAction =
	| { kind: "create"; uid: string; event: ImportedEvent }
	| { kind: "update"; uid: string; filePath: string; event: ImportedEvent }
	/**
	 * A note tracked under a subscription id that no longer exists in settings
	 * (settings not synced to this device, or the subscription re-added with a
	 * fresh id). Applied as an update, which rewrites the metadata under the
	 * current subscription — otherwise the note stays silently orphaned forever.
	 */
	| { kind: "adopt"; uid: string; filePath: string; event: ImportedEvent; previousSubscriptionId?: string }
	| { kind: "skip-unchanged"; uid: string; filePath: string }
	| { kind: "skip-missing-uid"; title: string }
	| { kind: "skip-filtered"; uid: string }
	| { kind: "skip-foreign-uid"; uid: string; ownedBy: string }
	| { kind: "skip-user-deleted"; uid: string }
	| { kind: "delete"; uid: string; filePath: string };

export interface SyncPlan {
	actions: SyncPlanAction[];
	summary: {
		create: number;
		/** Includes adoptions — they are applied as updates. */
		update: number;
		delete: number;
		skipUnchanged: number;
		skipMissingUid: number;
		skipForeignUid: number;
		skipFiltered: number;
	};
}

export interface PlanInputs {
	subscriptionId: string;
	remoteEvents: ImportedEvent[];
	trackedBySubscription: TrackedRef[];
	findByUidGlobal: (uid: string) => TrackedRef | null;
	/** Resolve a note created by the one-shot ICS importer. */
	findImportedByUid?: (uid: string) => { filePath: string } | null;
	/** The subscription's filter expression; omit to keep every remote event. */
	isIncluded?: (event: ImportedEvent) => boolean;
	/**
	 * Every subscription id currently configured on this device. A note tracked
	 * under an id not in this list is orphaned and adopted instead of skipped as
	 * foreign. Omit to treat every other id as a live foreign owner.
	 */
	knownSubscriptionIds?: readonly string[];
	userDeletedEvents?: readonly IntegrationDeletionTombstone[];
}

/**
 * Pure decision function for ICS subscription sync.
 *
 * Given the remote ICS payload and the current tracked state, returns the
 * ordered list of actions the sync service should perform. Keeping this pure
 * — no file IO, no network — makes every branch snapshot-testable and
 * decouples "what should happen" from "how to execute it".
 *
 * Rules (in priority order per remote event):
 *   1. Missing uid         → skip-missing-uid (ICS without a UID is unroutable)
 *   2. Tracked by us       → update IF lastModified differs, else skip-unchanged
 *   3. Tracked by another  → skip-foreign-uid (avoid duplicate notes across subs)
 *   2. Excluded by filter  → skip-filtered (and, being absent from the kept
 *                            set, a tracked note for it is deleted below)
 *   3. Tracked by us       → update IF lastModified differs, else skip-unchanged
 *   4. Tracked by another  → skip-foreign-uid (avoid duplicate notes across subs)
 *   5. Otherwise           → create
 *
 * After processing all remote events, any locally-tracked event whose uid is
 * NOT in the kept remote payload is marked for delete.
 */
export function computeIcsSubscriptionSyncPlan(inputs: PlanInputs): SyncPlan {
	const {
		subscriptionId,
		remoteEvents,
		trackedBySubscription,
		findByUidGlobal,
		findImportedByUid,
		knownSubscriptionIds,
		isIncluded = () => true,
		userDeletedEvents = [],
	} = inputs;
	const actions: SyncPlanAction[] = [];
	const remoteUids = new Set<string>();
	// O(1) lookup for tracked events by UID, since we'll be doing 1+ lookups per remote event.
	const ownTrackedByUid = new Map(trackedBySubscription.map((t) => [t.metadata.uid, t]));

	for (const event of remoteEvents) {
		const uid = event.uid;
		if (!uid) {
			actions.push({ kind: "skip-missing-uid", title: event.title });
			continue;
		}
		if (!isIncluded(event)) {
			actions.push({ kind: "skip-filtered", uid });
			continue;
		}
		if (isIntegrationEventDeleted(userDeletedEvents, { kind: "ics-subscription", subscriptionId, uid })) {
			actions.push({ kind: "skip-user-deleted", uid });
			continue;
		}
		remoteUids.add(uid);

		const ownTrack = ownTrackedByUid.get(uid);
		if (ownTrack) {
			if (ownTrack.metadata.lastModified === event.lastModified) {
				actions.push({ kind: "skip-unchanged", uid, filePath: ownTrack.filePath });
			} else {
				actions.push({ kind: "update", uid, filePath: ownTrack.filePath, event });
			}
			continue;
		}

		const foreign = findByUidGlobal(uid);
		if (foreign && foreign.metadata.subscriptionId !== subscriptionId) {
			const orphaned =
				knownSubscriptionIds !== undefined && !knownSubscriptionIds.includes(foreign.metadata.subscriptionId);
			if (orphaned) {
				actions.push({
					kind: "adopt",
					uid,
					filePath: foreign.filePath,
					event,
					previousSubscriptionId: foreign.metadata.subscriptionId,
				});
				continue;
			}
			actions.push({ kind: "skip-foreign-uid", uid, ownedBy: foreign.metadata.subscriptionId });
			continue;
		}

		const imported = findImportedByUid?.(uid);
		if (imported) {
			actions.push({ kind: "adopt", uid, filePath: imported.filePath, event });
			continue;
		}

		actions.push({ kind: "create", uid, event });
	}

	for (const tracked of trackedBySubscription) {
		if (!remoteUids.has(tracked.metadata.uid)) {
			actions.push({ kind: "delete", uid: tracked.metadata.uid, filePath: tracked.filePath });
		}
	}

	const summary = {
		create: 0,
		update: 0,
		delete: 0,
		skipUnchanged: 0,
		skipMissingUid: 0,
		skipForeignUid: 0,
		skipFiltered: 0,
	};
	for (const action of actions) {
		if (action.kind === "create") summary.create++;
		// An adoption is applied as an update and counted as one.
		else if (action.kind === "update" || action.kind === "adopt") summary.update++;
		else if (action.kind === "delete") summary.delete++;
		else if (action.kind === "skip-unchanged") summary.skipUnchanged++;
		else if (action.kind === "skip-missing-uid") summary.skipMissingUid++;
		else if (action.kind === "skip-filtered") summary.skipFiltered++;
		else if (action.kind === "skip-user-deleted") continue;
		else summary.skipForeignUid++;
	}

	return { actions, summary };
}
