---
sidebar_label: Daily + Stats
---

import useBaseUrl from "@docusaurus/useBaseUrl";

# Daily + Stats

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/DailyStatsView.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/DailyStatsView.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

A two-column resizable layout with a daily calendar on the left and live statistics on the right.

## Daily Calendar (Left Column)

A simplified daily calendar (timeGridDay view) with prev/next/today toolbar buttons and a search filter. Shows the same event rendering, colors, icons, and context menus as the main calendar. Supports drag-and-drop rescheduling, click-to-open, hover preview, and date/time selection to create new events.

## Statistics Panel (Right Column)

Daily statistics for the date shown in the adjacent calendar. Updates when you navigate to a different day and whenever the underlying events for that day change (see [Live updates](#live-updates) below).

- **Controls row**: "Include skipped events" checkbox and a "Group by" toggle (Event Name / Category).
- **Date label**: Shows the current day (e.g., "Wednesday, Mar 18, 2026").
- **Duration stat**: Total tracked time for the day. Click to toggle between formatted (2h 30m) and decimal (2.5h) display.
- **Event count**: Number of events for the day.
- **Pie chart**: Visual distribution of time across events or categories.
- **Table**: Paginated breakdown of each entry with name, duration, percentage, and event count. Navigate pages with First/Prev/Next/Last buttons or type a page number directly.
- **Capacity label** (when enabled): Shows used vs total hours and remaining time for the day. Boundaries are inferred from your earliest and latest events. See [Capacity Tracking](./capacity-tracking.md).

## Filtering by legend

Click any label in the pie-chart legend to hide that entry from the totals. The slice disappears from the chart, the corresponding row disappears from the table, and every remaining percentage (chart, tooltip, and table) rescales to 100% over what is left. The duration and event-count stats above the chart recompute over the visible entries only.

Click the legend label a second time to bring the entry back. While at least one entry is hidden, a **Show all** button appears next to the totals — click it to reset the filter in one step. Changing the day, the **Group by** mode, or the **Include skipped** toggle also clears the filter.

## Live updates

Totals, charts, tables, and capacity refresh automatically when vault events affecting the visible day change — for example after drag-and-drop in the daily calendar, editing frontmatter in another pane, deleting a note, or when recurring previews update. You do not need to leave and return to the tab to see fresh numbers.

## Navigation

- **Keyboard**: Use **Left/Right arrow keys** to navigate between days. Works immediately when the tab is active — no click needed.
- **Resizable split**: Drag the vertical divider between columns to adjust how much width each side gets. Your preference persists per calendar.
