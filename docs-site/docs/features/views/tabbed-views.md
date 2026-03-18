# Tabbed Views

The calendar view features a tab bar in the view header with five tabs. Each tab provides a different perspective on your calendar data. Tabs render lazily — content loads only when you switch to a tab for the first time.

## Calendar

The default tab. Shows the full Prisma Calendar with all views (month, week, day, list), toolbar buttons, filters, batch selection, and keyboard shortcuts — exactly as before.

## Timeline

Displays all events on a horizontal vis-timeline. Navigate by date using the year/month/day inputs, or pan and zoom the timeline directly. Click an event to open its preview.

## Heat Map (Pro)

A GitHub-style contribution heatmap showing event density over time. The tab uses a two-row layout:

- **Top row**: The heatmap visualization with yearly/monthly mode toggle and navigation controls.
- **Bottom row**: Appears when you click a day cell, showing all events for that day with times and frontmatter properties.

## Daily + Stats

A two-column layout:

- **Left column**: A simplified daily calendar (timeGridDay view) with basic prev/next/today navigation.
- **Right column**: Daily statistics for the date shown in the adjacent calendar — pie chart distribution and event table. The statistics update automatically when you navigate to a different day.
- **Keyboard navigation**: Use **Left/Right arrow keys** to navigate between days. The tab auto-focuses when opened so keyboard navigation works immediately.

## Dual Daily

A two-column layout with two independent daily calendars side by side. Each calendar navigates independently, useful for comparing two different days.

- **Keyboard navigation**: Use **Left/Right arrow keys** to navigate the focused calendar. Click on a calendar to focus it, then arrow keys will navigate that calendar's date.

## Managing Tabs

- **Switch tabs** by clicking a tab in the header bar, or use the `Prisma Calendar: Go to tab` commands.
- **Reorder tabs** by right-clicking a tab and selecting Move left/right, or use the settings gear to open the tab manager.
- **Hide/show tabs** via the tab manager (gear icon) or right-click context menu.
- **Rename tabs** via right-click or the tab manager.

Tab state — active tab, visibility, order, and custom names — persists across sessions.
