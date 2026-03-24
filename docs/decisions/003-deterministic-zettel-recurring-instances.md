# Decision: Deterministic Zettel IDs for Recurring Event Instances

**Status:** Accepted
**Date:** 2026-03-24

## Context

When Prisma Calendar generates physical files from recurring events, each file needs a zettel ID suffix in its filename. Normal (non-recurring) events use `generateZettelId()` from `shared/src/core/generate.ts`, which produces a 14-digit timestamp (`YYYYMMDDHHmmss`) — e.g., `Daily-20260324131325.md`.

Recurring instances cannot use timestamp-based zettel IDs because the same instance may be referenced multiple times across different code paths (virtual generation, physical creation, dedup checks). A timestamp-based ID would produce a different value on each call, breaking filename stability.

## Decision

**Use `hashRRuleIdToZettelFormat(rRuleId)` to produce a deterministic 14-digit zettel suffix for recurring instance filenames.**

The function hashes the event's `rRuleId` string into a stable 14-digit number using a djb2-style hash. Combined with the instance date in the filename, this produces a unique, predictable path for any `(rRuleId, date)` pair:

```
{title} {YYYY-MM-DD}-{zettelHash}.md
```

Example: `Daily 2026-03-24-00000465452562.md`

## Why Not a Real Zettel ID?

`generateZettelId()` captures the current timestamp at call time. Two calls milliseconds apart produce different IDs. This breaks the system because `generateNodeInstanceFilePath()` is called from multiple places that must agree on the same path:

1. **Virtual instance generation** (`generateAllVirtualInstances`, line ~892) — pre-computes file paths to check which virtual instances already have physical files on disk.
2. **Physical instance creation** (`createPhysicalInstance`, line ~702) — generates the path to write the new file and checks `vault.getAbstractFileByPath(filePath)` to avoid creating duplicates.

If these two calls produce different paths, virtual instances cannot detect their corresponding physical files, and the vault file-existence check in `createPhysicalInstance` becomes useless.

## Deduplication Layers

Physical instance creation has three dedup layers. The deterministic zettel hash is critical for layer 3:

| Layer | Location                              | Mechanism                                                            | Depends on deterministic path? |
| ----- | ------------------------------------- | -------------------------------------------------------------------- | ------------------------------ |
| 1     | `createInstanceIfMissing` (line ~669) | Checks `physicalInstances` map by `rRuleId` + date key               | No                             |
| 2     | `createPhysicalInstance` (line ~711)  | Re-checks in-memory map by `rRuleId` + date key (inside lock)        | No                             |
| 3     | `createPhysicalInstance` (line ~706)  | Checks `vault.getAbstractFileByPath(filePath)` for on-disk existence | **Yes**                        |

Layers 1 and 2 use `rRuleId` + `instanceDate` from the in-memory `recurringEventsMap`. They handle the common case.

Layer 3 is a safety net for edge cases where a file exists on disk but hasn't been indexed into the in-memory map yet (e.g., during startup, reindexing, or after a vault sync). Without a deterministic path, this check would never match, and duplicate files could be created during race conditions.

## Tradeoffs

**Benefits of the current approach:**

- Any code path can independently compute the expected filename for a `(rRuleId, date)` pair without coordination or shared state.
- Layer 3 dedup works without requiring the in-memory index to be fully populated.
- Virtual instances can pre-compute their physical file path for existence checks.

**Costs:**

- The zettel suffix on recurring instances is not a real timestamp — it looks like `00000465452562` instead of `20260324131325`. This is cosmetic only; it has no functional impact since the `rRuleId` and `instanceDate` are stored in frontmatter properties.
- The djb2 hash has theoretical collision risk, but the 14-digit space (10^14) makes this negligible in practice.

## Alternative Considered: Real Zettel ID at Creation Time

Generate a real `generateZettelId()` once during physical file creation, store it in frontmatter, and rely solely on layers 1-2 for dedup.

**Rejected because:**

- Virtual instance generation would need a different mechanism to match against existing physical files (query the indexer by `rRuleId` + date instead of path lookup).
- Layer 3 safety net would be lost entirely.
- The refactor scope is larger with no user-facing benefit.

## Key Files

- `src/utils/event-naming.ts` — `hashRRuleIdToZettelFormat()`, `removeZettelId()`
- `src/core/recurring-event-manager.ts` — `generateNodeInstanceFilePath()`, `createPhysicalInstance()`, `generateAllVirtualInstances()`
- `shared/src/core/generate.ts` — `generateZettelId()` (timestamp-based, used for non-recurring events)
