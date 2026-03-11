# Modals & Navigation

:::info Pro Feature
The Programmatic API requires [Prisma Calendar Pro](../../free-vs-pro.md).
:::

## `openCreateEventModal(options?)`

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

## `openEditActiveNoteModal(options?)`

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

## `createUntrackedEvent(input)`

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

## `addZettelIdToActiveNote(options?)`

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

## `navigateToDate(input)`

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
