---
sidebar_label: Heatmap Monthly + Stats
---

# Heatmap Monthly + Stats (Pro)

:::info Pro Feature
The Heatmap Monthly + Stats tab requires [Prisma Calendar Pro](../free-vs-pro.md).
:::

A two-column resizable layout pairing a month-locked activity heatmap on the left with a live monthly breakdown on the right. Navigate a month on the heatmap and the statistics panel re-aggregates instantly — see both where your time went and when at a glance.

## Monthly Heatmap (Left Column)

The [Heatmap](./heatmap.md) view locked to **monthly mode**. Each day cell is shaded by event density using the same 5-level gradient as the standalone heatmap, and clicking a day opens its detail panel directly below the grid.

- **Prev / Next buttons**: Move backward or forward one month.
- **Now button**: Jump to the current month.
- **Header label**: Shows "Month Year" (e.g., "March 2026") so you always know where you are.
- **Day detail panel**: Click any day cell to list every event for that day — time, title, category tint, and any configured display properties. Click an event row to open its file; Ctrl/Cmd + hover shows a backlink preview.
- **Yearly / Monthly toggle is hidden** on this tab — it's intentionally month-only. For the full yearly view, use the standalone [Heatmap](./heatmap.md) tab.

Color intensity, legend, category tinting, and first-day-of-week behavior all match the standalone Heatmap — see that page for the full reference.

## Statistics Panel (Right Column)

Monthly statistics for the month currently shown on the heatmap. Re-renders automatically whenever the heatmap navigates to a different month.

- **Controls row** (top-right): "Include skipped" checkbox and a "Group by" toggle (Event Name / Category).
- **Date label**: Shows the current month (e.g., "March 2026").
- **Duration stat**: Total tracked time across the month. Click to toggle between formatted (`32h 15m`) and decimal (`32.2h`) display. Defaults follow the **Show decimal hours** global setting.
- **Event count**: Number of events in the month, including every occurrence of a recurring series.
- **Pie chart**: Visual distribution of time across events or categories. In Category mode the slice colors match your configured category colors.
- **Table**: Paginated breakdown of each entry with name, duration, percentage, and event count. Navigate pages with First / Prev / Next / Last buttons or type a page number directly.

### Include skipped

Off by default. When enabled, events marked as **skipped** are merged back into the totals so you can see what the month *would* have looked like with nothing skipped. Useful for retrospectives and capacity reviews.

### Group by: Event Name vs Category

- **Event Name** (default): Groups by the cleaned event title (IDs and dates stripped). Two instances of "Team Meeting" collapse into one entry with `count = 2`.
- **Category**: Groups by the category property configured in **Settings → Event Properties**. Events with multiple categories have their duration split evenly across each category. Events without a category are grouped under "No Category".

The default mode follows your **Default Aggregation Mode** global setting.

## Syncing the Two Panels

The left heatmap is the single source of truth for the current month. Any month navigation — Prev/Next button, Now button, or arrow-key navigation — updates the stats panel on the right.

- Queries run against the live event store, so creating, editing, or deleting an event refreshes both panels automatically.
- Filter presets and expression filters apply only to the heatmap grid (matching the standalone Heatmap's behavior). The statistics panel always reflects the full, unfiltered month.

## Navigation

- **Keyboard (no cell selected)**: Left/Right arrows move between months — works immediately when the tab is active, no click needed.
- **Keyboard (cell selected)**: Click any day to select it, then arrow keys move between day cells inside the month grid.
- **Resizable split**: Drag the vertical divider between columns to adjust how much width each side gets. Your preference persists per calendar.

## See also

- [Heatmap](./heatmap.md) — full heatmap reference (colors, legend, detail panel, properties).
- [Daily + Stats](./daily-stats.md) — the daily analogue of this tab.
- [Tabbed Views](./tabbed-views.md) — how to reorder, hide, or rename tabs.
- [Capacity Tracking](./capacity-tracking.md) — related planning tool.
