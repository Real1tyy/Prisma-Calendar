# Decision: Recurring Instance Date Is Immutable

**Status:** Accepted
**Date:** 2026-04-02

## Problem

Dragging a physical recurring instance to a new date deleted the event. The system was mutating `Recurring Instance Date` and renaming the file simultaneously, causing the recurring engine to lose track of the instance and trash it as a "duplicate."

## Decision

`Recurring Instance Date` is set once at creation and never modified. It is the source of truth for which occurrence slot a physical instance represents — not where the event appears on the calendar.

A recurring source event (e.g. "monthly-breakdown" starting April 1) generates physical instances at each occurrence: May 1, June 1, etc. `Recurring Instance Date` is the stamp that says "this file covers the June 1 occurrence." The user is free to drag that event to June 2 or any other date — the display date changes, but the engine still knows June 1 is accounted for and won't regenerate it.

This separation gives users maximum flexibility to rearrange their schedule while keeping the recurring engine's bookkeeping simple and stable. The engine only looks at `Recurring Instance Date` to decide what to generate. The display date is the user's domain.

When a user drags a recurring instance:

1. Display date (`Date` / `Start Date` / `End Date`) is updated normally.
2. File is renamed to reflect the new display date (cosmetic).
3. `Recurring Instance Date` stays at the original generation date.

## File Rename Guard

The file rename triggers `file-deleted` + `file-changed` indexer events. `handleFileDeleted` skips `scheduleRefresh()` when `isRename` is true to prevent the engine from seeing an empty slot and creating a duplicate file before the `file-changed` re-registers the instance.

## Key Files

- `src/core/commands/update-commands.ts` — `UpdateEventCommand` never touches `instanceDateProp`
- `src/core/recurring-event-manager.ts` — `handleFileDeleted` skips refresh on rename
- `src/utils/event-frontmatter.ts` — `buildInstanceFrontmatter()` sets `instanceDate` at creation (the only write)
