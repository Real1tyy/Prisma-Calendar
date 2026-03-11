# Queries

:::info Pro Feature
The Programmatic API requires [Prisma Calendar Pro](../../free-vs-pro.md).
:::

## `getEvents(input)`

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

## `getEventByPath(input)`

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

## `getAllEvents(input?)`

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

## `getCategories(input?)`

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

## `getUntrackedEvents(input?)`

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

## Event output shape

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
