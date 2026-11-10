import type { IntegrationDeletionTombstone } from "../../../types/integrations";
import { IntegrationDeletionIndex } from "../deleted-event-tombstones";
import type { CalDAVFetchedEvent } from "./client";
import type { CalDAVSyncMetadata } from "./types";

export type TrackedRef = { filePath: string; metadata: CalDAVSyncMetadata };

export type SyncPlanAction =
	| { kind: "create"; uid: string; event: CalDAVFetchedEvent }
	| { kind: "update"; uid: string; filePath: string; event: CalDAVFetchedEvent }
	/**
	 * A note tracked under an account id that no longer exists in settings
	 * (settings not synced to this device, or the account re-added and given
	 * a fresh id). Applied as an update, which rewrites the metadata under the
	 * current account — otherwise the note stays silently orphaned forever.
	 */
	| { kind: "adopt"; uid: string; filePath: string; event: CalDAVFetchedEvent; previousAccountId: string }
	| { kind: "delete"; uid: string; filePath: string; objectHref: string }
	| { kind: "skip-unchanged"; uid: string; filePath: string }
	| { kind: "skip-missing-uid"; url: string }
	| { kind: "skip-tombstone-untracked"; objectHref: string }
	| { kind: "skip-foreign-uid"; uid: string; ownedBy: { accountId: string; calendarHref: string } }
	| { kind: "skip-filtered"; uid: string }
	| { kind: "skip-user-deleted"; uid: string };

export interface SyncPlan {
	actions: SyncPlanAction[];
	summary: {
		create: number;
		/** Includes adoptions — they are applied as updates. */
		update: number;
		/** Includes tracked events the filter now excludes. */
		delete: number;
		skipUnchanged: number;
		skipMissingUid: number;
		skipTombstoneUntracked: number;
		skipForeignUid: number;
		skipFiltered: number;
	};
}

export interface PlanInputs {
	accountId: string;
	calendarHref: string;
	/**
	 * Every CalDAV account id currently configured on this device. A note whose
	 * tracked account id is not in this list is orphaned (its account was
	 * removed, or settings never synced here) and is adopted instead of being
	 * skipped as foreign. Omit to treat every other id as a live foreign owner.
	 */
	knownAccountIds?: readonly string[];
	userDeletedEvents?: readonly IntegrationDeletionTombstone[];
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
	/** The account's filter expression; omit to keep every remote event. */
	isIncluded?: (event: CalDAVFetchedEvent) => boolean;
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
 *   2. Excluded by filter   → delete if tracked by us (the server still has it,
 *                             so no tombstone will ever remove the note),
 *                             else skip-filtered
 *   3. Tracked by us (same
 *      account + calendar)  → update IF etag differs, else skip-unchanged
 *   4. Tracked globally but
 *      not by us            → skip-foreign-uid (avoid duplicate notes when
 *                             another account/calendar owns the same UID)
 *   5. Otherwise            → create
 *
 * For each href in `tombstonedObjectHrefs` (RFC 6578 incremental deletions —
 * authoritative, server-driven):
 *   • Tracked locally       → delete
 *   • Not tracked           → skip-tombstone-untracked (stale tombstone or
 *                             the user already removed the note locally)
 *
 * Server-driven deletions are ONLY emitted when the caller supplies
 * tombstones. A full refetch with no tombstones never deletes an event it did
 * not see — absence from a paginated/time-windowed REPORT is not a delete
 * signal; only a present-but-excluded event is.
 */
export function computeCaldavSyncPlan(inputs: PlanInputs): SyncPlan {
	const {
		remoteEvents,
		tombstonedObjectHrefs = [],
		findByUid,
		findByUidGlobal,
		findByObjectHref,
		knownAccountIds,
		isIncluded = () => true,
		userDeletedEvents = [],
	} = inputs;
	const actions: SyncPlanAction[] = [];
	const deletionIndex = new IntegrationDeletionIndex(userDeletedEvents);

	for (const event of remoteEvents) {
		const uid = event.uid ?? "";
		if (!uid) {
			actions.push({ kind: "skip-missing-uid", url: event.url });
			continue;
		}
		if (
			deletionIndex.has({
				kind: "caldav",
				accountId: inputs.accountId,
				calendarHref: inputs.calendarHref,
				uid,
			})
		) {
			actions.push({ kind: "skip-user-deleted", uid });
			continue;
		}

		if (!isIncluded(event)) {
			const tracked = findByUid(uid);
			if (tracked) {
				actions.push({ kind: "delete", uid, filePath: tracked.filePath, objectHref: event.url });
			} else {
				actions.push({ kind: "skip-filtered", uid });
			}
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
			const orphaned = knownAccountIds !== undefined && !knownAccountIds.includes(foreign.metadata.accountId);
			if (orphaned) {
				actions.push({
					kind: "adopt",
					uid,
					filePath: foreign.filePath,
					event,
					previousAccountId: foreign.metadata.accountId,
				});
				continue;
			}
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
		skipFiltered: 0,
	};
	for (const action of actions) {
		if (action.kind === "create") summary.create++;
		// An adoption is applied as an update and counted as one.
		else if (action.kind === "update" || action.kind === "adopt") summary.update++;
		else if (action.kind === "delete") summary.delete++;
		else if (action.kind === "skip-unchanged") summary.skipUnchanged++;
		else if (action.kind === "skip-missing-uid") summary.skipMissingUid++;
		else if (action.kind === "skip-tombstone-untracked") summary.skipTombstoneUntracked++;
		else if (action.kind === "skip-filtered") summary.skipFiltered++;
		else if (action.kind === "skip-user-deleted") continue;
		else summary.skipForeignUid++;
	}

	return { actions, summary };
}
