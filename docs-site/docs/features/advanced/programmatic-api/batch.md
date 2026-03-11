# Batch Operations

:::info Pro Feature
The Programmatic API requires [Prisma Calendar Pro](../../free-vs-pro.md).
:::

Batch operations apply a single action to multiple events at once. They execute as a single undoable command — one **Ctrl+Z** reverts the entire batch.

## `batchMarkAsDone(input)`

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

## `batchMarkAsUndone(input)`

Marks multiple events as not done.

**Input:**

| Property     | Type     | Required | Description              |
| ------------ | -------- | -------- | ------------------------ |
| `filePaths`  | string[] | yes      | Paths to the event files |
| `calendarId` | string   | no       | Target calendar ID       |

**Returns:** `Promise<boolean>`

## `batchDelete(input)`

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

## `batchToggleSkip(input)`

Toggles skip status on multiple events.

**Input:**

| Property     | Type     | Required | Description              |
| ------------ | -------- | -------- | ------------------------ |
| `filePaths`  | string[] | yes      | Paths to the event files |
| `calendarId` | string   | no       | Target calendar ID       |

**Returns:** `Promise<boolean>`
