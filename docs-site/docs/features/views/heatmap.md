---
sidebar_label: Heat Map
---

# Heat Map (Pro)

import useBaseUrl from "@docusaurus/useBaseUrl";

:::info Pro Feature
The Heat Map tab requires [Prisma Calendar Pro](../free-vs-pro.md).
:::

A GitHub-style contribution heatmap showing event density over time. See patterns, streaks, and activity density at a glance — then click any day to drill into its events.

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/HeatmapView.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/HeatmapView.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

## View Modes

Toggle between two modes using the buttons in the header:

- **Yearly**: Shows all 365 days of a year in a compact grid. Day labels (Mon, Wed, Fri) appear on the left, month labels (Jan, Feb, ...) appear along the top.
- **Monthly**: Shows one month at a time with larger cells and day numbers (1–31) inside each cell. Full day-of-week headers are displayed.

Your mode selection is preserved as you navigate.

## Navigation

- **← / → buttons**: Move backward/forward by one year (yearly mode) or one month (monthly mode).
- **Now button**: Jump to the current year or month.
- **Keyboard (no cell selected)**: Press **Left/Right arrow keys** to move between time periods — works immediately when the tab is active.
- **Keyboard (cell selected)**: Click any cell to select it, then use **Arrow keys** to move between cells. Navigation wraps: moving down past the last row continues at the top of the next column, and vice versa. Click the same cell again to deselect and return to interval navigation.
- **Header label**: Shows the current year (yearly) or "Month Year" (monthly) so you always know where you are.

## Color Intensity

The heatmap uses a 5-level color gradient based on event count quartiles:

| Level | Meaning |
|-------|---------|
| Empty | No events — neutral border color |
| 1 | Low activity (up to 25th percentile) |
| 2 | Below average (25th–50th percentile) |
| 3 | Above average (50th–75th percentile) |
| 4 | High activity (above 75th percentile) |

When a category color is set, the gradient is tinted with that color at varying opacities. Without a category color, it uses the classic green gradient.

A **legend** at the bottom shows the color scale from "Less" to "More".

## Day Detail Panel

Click any day cell to open the detail panel below the heatmap. It shows:

- **Date header**: The selected date and total event count.
- **Event list**: Every event for that day, each row showing:
  - **Time**: Displayed as "2:30 PM" for timed events, or "All day" for all-day events.
  - **Title**: The event name.
  - **Color tint**: Each row is tinted with the event's resolved color so you can visually identify categories.
  - **Frontmatter properties**: If configured via the `Display properties (heatmap)` setting, additional properties appear below the title (e.g., status, priority, project).
- **Click an event** to open its file in the editor.
- **Ctrl/Cmd + hover** to see a backlink preview.

## Week Layout

The first day of the week follows your calendar's **First day of week** setting (Settings → General). If set to Monday, Monday appears in the leftmost column; if Sunday, Sunday does.

## Events Modal Heatmap

The heatmap is also available inside the events modal, giving you a quick density overview without leaving the event view.

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/HeatmapViewForEvents.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/HeatmapViewForEvents.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

## Command

Use **Show all events heatmap** (`Prisma Calendar: Show all events heatmap`) to switch directly to the Heat Map tab from anywhere.

The Heat Map is also available as a toolbar button (not enabled by default — add it via Settings → Toolbar).
