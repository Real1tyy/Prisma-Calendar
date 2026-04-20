# CalDAV Sync Token Support (RFC 6578)

**Date:** 2026-04-19
**Status:** Accepted
**Scope:** `src/core/integrations/caldav/**`, `src/types/integrations.ts`

## Context

CalDAV sync was a full refetch on every run: WebDAV `REPORT` + diff against local state, with the planner intentionally never emitting `delete`:

> CalDAV servers expose tombstones via RFC 6578 sync-token collections, not via absence in a plain REPORT response. Pruning on absence would incorrectly delete events that paginated out of the current window.

Safe, but server-side deletions never reached the vault — a parity gap with ICS URL subscriptions, which do treat absence as deletion (ICS responses carry the full calendar).

## Decision

Adopt RFC 6578 (`sync-collection` / `sync-token`) as the primary CalDAV sync mechanism.

1. **Wire protocol** — already handled by `tsdav.smartCollectionSync`, wrapped by `CalDAVClientService.syncCalendar`. Returns `{ created, updated, deleted, newSyncToken }`. No XML parsing added.

2. **Token persistence — device-local, not in `data.json`.** The sync-token is a _per-device_ cursor. Storing it in `data.json` (which replicates via vault-sync) causes device B to present device A's cursor, the server accepts it as "nothing new," and B silently misses every delta in between. The invalidation fallback can't rescue this — the server never rejects the token, it just returns an empty diff. The cursor lives in `localStorage`, keyed by `prisma-calendar:caldav:sync-state:<accountId>:<calendarUrl>`.

3. **Planner extension** — two new action variants:
   - `delete { uid, filePath, objectHref }` — emitted only when the caller supplies `tombstonedObjectHrefs`.
   - `skip-tombstone-untracked { objectHref }` — server sent a tombstone for an href we don't track. No IO.

   The planner never invents deletes from absence; only hrefs the caller explicitly flagged as tombstoned produce deletes.

4. **State manager single-map design.** One `byUid: Map<uid, TrackedCalDAVEvent>` serves every lookup:
   - `findByUidGlobal(uid)` — O(1) direct get.
   - `findByUid(accountId, calendarHref, uid)` — O(1) get + field check.
   - `findByObjectHref(accountId, calendarHref, href)` — O(n), called ~once per tombstone (handful per sync).
   - `getAllForCalendar(accountId, calendarHref)` — O(n), called once per sync.

   Rejected the initial three-parallel-maps design — the invariant burden of keeping them in lockstep exceeded the marginal perf win. Same simplification applied to `ICSSubscriptionSyncStateManager`.

5. **Token invalidation fallback** — match on two spec-grounded signals only: the RFC 6578 §3.8 `<D:valid-sync-token/>` precondition element (surfaced in tsdav's error message) and an HTTP 410 status line anchored behind a `status` / `HTTP` prefix so a bare `410` in a URL or timestamp doesn't false-trip. On match, clear the stored token and retry once with a full refetch passing **zero tombstones** (absence is still not a delete signal). Contract locked by `caldav-sync-token-invalidation.test.ts`, which covers both positive signals and the benign strings that tripped the previous catch-all.

6. **Token advance only on clean apply.** The new sync-token is persisted only when `result.errors.length === 0`. If a delete action fails (e.g. `trashFile` throws), advancing the token would orphan the local note forever — the server won't resend that tombstone under a newer cursor. Keeping the old token means the next sync replays the batch; create/update actions are idempotent via etag, and the failed delete gets another shot.

7. **State priming** — sync service primes the state manager synchronously (`registerTracked` / `unregisterTracked`) after every create / update / delete, mirroring the ICS fix. Without it, a back-to-back sync fired before the reactive indexer drains races with an empty state map.

## Consequences

**Positive**

- CalDAV deletions propagate end-to-end; parity with ICS URL subscriptions.
- Bandwidth and sync latency drop after the first sync — the server returns only the delta.
- Two machines sharing a vault stay independently consistent — each holds its own localStorage cursor.
- Planner delete/tombstone branches locked by five snapshot tests (`caldav-plan-tombstone-*`, `caldav-plan-incremental-mix`, `caldav-plan-full-refetch-no-deletes`).
- Cross-sync race closed by state priming, covered by `caldav-sync-state-manager.test.ts` + `ics-subscription-sync-state-manager.test.ts`.

**Negative**

- `localStorage` doesn't roam with the vault (intentional). Losing it — incognito, manual clears — triggers one free full refetch, never data loss.
- Full refetch on invalidation cannot propagate deletions. Accepting transient drift during recovery is safer than synthesizing deletes from absence.
- Invalidation detection string-matches server errors. Brittle to new CalDAV server variants, but fail-safe: an unrecognized error surfaces as a normal sync failure.

**Alternatives considered**

- **Token in `data.json`.** Rejected — correctness (see decision 2).
- **Token in IndexedDB / `PersistentTableCache`.** Rejected — the cache is shaped for structured table data with async init and schema migrations; overkill for an opaque cursor string.
- **Token in a userdata file outside the vault.** Rejected — cross-platform fs access is fragile and leaks state Obsidian can't clean up.
- **Hand-rolled sync-collection XML parsing.** Rejected — tsdav already implements the wire protocol correctly and is battle-tested across major servers.
- **Token-less polling with per-event LIST + diff.** Rejected — equivalent bandwidth to the full-refetch path, still no deletion signal.
- **Derive from ctag.** Rejected — ctag signals "something changed" but not _what_, so no incremental deletion sync.
- **Three parallel maps on the state manager.** Rejected — see decision 4.

## References

- RFC 6578: Collection Synchronization for WebDAV
- [`tsdav.smartCollectionSync`](https://github.com/natelindev/tsdav)
- `../../tests/integrations/caldav-sync-planner.test.ts` — planner branch coverage
- `../../tests/integrations/caldav-sync-state-manager.test.ts` — state priming + href-lookup contract
