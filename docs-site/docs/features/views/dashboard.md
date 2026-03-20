# Dashboard (Pro)

import useBaseUrl from "@docusaurus/useBaseUrl";

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/DashboardView.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/DashboardView.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

The Dashboard is a group tab with three subtabs — By Name, By Category, and Recurring — selectable via a dropdown chevron on the tab button. Hovering the button also opens the dropdown. Each subtab uses a two-column grid layout: a pie chart and summary stats with a Top 10 ranking on top, and a full sortable table spanning the bottom.

:::info Pro Feature
The Dashboard tab requires a Pro license. Free users will see a prompt to upgrade when switching to any subtab.
:::

## Subtabs

Click or hover the Dashboard tab button to open a dropdown and select a subtab. Each subtab shows the same grid layout with context-specific data.

### By Name

Groups events by their cleaned name (name-based series). Summary stats show series count, total events, and average events per series. The Top 10 ranking highlights the most frequent series with proportional bars. The table lists all series with event counts. Click any row to open the Event Series Modal for that name group.

### By Category

Lists all categories with total event count, timed vs all-day breakdown, and percentages. Summary stats show category count, total events, timed count, and all-day count. Rows are colored with their assigned category color. The pie chart shows category distribution by event count. Click any row to open the Event Series Modal filtered to that category.

### Recurring

Shows all recurring events (enabled and disabled) with their recurrence type, instance count, category, and status. Summary stats show rule count, enabled/disabled counts, and total instances. The pie chart shows the distribution of recurrence types (Daily, Weekly, Monthly, etc.). Click any row to open the Event Series Modal for that recurring event.

## Layout

Each subtab renders a resizable 2x2 grid:

- **Top-left**: Pie chart showing the distribution at a glance.
- **Top-right**: Summary stat cards followed by a Top 10 ranked list with proportional bars.
- **Bottom** (full width): Sortable, filterable, paginated table with colored rows.

Drag the grid dividers to resize columns and rows.

## Customizing Subtabs

Subtabs can be reordered, renamed, and hidden via the tab manager (gear icon in the tab bar). Expand the Dashboard group to see and manage individual subtabs.

## Features

- **Search/filter**: Each subtab has a filter input to quickly find items by name.
- **Sortable columns**: Click any column header to sort ascending or descending. Default sort is by count (descending).
- **Colored rows**: Category and recurring event rows are tinted with their resolved color for visual identification.
- **Pie charts**: Each subtab includes a distribution pie chart.
- **Top 10 ranking**: A ranked list with proportional bars showing the highest-count items at a glance.
- **Summary stats**: Key metrics displayed as compact cards (e.g., total events, category count, enabled/disabled rules).
- **Pagination**: Tables with more than 20 items are paginated with prev/next controls.
- **Reactive updates**: Each subtab automatically refreshes when events, categories, or recurring events change.
- **Resizable grid**: Drag dividers to adjust the chart/stats vs table proportions.
