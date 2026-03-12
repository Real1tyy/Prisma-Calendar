# Decision: UTC Everywhere — No Timezone Conversions

**Status:** Accepted
**Date:** 2026-03-12

## Context

Prisma Calendar stores event timestamps as ISO datetime strings (e.g., `2026-03-12T14:00:00`). These strings are already in UTC. The plugin does not have any concept of user timezones, timezone settings, or timezone conversions.

The user sees these UTC values directly and mentally treats them as their local time. For example, if a user creates an event at "2pm", the stored value is `2026-03-12T14:00:00` — there is no offset applied, no `Z` suffix, no `+02:00`. It's just a bare datetime that happens to be stored in UTC format.

## Decision

**All DateTime operations in Prisma-Calendar must use UTC. No local timezone logic anywhere.**

### Rules

1. **Parsing event timestamps:** Always use `DateTime.fromISO(value, { zone: "utc" })`. Never use `DateTime.fromISO(value)` without the zone — Luxon defaults to local timezone, which shifts dates.

2. **Constructing dates for calendar math:** Always use `DateTime.utc(year, month, day)`. Never use `DateTime.local(...)` or `DateTime.now()`.

3. **Extracting date portions:** Prefer `getISODatePart(event.start)` from `utils/format.ts` — it's a pure string slice (`"2026-03-12T14:00:00"` → `"2026-03-12"`), no DateTime parsing needed.

4. **Display formatting:** When you need Luxon for formatting (e.g., weekday names, month labels), parse with `{ zone: "utc" }` first.

## Consequences

- Simple mental model: what the user types is what gets stored, no conversions.
- Users in non-UTC timezones see "correct" times because there are no offsets applied.
- The tradeoff: if we ever need real timezone support, this is a significant architectural change.
