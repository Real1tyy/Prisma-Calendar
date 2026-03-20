# Decision: Local Time Convention — Boundary-Only Z Handling

**Status:** Accepted (supersedes 001-utc-everywhere)
**Date:** 2026-03-20

## Context

Prisma Calendar stores event timestamps in Obsidian frontmatter with a trailing `Z` suffix (e.g., `2026-03-19T08:50:00.000Z`). This `Z` is a **convention** — the value represents the user's local time, not UTC. The plugin has no timezone support.

The previous approach (001-utc-everywhere) used `{ zone: "utc" }` on every `DateTime.fromISO()` call and `.toUTC()` on every output. This was fragile: any call that forgot `{ zone: "utc" }` would silently shift times by the user's UTC offset.

## Decision

**Strip Z at entry boundaries, never use Z internally, append Z at exit boundaries.**

### Entry (frontmatter to internal)

When reading from frontmatter, strip the Z suffix before storing in `CalendarEvent`:

- `"2026-03-19T08:50:00.000Z"` from frontmatter becomes `"2026-03-19T08:50:00"` internally
- Use `stripZ()` from `utils/iso.ts`

### Internal representation

All internal ISO strings have no Z, no offset:

- `event.start` = `"2026-03-19T08:50:00"`
- `DateTime.fromISO(event.start)` produces local-zone DateTime (correct behavior)
- `new Date(event.start)` produces local-time Date (correct behavior)
- No `{ zone: "utc" }` needed anywhere in non-integration code

### Exit (internal to frontmatter)

When writing to frontmatter, append Z:

- `"2026-03-19T08:50:00"` internal becomes `"2026-03-19T08:50:00Z"` in frontmatter
- Use `appendZ()` from `utils/iso.ts`
- All-day dates remain date-only: `"2026-03-19"` (no Z)

### Utilities (`utils/iso.ts`)

- `stripZ(iso)` — removes trailing `.000Z` or `Z`
- `appendZ(iso)` — appends `Z` if not present
- `toInternalISO(dt)` — converts Luxon DateTime to `YYYY-MM-DDTHH:MM:SS` (no Z, no offset, no milliseconds)

## Rules

1. **Never** use `{ zone: "utc" }` when parsing internal event times.
2. **Never** use `.toUTC()` on DateTime objects in non-integration code.
3. **Never** use `DateTime.utc()` for calendar math — use `DateTime.local()` or `DateTime.fromISO()`.
4. The `src/core/integrations/` directory handles real UTC for ICS/CalDAV and is exempt from these rules.

## Supported frontmatter formats

| Type    | Frontmatter                | Internal              |
| ------- | -------------------------- | --------------------- |
| Timed   | `2026-03-19T08:50:00.000Z` | `2026-03-19T08:50:00` |
| Timed   | `2026-03-19T08:50:00Z`     | `2026-03-19T08:50:00` |
| All-day | `2026-03-19`               | `2026-03-19T00:00:00` |

## Consequences

- Simple mental model: what the user types is what gets stored and displayed.
- No more "forgot `{ zone: "utc" }`" bugs — default Luxon behavior is correct.
- `new Date(event.start)` works correctly everywhere (local time interpretation).
- Integration code (ICS/CalDAV) is explicitly separated and handles real UTC.
