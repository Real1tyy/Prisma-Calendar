# Properties Settings

Tell Prisma Calendar which frontmatter keys you use.

## Core Event Properties

- **Start property** (required): default `Start Date`
- **End property** (optional): default `End Date`
- **All-day property** (optional): default `All Day`
- **Date property** (optional): default `Date` (for all-day events)
- **Title property** (optional): default `Title` (falls back to file name when missing)
- **Skip property**: property name to skip/hide event from calendar (default: `Skip`)

## Sorting Normalization

- **Sorting normalization strategy**: write a normalized datetime to a dedicated sort property so external tools (Bases, Dataview) can sort all event types by a single field. See [Sorting Normalization for External Tools](#sorting-normalization-for-external-tools) below for full details.
- **Sort date property**: frontmatter property to write the normalized datetime to. Separate from the Date property used by all-day events (default: `Sort Date`)

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
- **CalDAV property**: property name for CalDAV sync metadata (default: `CalDAV`)

## Notification Property Names

These property names control per-event notification overrides. The notification behavior itself is configured in the [Notifications](./notifications) settings tab.

- **Minutes before property**: frontmatter property to read per-event notification times for timed events (default: `Minutes Before`)
- **Days before property**: frontmatter property to read per-event notification days for all-day events (default: `Days Before`)
- **Already notified property**: frontmatter property to mark events as already notified (default: `Already Notified`)

## Recurring Event Properties

- **Future instances count property**: property name for per-event override of future instances count (default: `Future Instances Count`)
- **Generate past events property**: property name for generating past recurring instances from source event start date (default: `Generate Past Events`)

## Recurring (node-based)

- **RRule property**: recurring event type (e.g., `daily`, `weekly`, `bi-weekly`, `monthly`, `bi-monthly`, `quarterly`, `semi-annual`, `yearly`)
- **RRule specification property**: weekdays for weekly/bi-weekly (e.g., `monday, wednesday, friday`)
- **RRule ID property**: unique identifier for recurrence
- **Source property**: link to the source recurring event
- **Ignore recurring property**: when set to `true`, excludes the event from future instance generation count (useful for duplicated recurring events)

Example:

```yaml
---
Start: 2025-01-15T09:00
End: 2025-01-15T10:30
RRule: weekly
RRuleSpec: monday, wednesday, friday
RRuleID: standup-2025
---
```

### Ignored Recurring Instances

When you duplicate a recurring instance using the context menu, the duplicated event gets `Ignore Recurring: true`. This means:
- The event is still tracked as part of the recurring series
- It does NOT count towards the "Future instances count" limit
- The recurring event manager won't create new instances to replace it

```yaml
---
Start: 2025-01-22T09:00
End: 2025-01-22T10:30
RRuleID: standup-2025
Source: "[[Weekly Meeting Source]]"
Ignore Recurring: true
---
```

**WARNING: Do Not Manually Modify This Property**

The `Ignore Recurring` property is automatically managed by the system when you use the "Duplicate recurring instance" feature. Never manually add, change, or remove this property — doing so may break the recurring event generation logic.

## Frontmatter Display

Show extra frontmatter properties inside event chips (scrollable when space is tight).

- **Display properties (timed events)**: comma-separated list of properties to show in timed event chips (e.g., `status, priority, project, tags`). Shown in weekly and daily views, hidden in monthly view.
- **Display properties (all-day events)**: comma-separated list of properties to show in all-day event chips (can differ from timed events). Shown in weekly and daily views, hidden in monthly view.
- **Display properties (untracked events)**: comma-separated list of properties to show in the untracked events dropdown (e.g., `status, priority, category`)

Rendered example inside a chip:

```
Meeting with Team
status: In Progress
priority: High
project: Q4 Planning
```

**See Also**: [Untracked Events documentation](../features/events/untracked-events.md) for details on the untracked events dropdown

## Always Include Date and Time Properties

Prisma Calendar automatically ensures that both date and time properties are always present in event frontmatter, regardless of whether the event is all-day or timed. This makes it easy to convert between all-day and timed events by manually editing the frontmatter.

**For all-day events:**
- The `Date` property contains the date (e.g., `2025-02-15`)
- The `Start` and `End` properties are empty strings
- The `All Day` property is `true`

**For timed events:**
- The `Start` and `End` properties contain the full datetime (e.g., `2025-02-15T09:00:00`)
- The `Date` property is an empty string by default
- The `All Day` property is `false` (or unset)

**Benefits:**
- **Easy conversion**: Change an all-day event to timed by adding values to `Start`/`End` and setting `All Day: false`
- **Consistent structure**: All events have the same property structure, making templates and scripts easier to write
- **No missing properties**: You can always reference `Date`, `Start`, or `End` without checking if they exist

**Example - All-day event:**
```yaml
---
Title: Holiday
Date: 2025-12-25
Start:
End:
All Day: true
---
```

**Example - Timed event:**
```yaml
---
Title: Meeting
Date:
Start: 2025-02-15T09:00:00
End: 2025-02-15T10:30:00
All Day: false
---
```

## Sorting Normalization for External Tools

**Important**: The `All Day` property is the **source of truth** for event type. Prisma uses this property to determine how to parse the event:
- `All Day: true` → Uses `Date` property, ignores `Start`/`End`
- `All Day: false` (or unset) → Uses `Start`/`End` properties

**Sorting normalization strategy:**

When a sorting normalization strategy is enabled in Properties Settings, Prisma writes a normalized datetime to a dedicated `Sort Date` property. This allows external tools (Bases, Dataview, Obsidian search) to sort all event types — both timed and all-day — by a single field.

The `Sort Date` property is separate from the `Date` property used by all-day events. This avoids conflicts between the all-day event date and the normalized sorting value.

**Normalization modes:**

| Mode | Timed events | All-day events |
|------|-------------|----------------|
| **None** (default) | — | — |
| **Timed only — start** | Start datetime → Sort Date | — |
| **Timed only — end** | End datetime → Sort Date | — |
| **All-day only** | — | Date + `T00:00:00` → Sort Date |
| **All events — start** (recommended) | Start datetime → Sort Date | Date + `T00:00:00` → Sort Date |
| **All events — end** | End datetime → Sort Date | Date + `T00:00:00` → Sort Date |

All datetime values are written without the `.000Z` suffix. All-day events get `T00:00:00` appended so they sort consistently alongside timed events.

**Sort date property:**

The property name defaults to `Sort Date`. Change it in the "Sort date property" setting if you prefer a different name.

**Important**: For Bases views to sort events correctly by this property, the `Sort Date` property must be configured as a **Date & time** property type in Obsidian's property settings. If it is set to "Text" or another type, Bases will sort alphabetically instead of chronologically. To fix this, open Obsidian Settings → Properties and change the type of `Sort Date` to "Date & time", or add `"Sort Date": "datetime"` to your `.obsidian/types.json` file.

**Migration from previous versions:**

In earlier versions, date normalization wrote directly to the `Date` property, which conflicted with the all-day event date. If you previously used the `Date` property for sorting timed events in Bases or Dataview queries, enable the sorting normalization strategy (recommended: "All events — start datetime") and update your queries to sort by `Sort Date` instead of `Date`.

## Auto-mark Past Events

When enabled in [General settings](./general), Prisma Calendar will automatically update the status property of past events during startup:

- **For all-day events**: Checks if the date is in the past
- **For timed events**: Checks if the end date/time is in the past
- **Runs asynchronously**: Doesn't block the calendar from loading
- **Smart updates**: Only writes to files when the status needs to be changed

Example behavior:

```yaml
---
Start: 2025-01-10T14:00
End: 2025-01-10T15:00
STATUS: In Progress
---
```

After the end time passes, Prisma Calendar will automatically update it to:

```yaml
---
Start: 2025-01-10T14:00
End: 2025-01-10T15:00
STATUS: Done
---
```
