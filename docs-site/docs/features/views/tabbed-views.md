# Tabbed Views

The calendar view features a tab bar in the view header with six tabs. Each tab provides a different perspective on your calendar data. Tabs render lazily — content loads only when you switch to a tab for the first time.

## Calendar

The default tab. Shows the full Prisma Calendar with all views (month, week, day, list), toolbar buttons, filters, batch selection, and keyboard shortcuts — exactly as before.

## Timeline

Displays all events on a horizontal vis-timeline. Navigate by date using the year/month/day inputs, or pan and zoom the timeline directly. Click an event to open its preview.

## Heat Map (Pro)

A GitHub-style contribution heatmap showing event density over time. The tab uses a two-row layout:

- **Top row**: The heatmap visualization with yearly/monthly mode toggle and navigation controls.
- **Bottom row**: Appears when you click a day cell, showing all events for that day with times and frontmatter properties. Each event row is tinted with its resolved color (from color rules or integration color) so you can visually identify categories at a glance.
- **Keyboard navigation**: Use **Left/Right arrow keys** to navigate between years (yearly mode) or months (monthly mode). Works immediately when the tab is active — no click needed.

## Daily + Stats

A two-column resizable layout with a daily calendar on the left and live statistics on the right:

- **Left column — Daily calendar**: A simplified daily calendar (timeGridDay view) with prev/next/today toolbar buttons and a search filter. Shows the same event rendering, colors, icons, and context menus as the main calendar. Supports drag-and-drop rescheduling, click-to-open, hover preview, and date/time selection to create new events.
- **Right column — Statistics panel**: Daily statistics for the date shown in the adjacent calendar. Updates automatically when you navigate to a different day. Contains:
  - **Controls row**: "Include skipped events" checkbox and a "Group by" toggle (Event Name / Category).
  - **Date label**: Shows the current day (e.g., "Wednesday, Mar 18, 2026").
  - **Duration stat**: Total tracked time for the day. Click to toggle between formatted (2h 30m) and decimal (2.5h) display.
  - **Event count**: Number of events for the day.
  - **Pie chart**: Visual distribution of time across events or categories.
  - **Table**: Paginated breakdown of each entry with name, duration, percentage, and event count. Navigate pages with First/Prev/Next/Last buttons or type a page number directly.
  - **Capacity label** (when enabled): Shows used vs total hours and remaining time for the day. Boundaries are inferred from your earliest and latest events. See [Capacity Tracking](./capacity-tracking.md).
- **Keyboard navigation**: Use **Left/Right arrow keys** to navigate between days. Works immediately when the tab is active — no click needed.
- **Resizable**: Drag the divider between columns to adjust the split.

## Dual Daily

A two-column resizable layout with two independent daily calendars side by side. Each calendar has its own toolbar, search filter, and date state — useful for comparing two different days or dragging events between dates.

- **Independent navigation**: Each calendar navigates independently via its own prev/next/today buttons.
- **Keyboard navigation**: Use **Left/Right arrow keys** to navigate the focused calendar. Click anywhere on a calendar to focus it, then arrow keys will move that calendar's date forward or backward. Defaults to the left calendar.
- **Full calendar features**: Both calendars support the same interactions as the Daily + Stats calendar — event rendering, colors, icons, context menus, drag-and-drop, click-to-open, hover preview, and date/time selection.
- **Resizable**: Drag the divider between columns to adjust the split.

## Dashboard

A full-page overview of all events with three collapsible sections — Recurring Events, Categories, and By Name. Each section shows a pie chart distribution alongside a sortable, filterable table with colored rows. See [Dashboard](./dashboard.md) for details.

## Managing Tabs

- **Switch tabs** by clicking a tab in the header bar, or use the `Prisma Calendar: Go to tab` commands.
- **Reorder tabs** by right-clicking a tab and selecting Move left/right, or use the settings gear to open the tab manager.
- **Hide/show tabs** via the tab manager (gear icon) or right-click context menu.
- **Rename tabs** via right-click or the tab manager.

Tab state — active tab, visibility, order, and custom names — persists across sessions.
