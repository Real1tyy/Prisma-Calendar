# Programmatic API

Prisma Calendar exposes a scripting API on `window.PrismaCalendar` that lets you create events, open modals, and convert notes from external scripts, plugins, or the Obsidian console. This enables automation, custom workflows, and integration with other Obsidian plugins.

## Overview

The API is available on `window.PrismaCalendar` when Prisma Calendar is loaded and enabled. It mirrors the same capabilities as the hotkey commands but exposes them as JavaScript functions you can call programmatically.

**Use cases:**

- Create events from custom scripts or Templater
- Bulk-create untracked events from a list
- Convert existing notes to Prisma format via automation
- Integrate with other plugins (e.g., dataview, quick-add)
- Open creation/edit modals from hotkey-like workflows outside Obsidian’s command system

## Available Methods

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

### `createUntrackedEvent(title, options?)`

Creates a Prisma note with ZettelID and no date properties (same as "Create new untracked event").

**Arguments:**

- `title` (string) — Event name
- `options.calendarId` (string?) — Target calendar ID

**Returns:** `Promise<string | null>` — File path of the created note, or `null` if creation failed.

**Example:**

```javascript
const path = await window.PrismaCalendar.createUntrackedEvent("Quick capture");
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

## Undo / Redo Support

All API methods that modify files are fully undoable and redoable via **Ctrl+Z** / **Ctrl+Shift+Z** (or the Undo/Redo toolbar buttons). This includes `createEvent`, `createUntrackedEvent`, `convertFileToEvent`, `addZettelIdToActiveNote`, and `openEditActiveNoteModal`. Undo reverts frontmatter changes and any file renames (e.g., ZettelID addition), and Redo re-applies them.

Undo and Redo commands are available globally — they work from the command palette regardless of whether the calendar view is focused. The commands automatically resolve the last used calendar.

## Calendar Selection

When `calendarId` is not provided, the API uses:

1. The last opened Prisma calendar
2. Otherwise, the first enabled calendar

Use `calendarId` when you need to target a specific calendar.

## See Also

- [Hotkeys](./hotkeys.md) — The corresponding commands you can assign to hotkeys
- [Untracked Events](../events/untracked-events.md) — How untracked events work
- [ZettelID Naming](../management/zettelid-naming.md) — How ZettelIDs are generated and used
