# Events

:::info Pro Feature
The Programmatic API requires [Prisma Calendar Pro](../../free-vs-pro.md).
:::

## `createEvent(input)`

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

## `editEvent(input)`

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

## `deleteEvent(input)`

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

## `convertFileToEvent(input)`

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
