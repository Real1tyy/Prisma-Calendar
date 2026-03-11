# Statistics

:::info Pro Feature
The Programmatic API requires [Prisma Calendar Pro](../../free-vs-pro.md).
:::

## `getStatistics(input?)`

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
