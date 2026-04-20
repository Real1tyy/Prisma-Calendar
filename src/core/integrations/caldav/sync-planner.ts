import type { CalDAVFetchedEvent } from "./client";
import type { CalDAVSyncMetadata } from "./types";

export type TrackedRef = { filePath: string; metadata: CalDAVSyncMetadata };

export type SyncPlanAction =
	| { kind: "create"; uid: string; event: CalDAVFetchedEvent }
	| { kind: "update"; uid: string; filePath: string; event: CalDAVFetchedEvent }
	| { kind: "delete"; uid: string; filePath: string; objectHref: string }
	| { kind: "skip-unchanged"; uid: string; filePath: string }
	| { kind: "skip-missing-uid"; url: string }
	| { kind: "skip-tombstone-untracked"; objectHref: string }
	| { kind: "skip-foreign-uid"; uid: string; ownedBy: { accountId: string; calendarHref: string } };

export interface SyncPlan {
	actions: SyncPlanAction[];
	summary: {
		create: number;
		update: number;
		delete: number;
		skipUnchanged: number;
		skipMissingUid: number;
		skipTombstoneUntracked: number;
		skipForeignUid: number;
	};
}

export interface PlanInputs {
	accountId: string;
	calendarHref: string;
	/**
	 * Events the server reports as created or updated in this sync window.
	 * On a full sync (no prior token) this is the complete calendar; on an
	 * incremental sync this is the delta since the last token.
	 */
	remoteEvents: CalDAVFetchedEvent[];
	/**
	 * Object hrefs the server reports as deleted since the last sync-token.
	 * Only populated on sync-collection (RFC 6578) responses — on a full
	 * refetch (no token, or token-invalidated fallback) this must be empty,
	 * because absence from a windowed REPORT is NOT a delete signal.
	 */
	tombstonedObjectHrefs?: string[];
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
	/**
	 * Resolve a tracked event by the CalDAV object href the server uses.
	 * Tombstones from sync-collection arrive as hrefs, not UIDs, so we need
	 * a direct lookup to translate them into local file deletions. Return
	 * `null` when the href doesn't match anything we track (stale tombstone
	 * for a note the user already removed locally — safe to ignore).
	 */
	findByObjectHref: (objectHref: string) => TrackedRef | null;
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
 *      not by us            → skip-foreign-uid (avoid duplicate notes when
 *                             another account/calendar owns the same UID)
 *   4. Otherwise            → create
 *
 * For each href in `tombstonedObjectHrefs` (RFC 6578 incremental deletions —
 * authoritative, server-driven):
 *   • Tracked locally       → delete
 *   • Not tracked           → skip-tombstone-untracked (stale tombstone or
 *                             the user already removed the note locally)
 *
 * Deletions are ONLY emitted when the caller supplies tombstones. A full
 * refetch with no tombstones never produces deletes — absence from a
 * paginated/time-windowed REPORT is not a delete signal.
 */
export function computeCaldavSyncPlan(inputs: PlanInputs): SyncPlan {
	const { remoteEvents, tombstonedObjectHrefs = [], findByUid, findByUidGlobal, findByObjectHref } = inputs;
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

	for (const objectHref of tombstonedObjectHrefs) {
		const tracked = findByObjectHref(objectHref);
		if (tracked) {
			actions.push({
				kind: "delete",
				uid: tracked.metadata.uid,
				filePath: tracked.filePath,
				objectHref,
			});
		} else {
			actions.push({ kind: "skip-tombstone-untracked", objectHref });
		}
	}

	const summary = {
		create: 0,
		update: 0,
		delete: 0,
		skipUnchanged: 0,
		skipMissingUid: 0,
		skipTombstoneUntracked: 0,
		skipForeignUid: 0,
	};
	for (const action of actions) {
		if (action.kind === "create") summary.create++;
		else if (action.kind === "update") summary.update++;
		else if (action.kind === "delete") summary.delete++;
		else if (action.kind === "skip-unchanged") summary.skipUnchanged++;
		else if (action.kind === "skip-missing-uid") summary.skipMissingUid++;
		else if (action.kind === "skip-tombstone-untracked") summary.skipTombstoneUntracked++;
		else if (action.kind === "skip-foreign-uid") summary.skipForeignUid++;
	}

	return { actions, summary };
}
