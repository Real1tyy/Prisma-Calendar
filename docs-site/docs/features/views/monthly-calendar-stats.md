---
sidebar_label: Monthly + Stats
---

import useBaseUrl from "@docusaurus/useBaseUrl";

# Monthly + Stats

A two-column resizable layout with a month-locked calendar on the left and live monthly statistics on the right. The monthly analogue of [Daily + Stats](./daily-stats.md).

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/MonthlyStatsView.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/MonthlyStatsView.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

## Monthly Calendar (Left Column)

A simplified month calendar (FullCalendar `dayGridMonth` view) with prev/next/today toolbar buttons and a search filter. Shows the same event rendering, colors, icons, and context menus as the main calendar. Supports drag-and-drop rescheduling across days and click-to-open.

Because the left cell is roughly half the usual calendar width, the month grid is constrained horizontally; if the combined height of the six-week grid does not fit the viewport, the cell scrolls vertically rather than crushing day cells into unreadable rows.

## Statistics Panel (Right Column)

Monthly statistics for the month shown in the adjacent calendar. Re-renders automatically whenever the calendar navigates to a different month.

- **Controls row**: "Include skipped events" checkbox and a "Group by" toggle (Event Name / Category).
- **Date label**: Shows the current month (e.g., "March 2026").
- **Duration stat**: Total tracked time for the month. Click to toggle between formatted (`32h 15m`) and decimal (`32.2h`) display.
- **Event count**: Number of events for the month, including every occurrence of a recurring series.
- **Pie chart**: Visual distribution of time across events or categories. In Category mode the slice colors match your configured category colors.
- **Table**: Paginated breakdown of each entry with name, duration, percentage, and event count. Navigate pages with First / Prev / Next / Last buttons or type a page number directly.

### Include skipped

Off by default. When enabled, events marked as **skipped** are merged back into the totals so you can see what the month *would* have looked like with nothing skipped.

### Group by: Event Name vs Category

- **Event Name** (default): Groups by the cleaned event title. Two instances of "Team Meeting" collapse into one row with `count = 2`.
- **Category**: Groups by the category property configured in **Settings → Event Properties**. Events with multiple categories have their duration split evenly across each category. Events without a category group under "No Category".

The default mode follows your **Default Aggregation Mode** global setting.

## Syncing the Two Panels

The left calendar is the single source of truth for the current month. Any navigation — Prev / Next / Today button, keyboard arrows, or a drag that crosses a month boundary — updates the stats panel on the right.

- Queries run against the live event store, so creating, editing, or deleting an event refreshes both panels automatically.
- Drag-and-drop rescheduling on the month grid triggers the same write path as the main Calendar tab.

## Navigation

- **Keyboard**: **Left/Right arrow keys** move between months. Works immediately when the tab is active — no click needed.
- **Resizable split**: Drag the vertical divider between columns to adjust how much width each side gets. Your preference persists per calendar.

## See also

- [Daily + Stats](./daily-stats.md) — the daily analogue of this tab.
- [Heatmap Monthly + Stats](./heatmap-monthly-stats.md) — heatmap variant (Pro). Hidden by default in favor of this view; restore it via the tab manager if you prefer the heatmap aesthetic.
- [Tabbed Views](./tabbed-views.md) — how to reorder, hide, or rename tabs.
