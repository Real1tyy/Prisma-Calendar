# Calendar

:::info Pro Feature
The Programmatic API requires [Prisma Calendar Pro](../../free-vs-pro.md).
:::

## `getCalendarInfo(input?)`

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

## `listCalendars()`

Returns metadata for all configured calendars.

**Returns:** `PrismaCalendarInfo[]`

**Example:**

```javascript
const calendars = window.PrismaCalendar.listCalendars();
calendars.forEach(c => console.log(`${c.name} (${c.calendarId}): ${c.eventCount} events`));
```

## Calendar info shape

| Property             | Type    | Description                    |
| -------------------- | ------- | ------------------------------ |
| `calendarId`         | string  | Calendar identifier            |
| `name`               | string  | Display name                   |
| `directory`          | string  | Vault directory for events     |
| `enabled`            | boolean | Whether the calendar is active |
| `eventCount`         | number  | Number of tracked events       |
| `untrackedEventCount`| number  | Number of untracked events     |

## `refreshCalendar(input?)`

Forces a full re-index of the calendar. Clears all caches and rebuilds from disk.

**Input:**

| Property     | Type   | Required | Description        |
| ------------ | ------ | -------- | ------------------ |
| `calendarId` | string | no       | Target calendar ID |

**Example:**

```javascript
window.PrismaCalendar.refreshCalendar();
```
