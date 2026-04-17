import type { CalDAVFetchedEvent } from "./client";
import type { CalDAVSyncMetadata } from "./types";

export type TrackedRef = { filePath: string; metadata: CalDAVSyncMetadata };

export type SyncPlanAction =
	| { kind: "create"; uid: string; event: CalDAVFetchedEvent }
	| { kind: "update"; uid: string; filePath: string; event: CalDAVFetchedEvent }
	| { kind: "skip-unchanged"; uid: string; filePath: string }
	| { kind: "skip-missing-uid"; url: string }
	| { kind: "skip-foreign-uid"; uid: string; ownedBy: { accountId: string; calendarHref: string } };

export interface SyncPlan {
	actions: SyncPlanAction[];
	summary: {
		create: number;
		update: number;
		skipUnchanged: number;
		skipMissingUid: number;
		skipForeignUid: number;
	};
}

export interface PlanInputs {
	accountId: string;
	calendarHref: string;
	remoteEvents: CalDAVFetchedEvent[];
	/**
	 * Resolve a tracked event for *this* (account, calendar, uid) triple.
	 * `null` means "not tracked in our scope". The real sync state manager
	 * provides this via `findByUid`.
	 */
	findByUid: (uid: string) => TrackedRef | null;
	/**
	 * Resolve a tracked event anywhere in the plugin (across every account +
	 * calendar). Used to skip creating a duplicate note when another account
	 * already owns the same UID. `null` means "no global tracker".
	 */
	findByUidGlobal: (uid: string) => TrackedRef | null;
}

/**
 * Pure decision function for CalDAV sync.
 *
 * Given the remote CalDAV payload and the current tracked state, returns the
 * ordered list of actions the sync service should perform. Keeping this pure
 * — no network, no file IO — makes every branch snapshot-testable and
 * decouples "what should happen" from "how to execute it". Mirrors the shape
 * of `computeIcsSubscriptionSyncPlan` for consistency across integrations.
 *
 * Rules (in priority order per remote event):
 *   1. Missing uid          → skip-missing-uid (CalDAV objects normally have
 *                             a UID; missing uid means malformed server data)
 *   2. Tracked by us (same
 *      account + calendar)  → update IF etag differs, else skip-unchanged
 *   3. Tracked globally but
 *      not by us             → skip-foreign-uid (avoid duplicate notes when
 *                              another account/calendar owns the same UID)
 *   4. Otherwise             → create
 *
 * This intentionally does NOT emit `delete` actions: CalDAV servers expose
 * tombstones via RFC 6578 sync-token collections, not via absence in a plain
 * REPORT response. Pruning on absence would incorrectly delete events that
 * paginated out of the current window. Deletion will land when we adopt
 * sync-token tracking.
 */
export function computeCaldavSyncPlan(inputs: PlanInputs): SyncPlan {
	const { remoteEvents, findByUid, findByUidGlobal } = inputs;
	const actions: SyncPlanAction[] = [];

	for (const event of remoteEvents) {
		const uid = event.uid ?? "";
		if (!uid) {
			actions.push({ kind: "skip-missing-uid", url: event.url });
			continue;
		}

		const ownTrack = findByUid(uid);
		if (ownTrack) {
			if (ownTrack.metadata.etag === event.etag) {
				actions.push({ kind: "skip-unchanged", uid, filePath: ownTrack.filePath });
			} else {
				actions.push({ kind: "update", uid, filePath: ownTrack.filePath, event });
			}
			continue;
		}

		const foreign = findByUidGlobal(uid);
		if (foreign) {
			actions.push({
				kind: "skip-foreign-uid",
				uid,
				ownedBy: {
					accountId: foreign.metadata.accountId,
					calendarHref: foreign.metadata.calendarHref,
				},
			});
			continue;
		}

		actions.push({ kind: "create", uid, event });
	}

	const summary = {
		create: 0,
		update: 0,
		skipUnchanged: 0,
		skipMissingUid: 0,
		skipForeignUid: 0,
	};
	for (const action of actions) {
		if (action.kind === "create") summary.create++;
		else if (action.kind === "update") summary.update++;
		else if (action.kind === "skip-unchanged") summary.skipUnchanged++;
		else if (action.kind === "skip-missing-uid") summary.skipMissingUid++;
		else if (action.kind === "skip-foreign-uid") summary.skipForeignUid++;
	}

	return { actions, summary };
}
