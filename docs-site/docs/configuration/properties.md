# Properties Settings

Tell Prisma Calendar which frontmatter keys you use — and in what order they live on disk.

## Property Order

The Properties tab lists every Prisma property in a single reorderable table. Each row shows the property's purpose and an input to rename its frontmatter key; drag a row (or use the arrow buttons) to change its position.

The row order is not cosmetic: **it is the exact frontmatter order Prisma writes to disk.** On every save, Prisma pulls its own properties together into one contiguous block in this order, placed where the first Prisma property already sits in the file. Properties Prisma doesn't manage — your own keys, or ones written by other plugins — keep their values and their order relative to each other, flowing above and below that block.

Why this matters: Obsidian appends new frontmatter keys at the end of the file, so the key order depends on the history of edits. Two synced devices accumulate different orders, and from then on every save produces textually different files with identical content — which sync tools (LiveSync, iCloud, Syncthing) report as conflicts, most visibly on auto-written keys like `Sort Date`. With a deterministic order, all devices converge to byte-identical files and those conflicts disappear.

### What a save changes

Given the row order `Start Date` → `Sort Date`, a note whose keys arrived in a different order:

```yaml
---
Project: Website Redesign
Start Date: 2024-01-15T09:00
Tags: [work]
Sort Date: 2024-01-15T09:00
---
```

comes back from the next save as:

```yaml
---
Project: Website Redesign
Start Date: 2024-01-15T09:00
Sort Date: 2024-01-15T09:00
Tags: [work]
---
```

`Project` sat above the first Prisma property and stays there. `Tags` sat between two Prisma properties, so the block closes around it and it lands below — its value is untouched, and it keeps its order relative to every other key you own.

### Choosing where the block lands

The block anchors on whichever Prisma property comes first in the file, so **the keys you put above it decide its position.** Keep one of your own properties at the top and the block sits underneath it, as above. Move your own keys below the first Prisma property — or delete them — and the block takes the top of the frontmatter:

```yaml
---
Start Date: 2024-01-15T09:00
Sort Date: 2024-01-15T09:00
Project: Website Redesign
Tags: [work]
---
```

Either layout is stable: once the file matches the configured order, later saves leave it alone.

Notes:

- **Convergence is eventual** — a file adopts the configured order the next time Prisma writes to it. Use [Normalize property order](#normalize-property-order) to converge everything at once.
- **A file with only one Prisma property is left alone** — there is no block to form, so nothing moves.
- **Multiple planning systems (or plugins) on one directory** coexist: each one only groups its *own* properties, at the position they already occupy — no plugin fights another for the end of the file.
- Keep the order setting itself in sync across devices (it lives in the plugin's `data.json`), so every device enforces the same order.
- Every explanation panel on the tab folds away once you've read it — click its header to collapse or reopen it. Each panel remembers its own state, on that device.

## Normalize property order

The **Scan and normalize…** button on the Properties tab (also available as the **Normalize property order** command in the command palette) converges an existing vault in one pass:

1. **Scan** — every event file is checked against the configured order without writing anything.
2. **Review** — a dialog lists the files whose Prisma properties are out of order (the first 20, plus a count of the rest for large vaults). Cancel here and nothing changes.
3. **Normalize** — on confirmation, the listed files are rewritten with a progress bar; the dialog closes with a summary of how many files were updated (and any that failed, with details in the developer console).

Only Prisma's own properties are reordered; your keys keep their values and their order relative to each other, exactly as on any other save. Files already in order are never touched, so re-running it is harmless. Run it on **one** device after changing the property order and let sync propagate the result — running it on several devices at once would just make them race to write the same files.

## Core Event Properties

Prisma uses two pairs of temporal properties, one per event type:

| Event type | Start | End |
|---|---|---|
| **Timed** — date and time | `Start Date` (e.g. `2026-01-01T09:00`) | `End Date` (e.g. `2026-01-01T10:30`) |
| **All-day** — date only | `Start Day` (e.g. `2026-01-01`) | `End Day` — only for events spanning several days |

- **Start date property** (required): default `Start Date`
- **End date property** (optional): default `End Date`
- **All-day property** (optional): default `All Day`
- **Start day property** (optional): default `Start Day` (the first day of an all-day event). Calendars created before `Start Day` became the default keep `Date` — see [Using Start Day instead of Date](#using-start-day-instead-of-date).
- **End day property** (optional): default `End Day` (the exclusive end of a multi-day all-day event)
- **Title property** (optional): default `Title` (falls back to file name when missing). See [Title property](#title-property) below for details.
- **Skip property**: property name to skip/hide event from calendar (default: `Skip`)

### Start Day and End Day

A single-day all-day event needs only `Start Day`:

```yaml
---
Start Day: 2026-01-01
---
```

There is no `End Day` on a single-day event — without one, the event covers exactly its start day. Prisma never writes an `End Day` for a single day, and saving a same-day range in the form removes it.

### All-day spans: exclusive storage, inclusive display

Add `End Day` to stretch an all-day event over several days. The event covers its `Start Day` through the day **before** `End Day`:

```yaml
---
Start Day: 2026-01-01
End Day: 2026-01-08
---
```

This event covers January 1–7. `End Day` stores January 8 to match iCalendar, Google Calendar and FullCalendar, which all use an exclusive end. The event form and tooltips show January 7, the last covered day. Select January 1 and January 7 in the form to create this span.

An `End Day` equal to or before `Start Day`, or one that is not a valid date, is treated as a single day.

Drag the bar to move the entire span, or drag its right edge to change the last day. Undo restores the previous dates. Toggling **All day** preserves the first and last days. Heatmaps and statistics count the event on its start day. Recurring all-day events cover one day per occurrence.

ICS export always writes an exclusive end (`DTEND`): `End Day` for a multi-day event, the following day for a single-day event. Importing a single-day event never adds an `End Day`. The event API returns an all-day `end` only for multi-day events, and converting a note to a virtual event preserves its span.

### Using Start Day instead of Date

Calendars created before `Start Day` became the default use `Date` for the first day of all-day events. Those calendars keep working unchanged: Prisma keeps reading and writing `Date`, and multi-day events pair it with `End Day`:

```yaml
---
Date: 2026-01-01
End Day: 2026-01-08
---
```

For consistency and readability I recommend switching to `Start Day`, so every all-day note reads as `Start Day` / `End Day` next to the timed `Start Date` / `End Date`. Nothing forces the switch. To make it:

1. **Rename the property in your notes.** In Obsidian's **All properties** view (core Properties plugin), right-click `Date`, choose **Rename**, and enter `Start Day`. Obsidian rewrites every note that uses it. Rename only if `Date` is not used by other plugins or queries for something else.
2. **Point the calendar at it.** Open the calendar's **Properties** settings and set **Start day property** to `Start Day`.
3. **Update your own queries.** Bases views, Dataview queries or templates that read `Date` for all-day events should read `Start Day`.

Do steps 1 and 2 together: between them, all-day notes whose property name does not match the setting do not appear on the calendar. Repeat step 2 for each calendar that indexes those notes, and on one device only for step 1 — sync carries the renamed notes to the others.

### Title property

When the **Title property** is set, Prisma Calendar uses its value as the event's display name everywhere — the calendar grid, the edit modal, the Gantt bars, the Timeline, the Heatmap day-detail panel, and the events lists. The filename still stores the event and keeps its ZettelID, but the visible title comes from the frontmatter key you configured.

Editing the title in the modal writes the exact text you typed back into that property. ZettelID suffixes and recurring-instance date prefixes live on the filename only — they are never mixed into the property value. This means a title like `After Edit` stays `After Edit` in frontmatter, not `After Edit-20250101000000`.

If **Title property** is blank, the event's title is derived from the filename (with any ZettelID or instance-date suffix stripped for display).

Priority when resolving an event's display title: `Title property` (user-controlled) → `Calendar title property` (auto-computed back-link) → filename.

## Sorting Normalization

- **Sorting normalization strategy**: write a normalized datetime to a dedicated sort property so external tools (Bases, Dataview) can sort all event types by a single field. See [Sorting Normalization for External Tools](#sorting-normalization-for-external-tools) below for full details.
- **Sort date property**: frontmatter property to write the normalized datetime to. Separate from the Start day property used by all-day events (default: `Sort Date`)

## Identification & Tracking

- **Calendar title property**: auto-computed display title stored as a wiki link with ZettelID stripped (default: `Calendar Title`). Used for clean rendering in the calendar and Bases views. Always kept in sync automatically. See [Event Naming](../features/management/zettelid-naming#calendar-title-property) for details
- **ZettelID property** (optional): when set, a timestamp-based ID is generated on creation/cloning (see [ZettelID Naming System](../features/management/zettelid-naming) for details). Default: `ZettelID`
- **Status property**: frontmatter property name for event status (default: `Status`), used when marking events as done or undone
- **Done value**: value to set in the status property when marking an event as done (default: `Done`)
- **Not done value**: value to set in the status property when marking an event as undone (default: `Not Done`)
- **Custom done property**: overrides the default status property for manual mark-as-done actions. Uses the format `propertyName value` (e.g., `archived true`, `priority 0`). When configured, this is used instead of the status property for context menu, modal checkbox, and batch operations. It is also used to evaluate whether an event is done — the context menu shows "Mark as undone" when the property matches. Auto-mark past events is not affected and continues to use the standard status property. Values are auto-parsed: `true`/`false` become booleans, numeric strings become numbers, everything else stays as a string. Leave empty to use the default status property behavior (default: empty)
- **Custom undone property**: overrides what happens when marking an event as undone. Same `propertyName value` format (e.g., `archived false`). Requires "Custom done property" to be configured first. If left empty, the custom done property key is removed from frontmatter on undone instead. Default: empty
- **Category property**: frontmatter property name for event categories (default: `Category`), used for grouping in statistics views. Supports **multiple comma-separated categories** (e.g., `Category: Work, Learning`) — events are counted under each category separately in statistics.
- **Location property**: frontmatter property name for event location (default: `Location`), a single string (e.g., "Conference Room A", "Zoom"). Shown in the Create/Edit Event modal when configured. **ICS Integration**: Location is mapped to the standard `LOCATION` field when exporting to ICS format and automatically imported from `LOCATION` fields in ICS files from external calendars (Google Calendar, Outlook, Apple Calendar, etc.).
- **Participants property**: frontmatter property name for event participants (default: `Participants`), an array of strings. In the modal, enter comma-separated names (e.g., "Alice, Bob, Charlie"). Stored as a YAML list in frontmatter. **ICS Integration**: Participants are exported as multiple `ATTENDEE` fields with RFC 5545-compliant formatting (including `mailto:` URIs and CN parameters) and imported from `ATTENDEE` fields in ICS files. Full round-trip compatibility with external calendar applications.
- **Break property**: frontmatter property name for break time in minutes (default: `Break`), subtracted from duration in statistics
- **Icon property**: frontmatter property name for event icon override (default: `Icon`). Accepts any emoji or text string (e.g., `🎉`, `📅`, `★`). The icon appears in the top-right corner of the event chip on the calendar, taking highest precedence over CalDAV account icons, ICS subscription icons, and recurring event markers. Shown as an input field in the Create/Edit Event modal when configured. See [Event Icons](../features/events/event-icons) for details.
- **Prerequisite property**: frontmatter property name for event prerequisites (default: `Prerequisite`). Stores wiki-links to other events that must complete before this event. Assign prerequisites via a searchable modal in the create/edit event dialog or the right-click context menu — events are shown with clean names, colored rows, and date/time labels. Stored as a YAML list of wiki-links in frontmatter.
- **CalDAV property**: property name for CalDAV sync metadata (default: `CalDAV`)
- **ICS subscription property**: property name for ICS subscription sync metadata (default: `ICSSubscription`)

## Notification Property Names

These property names control per-event notification overrides. The notification behavior itself is configured in the [Notifications](./notifications) settings tab.

- **Minutes before property**: frontmatter property to read per-event notification times for timed events (default: `Minutes Before`)
- **Days before property**: frontmatter property to read per-event notification days for all-day events (default: `Days Before`)
- **Already notified property**: frontmatter property to mark events as already notified (default: `Already Notified`)

## Recurring Event Properties

- **Future instances count property**: property name for per-event override of future instances count (default: `Future Instances Count`)
- **Generate past events property**: property name for generating past recurring instances from source event start date (default: `Generate Past Events`)
- **RRule until property**: property name for the inclusive recurring end date (default: `RRuleUntil`)
- **Instance date property**: property name for the date of a recurring instance, used to track which occurrence in the series a physical instance represents (default: `Recurring Instance Date`)

## Recurring (node-based)

- **RRule property**: recurring event type — 9 built-in presets (`daily`, `bi-daily`, `weekly`, `bi-weekly`, `monthly`, `bi-monthly`, `quarterly`, `semi-annual`, `yearly`) or a custom interval using the DSL format `FREQUENCY;INTERVAL=N` (e.g., `DAILY;INTERVAL=5` for every 5 days, `WEEKLY;INTERVAL=3` for every 3 weeks, `MONTHLY;INTERVAL=4` for every 4 months)
- **RRule specification property**: weekdays for weekly/bi-weekly (e.g., `monday, wednesday, friday`)
- **RRule until property**: inclusive final occurrence day for the recurring series (e.g., `2026-05-22`)
- **RRule ID property**: unique identifier for recurrence
- **Source property**: link to the source recurring event
- **Ignore recurring property**: when set to `true`, excludes the event from future instance generation count (useful for duplicated recurring events)

Example:

```yaml
---
Start Date: 2025-01-15T09:00
End Date: 2025-01-15T10:30
RRule: weekly
RRuleSpec: monday, wednesday, friday
RRuleUntil: 2025-05-30
RRuleID: standup-2025
---
```

## Display Properties

The **Display properties** section at the bottom of the Properties tab shows extra frontmatter properties inside event chips (scrollable when space is tight).

- **Display properties (timed events)**: comma-separated list of properties to show in timed event chips (e.g., `status, priority, project, tags`). Shown in weekly and daily views, hidden in monthly view.
- **Display properties (all-day events)**: comma-separated list of properties to show in all-day event chips (can differ from timed events). Shown in weekly and daily views, hidden in monthly view.
- **Display properties (untracked events)**: comma-separated list of properties to show in the untracked events dropdown (e.g., `status, priority, category`)
- **Display properties (heatmap)**: comma-separated list of properties to show in the heatmap day detail panel when clicking a day

Rendered example inside a chip:

```
Meeting with Team
status: In Progress
priority: High
project: Q4 Planning
```

**See Also**: [Untracked Events documentation](../features/events/untracked-events.md) for details on the untracked events dropdown

## How Prisma decides event type

Event type is resolved in two steps. The `All Day` property is checked first; if it is absent, the type is inferred from the value type of the date properties.

**1. The `All Day` property, when present, decides the type:**

- `All Day: true` → all-day event. The day is taken from the Start day property, or, if it is empty, the date portion of the Start date property.

  ```yaml
  ---
  Start Day: 2026-06-01
  All Day: true
  ---
  ```

- `All Day: false` → timed event. The time is taken from the Start date property; with no Start Date value the note is untracked.

  ```yaml
  ---
  Start Date: 2026-06-01T09:00
  End Date: 2026-06-01T10:00
  All Day: false
  ---
  ```

**2. When the `All Day` property is absent, the value type decides:**

- A **datetime** value (e.g. `2026-06-01T09:00`) in the Start date property → **timed event**. The End date property may hold another datetime, or be left empty to use the default duration.

  ```yaml
  ---
  Start Date: 2026-06-01T09:00
  End Date: 2026-06-01T10:00
  ---
  ```

- Otherwise, a **date-only** value (e.g. `2026-06-01`) in the Start day property → **all-day event**. `End Day` optionally extends it over several days; it does not affect event type.

  ```yaml
  ---
  Start Day: 2026-06-01
  ---
  ```

- Otherwise → **untracked** (the note is indexed but does not appear on the calendar). This includes a date-only value placed in the Start date property with no Start Day value:

  ```yaml
  ---
  Start Date: 2026-06-01
  ---
  ```

A date-only value must go in the **Start day property** to render. A date-only value in the **Start date property** with no Start Day value is untracked — datetimes belong in Start Date, dates belong in Start Day.

## Date and Time Properties on Save

For all-day events, Prisma writes `Start Day` and sets `All Day: true`. `End Day` is present only for events spanning more than one day. The timed `Start Date` and `End Date` properties are empty strings.

For timed events, `Start Date` and `End Date` hold datetimes, `Start Day` is empty and `All Day` is false. `End Day` is absent. Your configured property names apply throughout.

## Sorting Normalization for External Tools

**Event type** is decided by the value you write, with the `All Day` property as an optional override (see [How Prisma decides event type](#how-prisma-decides-event-type) above):
- `All Day: true` → forced all-day, uses the `Start Day` property
- `All Day: false` → forced timed, uses `Start Date` / `End Date`
- unset → inferred from the value type (date-only `Start Day` → all-day; datetime `Start Date` → timed)

**Sorting normalization strategy:**

When a sorting normalization strategy is enabled in Properties Settings, Prisma writes a normalized datetime to a dedicated `Sort Date` property. This allows external tools (Bases, Dataview, Obsidian search) to sort all event types — both timed and all-day — by a single field.

The `Sort Date` property is separate from the `Start Day` property used by all-day events. This avoids conflicts between the all-day event date and the normalized sorting value.

**Normalization modes:**

| Mode | Timed events | All-day events |
|------|-------------|----------------|
| **None** (default) | — | — |
| **Timed only — start** | Start datetime → Sort Date | — |
| **Timed only — end** | End datetime → Sort Date | — |
| **All-day only** | — | Start Day + `T00:00:00` → Sort Date |
| **All events — start** (recommended) | Start datetime → Sort Date | Start Day + `T00:00:00` → Sort Date |
| **All events — end** | End datetime → Sort Date | Start Day + `T00:00:00` → Sort Date |

All datetime values are written without the `.000Z` suffix. All-day events get `T00:00:00` appended so they sort consistently alongside timed events.

**Cleanup on event type change:** When an event switches to a type the active strategy does not cover (e.g. a timed event converted to all-day while "Timed only — start" is selected, or an event becoming untracked), Prisma removes the stale `Sort Date` value from frontmatter so sort data stays in sync with the current event type.

**Sort date property:**

The property name defaults to `Sort Date`. Change it in the "Sort date property" setting if you prefer a different name.

**Important**: For Bases views to sort events correctly by this property, the `Sort Date` property must be configured as a **Date & time** property type in Obsidian's property settings. If it is set to "Text" or another type, Bases will sort alphabetically instead of chronologically. To fix this, open Obsidian Settings → Properties and change the type of `Sort Date` to "Date & time", or add `"Sort Date": "datetime"` to your `.obsidian/types.json` file.

### Multiple planning systems on the same directory

If two planning systems point at the same directory (or one indexes a parent of the other with **Index subdirectories** enabled) and they disagree on the sort normalization strategy or the sort date property name, they would each rewrite the same events in different ways — leaving your notes in an inconsistent state.

Prisma detects this and:

- Shows a **Sort date conflict** warning banner in both planning systems' settings, naming the other system and the shared directory.
- Pauses `Sort Date` updates on both systems until the conflict is resolved — existing values stay untouched.

Resolve it by picking the same sort normalization strategy and `Sort Date` property on both systems, by giving them different directories, or by disabling one of them.

## Auto-mark Past Events

When enabled in [General settings](./general), Prisma Calendar will automatically update the status property of past events during startup:

- **For all-day events**: Checks if the date is in the past
- **For timed events**: Checks if the end date/time is in the past
- **Runs asynchronously**: Doesn't block the calendar from loading
- **Smart updates**: Only writes to files when the status needs to be changed

Example behavior:

```yaml
---
Start Date: 2025-01-10T14:00
End Date: 2025-01-10T15:00
STATUS: In Progress
---
```

After the end time passes, Prisma Calendar will automatically update it to:

```yaml
---
Start Date: 2025-01-10T14:00
End Date: 2025-01-10T15:00
STATUS: Done
---
```
