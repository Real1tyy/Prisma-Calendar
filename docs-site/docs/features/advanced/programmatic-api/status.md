# Status & Lifecycle

:::info Pro Feature
The Programmatic API requires [Prisma Calendar Pro](../../free-vs-pro.md).
:::

## `markAsDone(input)`

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

## `markAsUndone(input)`

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

## `toggleSkip(input)`

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

## `cloneEvent(input)`

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

## `moveEvent(input)`

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
