---
sidebar_label: Daily + Stats
---

# Daily + Stats

A two-column resizable layout with a daily calendar on the left and live statistics on the right.

## Daily Calendar (Left Column)

A simplified daily calendar (timeGridDay view) with prev/next/today toolbar buttons and a search filter. Shows the same event rendering, colors, icons, and context menus as the main calendar. Supports drag-and-drop rescheduling, click-to-open, hover preview, and date/time selection to create new events.

## Statistics Panel (Right Column)

Daily statistics for the date shown in the adjacent calendar. Updates automatically when you navigate to a different day.

- **Controls row**: "Include skipped events" checkbox and a "Group by" toggle (Event Name / Category).
- **Date label**: Shows the current day (e.g., "Wednesday, Mar 18, 2026").
- **Duration stat**: Total tracked time for the day. Click to toggle between formatted (2h 30m) and decimal (2.5h) display.
- **Event count**: Number of events for the day.
- **Pie chart**: Visual distribution of time across events or categories.
- **Table**: Paginated breakdown of each entry with name, duration, percentage, and event count. Navigate pages with First/Prev/Next/Last buttons or type a page number directly.
- **Capacity label** (when enabled): Shows used vs total hours and remaining time for the day. Boundaries are inferred from your earliest and latest events. See [Capacity Tracking](./capacity-tracking.md).

## Navigation

- **Keyboard**: Use **Left/Right arrow keys** to navigate between days. Works immediately when the tab is active — no click needed.
- **Resizable**: Drag the divider between columns to adjust the split.
