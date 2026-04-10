# Programmatic API

:::info Pro Feature
The Programmatic API requires [Prisma Calendar Pro](../../free-vs-pro.md).
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
- Send natural-language AI queries and receive structured JSON responses

## License Status

### `isPro()`

Returns whether the current installation has an active Pro license. Available to both free and Pro users — use this to conditionally enable Pro-only logic in your scripts.

**Returns:** `boolean` — `true` if Pro is active, `false` otherwise.

**Example:**

```javascript
if (window.PrismaCalendar.isPro()) {
  const stats = await window.PrismaCalendar.getStatistics();
  console.log(stats.totalDurationFormatted);
} else {
  console.log("Pro features not available");
}
```

## Calendar Selection

When `calendarId` is not provided, the API uses:

1. The last opened Prisma calendar
2. Otherwise, the first enabled calendar

Use `calendarId` when you need to target a specific calendar.

## Undo / Redo Support

All API methods that modify files are fully undoable and redoable via **Ctrl+Z** / **Ctrl+Shift+Z** (or the Undo/Redo toolbar buttons). This includes `createEvent`, `editEvent`, `deleteEvent`, `markAsDone`, `markAsUndone`, `toggleSkip`, `cloneEvent`, `moveEvent`, `duplicateCurrentEvent`, all batch operations, and modal-based operations. Undo reverts frontmatter changes and any file renames (e.g., ZettelID addition), and Redo re-applies them.

Undo and Redo commands are available globally — they work from the command palette regardless of whether the calendar view is focused. The commands automatically resolve the last used calendar.

## URL Protocol Handler

All API actions are also accessible via `obsidian://` URLs, enabling cross-app automation, browser bookmarks, iOS Shortcuts, and integration with external tools. The URL format is:

```
obsidian://prisma-calendar?call=actionName&param1=value1&param2=value2
```

The `call` parameter selects the action. All remaining parameters are passed to that action.

### Parameter encoding

- **Booleans**: use `true` / `false` or `1` / `0`
- **Arrays** (e.g., `categories`, `participants`): comma-separated values (e.g., `categories=Work,Personal`)
- **Strings with special characters**: URL-encode as usual (e.g., spaces become `%20`)

### URL examples

**Create an event:**

```
obsidian://prisma-calendar?call=createEvent&title=Meeting&start=2026-02-24T09:00:00&end=2026-02-24T10:00:00&categories=Work
```

**Open the create event modal with stopwatch:**

```
obsidian://prisma-calendar?call=openCreateEventModal&autoStartStopwatch=true
```

**Navigate to a date in weekly view:**

```
obsidian://prisma-calendar?call=navigateToDate&date=2026-03-01&view=timeGridWeek
```

**Get weekly statistics by category:**

```
obsidian://prisma-calendar?call=getStatistics&date=2026-02-24&interval=week&mode=category
```

### Available URL actions

The following actions are URL-accessible: `openCreateEventModal`, `openEditActiveNoteModal`, `createUntrackedEvent`, `createEvent`, `editEvent`, `deleteEvent`, `convertFileToEvent`, `addZettelIdToActiveNote`, `duplicateCurrentEvent`, `navigateToDate`, `markAsDone`, `markAsUndone`, `toggleSkip`, `cloneEvent`, `moveEvent`, `refreshCalendar`, `getStatistics`, and `aiQuery`. The parameters match the corresponding JavaScript API — see the method documentation in each sub-page.

Read operations (`getEvents`, `getAllEvents`, `getEventByPath`, etc.), settings operations (`getSettings`, `updateSettings`), and batch operations are window-API-only since they return data or accept complex objects that don't serialize well to URL query params.

## See Also

- [Events](./events.md) — Create, edit, delete, and convert events
- [Queries](./queries.md) — Read events, categories, and untracked events
- [Modals](./modals.md) — Open create/edit modals and navigate
- [Status & Lifecycle](./status.md) — Mark done/undone, skip, clone, move
- [Batch Operations](./batch.md) — Bulk status changes and deletions
- [Calendar](./calendar.md) — Calendar metadata and refresh
- [Statistics](./statistics.md) — Time breakdowns and analytics
- [Settings](./settings.md) — Read and update calendar settings
- [AI](./ai.md) — Natural-language AI queries
