# Programmatic API

:::info Pro Feature
The Programmatic API requires [Prisma Calendar Pro](../free-vs-pro.md).
:::

import useBaseUrl from "@docusaurus/useBaseUrl";

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video
    controls
    autoPlay
    loop
    muted
    playsInline
    style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}
  >
    <source src={useBaseUrl("/video/ProgrammaticCreation.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

Prisma Calendar exposes a scripting API on `window.PrismaCalendar` that lets you query events, modify calendars, and automate workflows from external scripts, plugins, or the Obsidian console. This enables full calendar scriptability for Templater scripts, Dataview integration, QuickAdd macros, and cross-plugin workflows.

## Overview

The API is available on `window.PrismaCalendar` when Prisma Calendar is loaded and enabled. It exposes a license status check, read operations, write operations, status commands, batch operations, and calendar metadata as JavaScript functions you can call programmatically. The `isPro()` method is available to all users; other methods require an active Pro license.

**Use cases:**

- Query events by date range, file path, or category
- Create, edit, and delete events from custom scripts or Templater
- Mark events as done/undone or toggle skip status programmatically
- Batch-process multiple events in a single undoable operation
- Clone or move events with time offsets
- Get calendar statistics for dashboards and reports
- Integrate with other plugins (e.g., Dataview, QuickAdd, Templater)
- Automate workflows via URL protocol from external apps

## License Status

### `isPro()`

Returns whether the current installation has an active Pro license. Available to both free and Pro users — use this to conditionally enable Pro-only logic in your scripts.

**Returns:** `boolean` — `true` if Pro is active, `false` otherwise.

**Example:**

```javascript
if (window.PrismaCalendar.isPro()) {
  // Use Pro API features
  const stats = await window.PrismaCalendar.getStatistics();
  console.log(stats.totalDurationFormatted);
} else {
  console.log("Pro features not available");
}
```

## Modal Methods

### `openCreateEventModal(options?)`

Opens the create event modal (same as the "Create new event" command).

**Options:**

| Property              | Type    | Default | Description                                                             |
| --------------------- | ------- | ------- | ----------------------------------------------------------------------- |
| `calendarId`         | string? | —       | Target calendar ID. Uses last opened calendar if omitted.               |
| `autoStartStopwatch` | boolean | `false` | Auto-start the stopwatch when the modal opens.                         |
| `openCreatedInNewTab`| boolean | `false` | Open the newly created note in a new tab and focus it after creation.   |

**Example:**

```javascript
window.PrismaCalendar.openCreateEventModal({ autoStartStopwatch: true });
```

### `openEditActiveNoteModal(options?)`

Opens the edit modal for the currently active note (same as "Edit current note as event"). Ensures the note has a ZettelID first.

**Options:**

| Property     | Type   | Description                                       |
| ------------ | ------ | ------------------------------------------------- |
| `calendarId` | string?| Target calendar ID. Uses last opened if omitted.  |

**Returns:** `Promise<boolean>` — `true` if the modal opened, `false` otherwise (e.g., no file open, file outside calendar directory).

**Example:**

```javascript
const opened = await window.PrismaCalendar.openEditActiveNoteModal();
```

### `createUntrackedEvent(input)`

Creates a Prisma note with ZettelID and no date properties (same as "Create new untracked event").

**Input:**

| Property     | Type   | Required | Description            |
| ------------ | ------ | -------- | ---------------------- |
| `title`      | string | yes      | Event name             |
| `calendarId` | string | no       | Target calendar ID     |

**Returns:** `Promise<string | null>` — File path of the created note, or `null` if creation failed.

**Example:**

```javascript
const path = await window.PrismaCalendar.createUntrackedEvent({ title: "Quick capture" });
```

### `createEvent(input)`

Creates a tracked event with full frontmatter.

**Input:**

| Property     | Type           | Required | Description                                      |
| ------------ | -------------- | -------- | ------------------------------------------------ |
| `title`      | string         | yes      | Event name                                       |
| `start`      | string         | no       | ISO datetime for start (e.g. `2025-02-14T09:00:00`) |
| `end`        | string         | no       | ISO datetime for end                            |
| `allDay`     | boolean        | no       | All-day event                                    |
| `categories` | string[]       | no       | Category values                                  |
| `location`   | string         | no       | Location                                         |
| `participants`| string[]      | no       | Participants                                     |
| `markAsDone` | boolean        | no       | Set status to done                               |
| `skip`       | boolean        | no       | Mark as skipped                                  |
| `calendarId` | string         | no       | Target calendar ID                               |
| `frontmatter`| object         | no       | Additional frontmatter properties                |

Omit `start` for an untracked event.

:::tip Datetime format
Datetime strings are automatically normalized to the internal `.000Z` suffix format. You can pass any of these — they are all equivalent:
- `"2025-02-14T09:00:00.000Z"` (full format)
- `"2025-02-14T09:00:00"` (no suffix)
- `"2025-02-14T09:00"` (no seconds)
:::

**Returns:** `Promise<string | null>` — File path of the created note, or `null` if creation failed.

**Example:**

```javascript
const path = await window.PrismaCalendar.createEvent({
  title: "Meeting",
  start: "2025-02-14T09:00:00",
  end: "2025-02-14T10:00:00",
  categories: ["Work"]
});
```

### `editEvent(input)`

Edits an existing event's frontmatter properties by file path.

**Input:**

| Property     | Type           | Required | Description                                      |
| ------------ | -------------- | -------- | ------------------------------------------------ |
| `filePath`   | string         | yes      | Path to the event file to edit                   |
| `title`      | string         | no       | New event name                                   |
| `start`      | string         | no       | New ISO datetime for start                       |
| `end`        | string         | no       | New ISO datetime for end                         |
| `allDay`     | boolean        | no       | Set all-day flag                                 |
| `categories` | string[]       | no       | New category values                              |
| `location`   | string         | no       | New location                                     |
| `participants`| string[]      | no       | New participants                                 |
| `markAsDone` | boolean        | no       | Set status to done                               |
| `skip`       | boolean        | no       | Mark as skipped                                  |
| `calendarId` | string         | no       | Target calendar ID                               |
| `frontmatter`| object         | no       | Additional frontmatter properties                |

Only include fields that should change — omitted fields are left unchanged.

**Returns:** `Promise<boolean>` — `true` if the edit succeeded, `false` otherwise (e.g., file not found).

**Example:**

```javascript
const ok = await window.PrismaCalendar.editEvent({
  filePath: "Calendar/240101120000 Meeting.md",
  start: "2025-02-14T10:00:00",
  end: "2025-02-14T11:00:00",
  categories: ["Work"]
});
```

### `deleteEvent(input)`

Deletes an event by file path (moves to trash).

**Input:**

| Property     | Type   | Required | Description                    |
| ------------ | ------ | -------- | ------------------------------ |
| `filePath`   | string | yes      | Path to the event file to delete |
| `calendarId` | string | no       | Target calendar ID             |

**Returns:** `Promise<boolean>` — `true` if the deletion succeeded, `false` otherwise (e.g., file not found).

**Example:**

```javascript
const ok = await window.PrismaCalendar.deleteEvent({
  filePath: "Calendar/240101120000 Meeting.md"
});
```

### `convertFileToEvent(input)`

Converts an existing file to Prisma format: ensures ZettelID and updates frontmatter (same as "Add ZettelID to current note" but for any file by path).

**Input:**

| Property     | Type     | Required | Description                    |
| ------------ | -------- | -------- | ------------------------------ |
| `filePath`   | string   | yes      | Path to the note to convert    |
| `calendarId` | string?  | no       | Target calendar ID            |
| `title`      | string?  | no       | Override title                |
| `start`      | string?  | no       | Set start datetime            |
| `end`        | string?  | no       | Set end datetime              |
| `allDay`     | boolean? | no      | Set all-day flag              |
| `categories` | string[]?| no       | Set categories                |
| `location`   | string?  | no       | Set location                  |
| `participants`| string[]?| no      | Set participants              |
| `markAsDone` | boolean? | no      | Set status to done            |
| `skip`       | boolean? | no      | Mark as skipped               |
| `frontmatter`| object?  | no       | Additional frontmatter        |

**Returns:** `Promise<boolean>` — `true` if conversion succeeded, `false` otherwise (e.g., file not found).

**Example:**

```javascript
const ok = await window.PrismaCalendar.convertFileToEvent({
  filePath: "Notes/MyNote.md",
  start: "2025-02-14T09:00:00",
  end: "2025-02-14T10:00:00"
});
```

### `addZettelIdToActiveNote(options?)`

Adds ZettelID to the currently active note (same as "Add ZettelID to current note").

**Options:**

| Property     | Type   | Description                  |
| ------------ | ------ | ---------------------------- |
| `calendarId` | string?| Target calendar ID           |

**Returns:** `Promise<boolean>` — `true` if ZettelID was added or already present, `false` otherwise.

**Example:**

```javascript
const ok = await window.PrismaCalendar.addZettelIdToActiveNote();
```

### `navigateToDate(input)`

Opens the calendar and navigates to a specific date and view type.

**Input:**

| Property     | Type   | Required | Description                                                                 |
| ------------ | ------ | -------- | --------------------------------------------------------------------------- |
| `date`       | string | no       | ISO date or datetime to navigate to (e.g. `2026-02-24`). Defaults to today. |
| `view`       | string | no       | View type: `dayGridMonth`, `timeGridWeek`, `timeGridDay`, or `listWeek`.    |
| `calendarId` | string | no       | Target calendar ID                                                          |

**Returns:** `Promise<boolean>` — `true` if the calendar was opened and navigated, `false` otherwise.

**Example:**

```javascript
// Open weekly view for a specific date
await window.PrismaCalendar.navigateToDate({
  date: "2026-03-01",
  view: "timeGridWeek"
});

// Open today in daily view
await window.PrismaCalendar.navigateToDate({ view: "timeGridDay" });

// Open monthly view (defaults to today)
await window.PrismaCalendar.navigateToDate({ view: "dayGridMonth" });
```

## Query Methods

### `getEvents(input)`

Returns events in a date range (including virtual recurring instances).

**Input:**

| Property     | Type   | Required | Description                              |
| ------------ | ------ | -------- | ---------------------------------------- |
| `start`      | string | yes      | ISO datetime for range start             |
| `end`        | string | yes      | ISO datetime for range end               |
| `calendarId` | string | no       | Target calendar ID                       |

**Returns:** `Promise<PrismaEventOutput[]>`

**Example:**

```javascript
const events = await window.PrismaCalendar.getEvents({
  start: "2026-02-24T00:00:00",
  end: "2026-03-01T00:00:00"
});
console.log(`Found ${events.length} events this week`);
```

### `getEventByPath(input)`

Looks up a single event by file path (checks both tracked and untracked events).

**Input:**

| Property     | Type   | Required | Description          |
| ------------ | ------ | -------- | -------------------- |
| `filePath`   | string | yes      | Path to the event file |
| `calendarId` | string | no       | Target calendar ID   |

**Returns:** `PrismaEventOutput | null`

**Example:**

```javascript
const event = window.PrismaCalendar.getEventByPath({
  filePath: "Calendar/260224090000 Team Meeting.md"
});
if (event) console.log(event.title, event.start);
```

### `getAllEvents(input?)`

Returns all tracked and untracked events in the calendar.

**Input:**

| Property     | Type   | Required | Description        |
| ------------ | ------ | -------- | ------------------ |
| `calendarId` | string | no       | Target calendar ID |

**Returns:** `PrismaEventOutput[]`

**Example:**

```javascript
const all = window.PrismaCalendar.getAllEvents();
console.log(`Total events: ${all.length}`);
```

### `getCategories(input?)`

Returns all categories with their resolved colors.

**Input:**

| Property     | Type   | Required | Description        |
| ------------ | ------ | -------- | ------------------ |
| `calendarId` | string | no       | Target calendar ID |

**Returns:** `PrismaCategoryOutput[]` — each with `name` and `color`.

**Example:**

```javascript
const categories = window.PrismaCalendar.getCategories();
categories.forEach(c => console.log(`${c.name}: ${c.color}`));
```

### `getUntrackedEvents(input?)`

Returns only untracked events (events without date properties).

**Input:**

| Property     | Type   | Required | Description        |
| ------------ | ------ | -------- | ------------------ |
| `calendarId` | string | no       | Target calendar ID |

**Returns:** `PrismaEventOutput[]`

**Example:**

```javascript
const untracked = window.PrismaCalendar.getUntrackedEvents();
console.log(`${untracked.length} events without dates`);
```

### Event output shape

All query methods return events in this shape:

| Property       | Type                              | Description                      |
| -------------- | --------------------------------- | -------------------------------- |
| `filePath`     | string                            | Path to the event file           |
| `title`        | string                            | Event name                       |
| `type`         | `"timed"` \| `"allDay"` \| `"untracked"` | Event type               |
| `start`        | string?                           | ISO start datetime               |
| `end`          | string?                           | ISO end datetime (timed only)    |
| `allDay`       | boolean                           | Whether it's an all-day event    |
| `isVirtual`    | boolean                           | Whether it's a virtual recurring instance |
| `skipped`      | boolean                           | Whether the event is skipped     |
| `color`        | string?                           | Resolved color                   |
| `categories`   | string[]?                         | Category values                  |
| `location`     | string?                           | Location                         |
| `participants` | string[]?                         | Participants                     |
| `status`       | string?                           | Status value (e.g., done/undone) |
| `icon`         | string?                           | Event icon                       |
| `rruleType`    | string?                           | Recurrence rule type             |
| `rruleId`      | string?                           | Recurrence rule ID               |
| `instanceDate` | string?                           | Instance date for recurring events |

## Status Methods

### `markAsDone(input)`

Marks an event as done using the configured status property.

**Input:**

| Property     | Type   | Required | Description          |
| ------------ | ------ | -------- | -------------------- |
| `filePath`   | string | yes      | Path to the event file |
| `calendarId` | string | no       | Target calendar ID   |

**Returns:** `Promise<boolean>`

**Example:**

```javascript
await window.PrismaCalendar.markAsDone({
  filePath: "Calendar/260224090000 Workout.md"
});
```

### `markAsUndone(input)`

Marks an event as not done using the configured status property.

**Input:**

| Property     | Type   | Required | Description          |
| ------------ | ------ | -------- | -------------------- |
| `filePath`   | string | yes      | Path to the event file |
| `calendarId` | string | no       | Target calendar ID   |

**Returns:** `Promise<boolean>`

**Example:**

```javascript
await window.PrismaCalendar.markAsUndone({
  filePath: "Calendar/260224090000 Workout.md"
});
```

### `toggleSkip(input)`

Toggles the skip status of an event.

**Input:**

| Property     | Type   | Required | Description          |
| ------------ | ------ | -------- | -------------------- |
| `filePath`   | string | yes      | Path to the event file |
| `calendarId` | string | no       | Target calendar ID   |

**Returns:** `Promise<boolean>`

**Example:**

```javascript
await window.PrismaCalendar.toggleSkip({
  filePath: "Calendar/260224090000 Weekly Review.md"
});
```

## Lifecycle Methods

### `cloneEvent(input)`

Creates a copy of an event, optionally shifted by a time offset. The clone gets a new ZettelID.

**Input:**

| Property     | Type   | Required | Description                          |
| ------------ | ------ | -------- | ------------------------------------ |
| `filePath`   | string | yes      | Path to the event file to clone      |
| `offsetMs`   | number | no       | Time offset in milliseconds (default: 0) |
| `calendarId` | string | no       | Target calendar ID                   |

**Returns:** `Promise<string | null>` — File path of the cloned event, or `null` on failure.

**Example:**

```javascript
// Clone an event to the same time
const clonedPath = await window.PrismaCalendar.cloneEvent({
  filePath: "Calendar/260224090000 Team Meeting.md"
});

// Clone an event shifted forward by 1 week
const nextWeek = await window.PrismaCalendar.cloneEvent({
  filePath: "Calendar/260224090000 Team Meeting.md",
  offsetMs: 7 * 24 * 60 * 60 * 1000
});
```

### `moveEvent(input)`

Moves an event forward or backward in time by a millisecond offset.

**Input:**

| Property     | Type   | Required | Description                     |
| ------------ | ------ | -------- | ------------------------------- |
| `filePath`   | string | yes      | Path to the event file to move  |
| `offsetMs`   | number | yes      | Time offset in milliseconds (positive = forward, negative = backward) |
| `calendarId` | string | no       | Target calendar ID              |

**Returns:** `Promise<boolean>`

**Example:**

```javascript
// Move an event forward by 1 hour
await window.PrismaCalendar.moveEvent({
  filePath: "Calendar/260224090000 Team Meeting.md",
  offsetMs: 60 * 60 * 1000
});

// Move an event back by 30 minutes
await window.PrismaCalendar.moveEvent({
  filePath: "Calendar/260224090000 Team Meeting.md",
  offsetMs: -30 * 60 * 1000
});
```

## Batch Methods

Batch operations apply a single action to multiple events at once. They execute as a single undoable command — one **Ctrl+Z** reverts the entire batch.

### `batchMarkAsDone(input)`

Marks multiple events as done.

**Input:**

| Property     | Type     | Required | Description              |
| ------------ | -------- | -------- | ------------------------ |
| `filePaths`  | string[] | yes      | Paths to the event files |
| `calendarId` | string   | no       | Target calendar ID       |

**Returns:** `Promise<boolean>`

**Example:**

```javascript
await window.PrismaCalendar.batchMarkAsDone({
  filePaths: [
    "Calendar/260224090000 Task A.md",
    "Calendar/260224100000 Task B.md"
  ]
});
```

### `batchMarkAsUndone(input)`

Marks multiple events as not done.

**Input:**

| Property     | Type     | Required | Description              |
| ------------ | -------- | -------- | ------------------------ |
| `filePaths`  | string[] | yes      | Paths to the event files |
| `calendarId` | string   | no       | Target calendar ID       |

**Returns:** `Promise<boolean>`

### `batchDelete(input)`

Deletes multiple events (moves to trash).

**Input:**

| Property     | Type     | Required | Description              |
| ------------ | -------- | -------- | ------------------------ |
| `filePaths`  | string[] | yes      | Paths to the event files |
| `calendarId` | string   | no       | Target calendar ID       |

**Returns:** `Promise<boolean>`

**Example:**

```javascript
await window.PrismaCalendar.batchDelete({
  filePaths: [
    "Calendar/260224090000 Old Event A.md",
    "Calendar/260224100000 Old Event B.md"
  ]
});
```

### `batchToggleSkip(input)`

Toggles skip status on multiple events.

**Input:**

| Property     | Type     | Required | Description              |
| ------------ | -------- | -------- | ------------------------ |
| `filePaths`  | string[] | yes      | Paths to the event files |
| `calendarId` | string   | no       | Target calendar ID       |

**Returns:** `Promise<boolean>`

## Calendar Info

### `getCalendarInfo(input?)`

Returns metadata about a specific calendar.

**Input:**

| Property     | Type   | Required | Description        |
| ------------ | ------ | -------- | ------------------ |
| `calendarId` | string | no       | Target calendar ID |

**Returns:** `PrismaCalendarInfo | null`

**Example:**

```javascript
const info = window.PrismaCalendar.getCalendarInfo();
console.log(`${info.name}: ${info.eventCount} events`);
```

### `listCalendars()`

Returns metadata for all configured calendars.

**Returns:** `PrismaCalendarInfo[]`

**Example:**

```javascript
const calendars = window.PrismaCalendar.listCalendars();
calendars.forEach(c => console.log(`${c.name} (${c.calendarId}): ${c.eventCount} events`));
```

### Calendar info shape

| Property             | Type    | Description                    |
| -------------------- | ------- | ------------------------------ |
| `calendarId`         | string  | Calendar identifier            |
| `name`               | string  | Display name                   |
| `directory`          | string  | Vault directory for events     |
| `enabled`            | boolean | Whether the calendar is active |
| `eventCount`         | number  | Number of tracked events       |
| `untrackedEventCount`| number  | Number of untracked events     |

### `refreshCalendar(input?)`

Forces a full re-index of the calendar. Clears all caches and rebuilds from disk.

**Input:**

| Property     | Type   | Required | Description        |
| ------------ | ------ | -------- | ------------------ |
| `calendarId` | string | no       | Target calendar ID |

**Example:**

```javascript
window.PrismaCalendar.refreshCalendar();
```

## Statistics

### `getStatistics(input?)`

Returns interval-based statistics with time breakdowns aggregated by event name or category. Uses the same statistics engine as the weekly/monthly stats modals.

**Input:**

| Property     | Type   | Required | Default | Description |
| ------------ | ------ | -------- | ------- | ----------- |
| `date`       | string | no       | today   | ISO date to anchor the interval (e.g. `2026-02-24`) |
| `interval`   | string | no       | `"week"` | `"day"`, `"week"`, or `"month"` — determines the date range |
| `mode`       | string | no       | settings default | `"name"` or `"category"` — how to group time entries |
| `calendarId` | string | no       | —       | Target calendar ID |

**Returns:** `Promise<PrismaStatisticsOutput | null>`

| Property              | Type                | Description |
| --------------------- | ------------------- | ----------- |
| `periodStart`         | string              | ISO start of the resolved interval |
| `periodEnd`           | string              | ISO end of the resolved interval |
| `interval`            | string              | `"day"`, `"week"`, or `"month"` |
| `mode`                | string              | `"name"` or `"category"` |
| `totalDuration`       | number              | Total duration in milliseconds |
| `totalDurationFormatted` | string           | Formatted total (e.g. `"12h 30m"` or `"12.5h"`) |
| `totalEvents`         | number              | Total events in range (non-skipped) |
| `timedEvents`         | number              | Timed events count |
| `allDayEvents`        | number              | All-day events count |
| `skippedEvents`       | number              | Skipped events count |
| `doneEvents`          | number              | Events marked as done |
| `undoneEvents`        | number              | Events marked as not done |
| `entries`             | `PrismaStatEntry[]` | Time breakdown entries (see below) |

**Entry shape:**

| Property           | Type    | Description |
| ------------------ | ------- | ----------- |
| `name`             | string  | Event name or category |
| `duration`         | number  | Duration in milliseconds |
| `durationFormatted`| string  | Formatted duration |
| `percentage`       | string  | Percentage of total (e.g. `"45.3%"`) |
| `count`            | number  | Number of events |
| `isRecurring`      | boolean | Whether the event is recurring |

**Examples:**

```javascript
// Weekly stats for the current week (default)
const stats = await window.PrismaCalendar.getStatistics();
console.log(`This week: ${stats.totalDurationFormatted} tracked`);
stats.entries.forEach(e => console.log(`${e.name}: ${e.durationFormatted} (${e.percentage})`));

// Monthly stats by category for February
const monthly = await window.PrismaCalendar.getStatistics({
  date: "2026-02-01",
  interval: "month",
  mode: "category"
});
console.log(`February: ${monthly.totalEvents} events, ${monthly.doneEvents} done`);

// Daily stats for a specific date
const daily = await window.PrismaCalendar.getStatistics({
  date: "2026-02-24",
  interval: "day"
});
```

## Settings

### `getSettings(input?)`

Returns the full settings object for a calendar. Window-API-only.

**Input:**

| Property     | Type   | Required | Description        |
| ------------ | ------ | -------- | ------------------ |
| `calendarId` | string | no       | Target calendar ID |

**Returns:** `SingleCalendarConfig | null` — the complete settings object.

**Example:**

```javascript
const settings = window.PrismaCalendar.getSettings();
console.log(`Default duration: ${settings.defaultDurationMinutes}m`);
console.log(`Category property: ${settings.categoryProp}`);
```

### `updateSettings(input)`

Updates calendar settings by shallow-merging the provided values into the current settings. The `id` field is stripped to prevent calendar ID corruption. Window-API-only.

**Input:**

| Property     | Type   | Required | Description                              |
| ------------ | ------ | -------- | ---------------------------------------- |
| `settings`   | object | yes      | Partial settings object to merge         |
| `calendarId` | string | no       | Target calendar ID                       |

**Returns:** `Promise<boolean>` — `true` if the update succeeded, `false` otherwise.

**Example:**

```javascript
// Change default event duration
await window.PrismaCalendar.updateSettings({
  settings: { defaultDurationMinutes: 30 }
});

// Toggle decimal hours display
const current = window.PrismaCalendar.getSettings();
await window.PrismaCalendar.updateSettings({
  settings: { showDecimalHours: !current.showDecimalHours }
});
```

## Undo / Redo Support

All API methods that modify files are fully undoable and redoable via **Ctrl+Z** / **Ctrl+Shift+Z** (or the Undo/Redo toolbar buttons). This includes `createEvent`, `editEvent`, `deleteEvent`, `markAsDone`, `markAsUndone`, `toggleSkip`, `cloneEvent`, `moveEvent`, all batch operations, and modal-based operations. Undo reverts frontmatter changes and any file renames (e.g., ZettelID addition), and Redo re-applies them.

Undo and Redo commands are available globally — they work from the command palette regardless of whether the calendar view is focused. The commands automatically resolve the last used calendar.

## URL Protocol Handler

All API actions are also accessible via `obsidian://` URLs, enabling cross-app automation, browser bookmarks, iOS Shortcuts, and integration with external tools. The URL format is:

```
obsidian://prisma-calendar?call=actionName&param1=value1&param2=value2
```

The `call` parameter selects the action. All remaining parameters are passed to that action.

### Examples

**Create an event:**

```
obsidian://prisma-calendar?call=createEvent&title=Meeting&start=2026-02-24T09:00:00&end=2026-02-24T10:00:00&categories=Work
```

**Open the create event modal with stopwatch:**

```
obsidian://prisma-calendar?call=openCreateEventModal&autoStartStopwatch=true
```

**Delete an event by file path:**

```
obsidian://prisma-calendar?call=deleteEvent&filePath=Calendar/240101120000 Meeting.md
```

**Edit an event:**

```
obsidian://prisma-calendar?call=editEvent&filePath=Calendar/240101120000 Meeting.md&start=2026-02-24T10:00:00
```

**Navigate to a date in weekly view:**

```
obsidian://prisma-calendar?call=navigateToDate&date=2026-03-01&view=timeGridWeek
```

**Open today in daily view:**

```
obsidian://prisma-calendar?call=navigateToDate&view=timeGridDay
```

**Open monthly view for a specific month:**

```
obsidian://prisma-calendar?call=navigateToDate&date=2026-06-01&view=dayGridMonth
```

**Get weekly statistics by category:**

```
obsidian://prisma-calendar?call=getStatistics&date=2026-02-24&interval=week&mode=category
```

### Parameter encoding

- **Booleans**: use `true` / `false` or `1` / `0`
- **Arrays** (e.g., `categories`, `participants`): comma-separated values (e.g., `categories=Work,Personal`)
- **Strings with special characters**: URL-encode as usual (e.g., spaces become `%20`)

### Available URL actions

The following actions are URL-accessible: `openCreateEventModal`, `openEditActiveNoteModal`, `createUntrackedEvent`, `createEvent`, `editEvent`, `deleteEvent`, `convertFileToEvent`, `addZettelIdToActiveNote`, `navigateToDate`, `markAsDone`, `markAsUndone`, `toggleSkip`, `cloneEvent`, `moveEvent`, `refreshCalendar`, and `getStatistics`. The parameters match the corresponding JavaScript API — see the method documentation above.

Read operations (`getEvents`, `getAllEvents`, `getEventByPath`, etc.), settings operations (`getSettings`, `updateSettings`), and batch operations are window-API-only since they return data or accept complex objects that don't serialize well to URL query params.

## Calendar Selection

When `calendarId` is not provided, the API uses:

1. The last opened Prisma calendar
2. Otherwise, the first enabled calendar

Use `calendarId` when you need to target a specific calendar.

## See Also

- [Hotkeys](./hotkeys.md) — The corresponding commands you can assign to hotkeys
- [Untracked Events](../events/untracked-events.md) — How untracked events work
- [ZettelID Naming](../management/zettelid-naming.md) — How ZettelIDs are generated and used
