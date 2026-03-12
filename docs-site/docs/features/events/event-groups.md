# Event Groups

import useBaseUrl from "@docusaurus/useBaseUrl";

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video
    controls
    autoPlay
    loop
    muted
    playsInline
    style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}
  >
    <source src={useBaseUrl("/video/EventGroups.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

Track, group, and analyze related events through the Event Groups system. Events are grouped in three ways — by recurring event rules (automatic), by shared category (automatic), and by shared name with ZettelID stripped (automatic). All perspectives are accessible from a single unified modal.

## Overview

Event Groups gives you:
- **Three grouping strategies** — recurring instances, category-based grouping, and automatic name-based grouping
- **Unified Series Modal** — view all related events from any perspective, switch between tabs
- **Completion tracking** — statistics showing how many past events were completed vs skipped
- **Filter and search** — hide past events, hide skipped events, debounced search by title
- **Color-coded rows** — each event row reflects the event's resolved color from your color rules
- **Smart sorting** — ascending for future events, descending when showing all

## How Events Are Grouped

### 1. Recurring (Automatic)

Events linked by a shared `RRuleID` are automatically part of a recurring series. This includes the source event template and all generated physical instances. See [Recurring Events](./recurring-dsl) for details on setting up recurrence.

### 2. By Category (Automatic)

Events sharing the same category property value are grouped together. If an event has multiple categories (YAML array), it appears in each category's group. This uses the same Category property configured in your calendar settings.

### 3. By Name (Automatic)

Events whose cleaned title (with [ZettelID](../management/zettelid-naming) stripped) matches are automatically grouped. No configuration needed — if you have events named "Morning Routine 20260210123456" and "Morning Routine 20260211134567", they appear together under "Morning Routine". This is useful for tracking recurring activities that aren't formally set up as recurring events.

## The Event Series Modal

The modal determines which tabs to show based on the event's properties:

- **Recurring** tab appears if the event belongs to a recurring series (has an `RRuleID`)
- **By Category** tab appears if the event has one or more categories assigned
- **By Name** tab appears if the event has a name

When multiple tabs are available, they appear in the order above (Recurring first). If only one grouping applies, the modal opens directly into that view with no tab bar.

### Recurring Tab

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video
    controls
    autoPlay
    loop
    muted
    playsInline
    style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}
  >
    <source src={useBaseUrl("/video/EventSeriesModalReaccuring.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

Shows all physical instances of a recurring event series.

**What you see (top to bottom):**
1. **Source title** — clickable header that opens the source recurring event file
2. **Recurrence info** — the recurrence type (daily, weekly, etc.) and days of the week if applicable
3. **Statistics bar** — past events, skipped count, completion percentage
4. **Filter toggles** — "Hide past events" and "Hide skipped events" (both ON by default)
5. **Search** — filter instances by title
6. **Instance list** — each row shows date and title; click to open the note

If the source event has a category, the modal background is tinted with the category color.

### By Category Tab

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video
    controls
    autoPlay
    loop
    muted
    playsInline
    style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}
  >
    <source src={useBaseUrl("/video/EventSeriesModalCategory.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>


Shows all events sharing the same category value.

If the event has **multiple categories**, a category chooser is displayed first — click a category to view its events. A back button lets you return to the chooser. If the event has a **single category**, the event list is shown directly.

**What you see:**
1. **Category name** — header showing the category value
2. **Statistics bar** — same format as other tabs
3. **Filter toggles** — "Hide past events" and "Hide skipped events"
4. **Search** — filter by title
5. **Event list** — color-coded rows

### By Name Tab

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video
    controls
    autoPlay
    loop
    muted
    playsInline
    style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}
  >
    <source src={useBaseUrl("/video/EventSeriesModalNameTab.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

Shows all events whose cleaned title matches.

**What you see:**
1. **Event name** — header showing the cleaned title (ZettelID stripped)
2. **Statistics bar** — same format as other tabs
3. **Filter toggles** — "Hide past events" and "Hide skipped events"
4. **Search** — filter by title
5. **Event list** — color-coded rows

## Modal Features

### Statistics Bar

All tabs display comprehensive statistics computed from the **full unfiltered event list** (filters don't affect the counts).

**First row (main statistics):**
```
Total: 45  •  Past: 32  •  Skipped: 3  •  Completed: 90.6%
```

- **Total** — total number of events in the series
- **Past** — events with a start date before today
- **Skipped** — past events with the Skip property set to true
- **Completed** — percentage of past events that were not skipped: `(past - skipped) / past × 100`

**Second row (time breakdown & frequency):**
```
This year: 28  •  This month: 8  •  This week: 2  •  Frequency: 3.2x/week
```

- **This year** — past events that occurred in the current calendar year
- **This month** — past events that occurred in the current calendar month
- **This week** — past events that occurred in the current calendar week (starting Monday)
- **Frequency** — automatic calculation of how often events occur, displayed in the most appropriate unit:
  - **Daily**: "2.3x/day" (multiple times per day)
  - **Weekly**: "3.5x/week" (several times per week)
  - **Monthly**: "1.2x/month" (roughly monthly)
  - Requires at least 2 past events to calculate

The frequency is calculated by analyzing the time span between the first and last past event and computing the average occurrence rate.

### Filter Toggles

Two toggle filters are available on every tab:

| Filter | Effect |
|--------|--------|
| **Hide past events** | Hides events with a start date before today |
| **Hide skipped events** | Hides events marked as skipped |

The Recurring tab has filters enabled by default (showing future events). The By Category and By Name tabs have filters disabled by default (showing all events).

Filter state is preserved independently per tab — switching between tabs won't reset your filters.

### Smart Sorting

The event list sorts intelligently based on your filter state:
- **Hide past enabled** — ascending order (nearest future event first)
- **Hide past disabled** — descending order (most recent event first)

### Search

Press `Ctrl/Cmd+F` to focus the search input from anywhere in the modal. Type to filter events by title.

- **Debounced** — triggers after 350ms of inactivity
- **Enter** — submits the search immediately
- **Escape** — clears the query (press again to close the modal)

Focus is automatically restored to the search input after the list re-renders.

### Color-Coded Rows

In the By Category and By Name tabs, each event row is color-coded based on the event's resolved color from your [color rules](../organization/color-rules). The row displays a subtle tinted background and a colored left border, matching the colors you see on the calendar itself.

### Event Navigation

Click any event row to open the corresponding note file and close the modal.

## Frontmatter Propagation

You can automatically keep custom frontmatter properties in sync across series members. Propagation is available for both name series and category series.

### Name Series Propagation

When you change a property on one event, the change propagates to all other events sharing the same cleaned title.

**Two mutually exclusive modes:**
- **Auto-propagate** — changes are applied immediately without confirmation
- **Ask before propagating** — a confirmation modal shows the changes before applying

Configure in **Settings → [Your Calendar] → Name series propagation**.

### Category Series Propagation

When you change a property on one event, the change propagates to all other events sharing the same category value.

**Two mutually exclusive modes:**
- **Auto-propagate** — changes are applied immediately without confirmation
- **Ask before propagating** — a confirmation modal shows the changes before applying

Configure in **Settings → [Your Calendar] → Category series propagation**.

### Shared Settings

The **Excluded properties** and **Propagation debounce delay** settings (under "Shared propagation settings") apply to all propagation types: recurring instances, name series, and category series.

Loop prevention ensures that when a change propagates from event A to events B and C, the updates to B and C do not trigger further propagation back to A.

See [Frontmatter Propagation](../../configuration/event-groups#frontmatter-propagation) for full configuration details.

## Events Browser

The **"Events"** button in the calendar toolbar opens the Events Browser — a unified modal that lists all recurring events, category groups, and name-based groups in three tabs.

### Opening the Events Browser

- Click the **"Events"** button in the toolbar (always visible)
- Use the **"Show recurring events"** command (bindable to a hotkey)

### Tabs

| Tab | Content | Click action |
|-----|---------|--------------|
| **Recurring (N)** | All recurring event sources (enabled and disabled) with recurrence type badge and instance count | Opens the Event Series Modal for that recurring event. Ctrl+Click opens the source file. |
| **By Category (N)** | All category-based groups with event count | Opens the Event Series Modal for that category group |
| **By Name (N)** | All name-based groups (2+ events sharing a cleaned title) with event count | Opens the Event Series Modal for that name group |

Each tab label shows the total count of items in parentheses.

### Recurring Tab Features

The Recurring tab includes additional controls:

- **Type filter** — dropdown to filter by recurrence type (Daily, Weekly, Bi-weekly, Monthly, Yearly, etc.)
- **Show disabled only** — toggle to view only disabled recurring events (appears when disabled events exist)
- **Action buttons** per item:
  - **Category** — assign categories to the source event
  - **Nav** — navigate the calendar to the source event's date and highlight it
  - **Disable/Enable** — toggle the recurring event on/off

### Search

A shared search input at the top filters items across whichever tab is active. Press `Ctrl/Cmd+F` to focus search from anywhere in the modal.

### Sorting

A sort dropdown next to the search input lets you control the list order. Available options:

| Sort | Description |
|------|-------------|
| **Count ↓** (default) | Most instances/events first |
| **Count ↑** | Fewest instances/events first |
| **Name A→Z** | Alphabetical ascending |
| **Name Z→A** | Alphabetical descending |

The selected sort applies to all tabs.

## Visualization Options

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video
    controls
    autoPlay
    loop
    muted
    playsInline
    style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}
  >
    <source src={useBaseUrl("/video/TimelineViewSeriesGroups.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

The Event Series Modal includes a footer with multiple visualization options for viewing the current event series.

### Available Views

At the bottom of the Event Series Modal, you'll see four buttons:
- **Table** — Open in Bases table view
- **List** — Open in Bases list view
- **Cards** — Open in Bases card view
- **Timeline** — Open interactive timeline visualization

### Bases Views

Click Table, List, or Cards to open a Bases view filtered to show only events from the current series:
- **Recurring tab** — filters by `RRuleID` property (shows all instances of the recurring event)
- **By Name tab** — filters by `Calendar Title` property using `.contains()` (shows all events with matching names)
- **By Category tab** — filters by your category property using `.contains()` (shows all events in that category)

### What You Get in Bases

The generated Bases view includes:
- **Filtered dataset** — only events from the current series
- **Sorted by date** — descending order (most recent first)
- **Configured columns** — shows your calendar's date property, status property, and any additional properties configured in Bases view settings
- **Editable** — full Bases editing capabilities (inline editing, bulk operations, etc.)

### Timeline View

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video
    controls
    autoPlay
    loop
    muted
    playsInline
    style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}
  >
    <source src={useBaseUrl("/video/TimelineView.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

Click **Timeline** to open an interactive timeline visualization showing all events in the series plotted on a time axis. The modal title clearly indicates the context, such as:
- "Timeline for Recurring - Gym"
- "Timeline for Name - Team Meeting"
- "Timeline for Category - Health"

**Features:**

- **Interactive navigation** — Zoom in/out with mouse wheel, pan by dragging to navigate through time. Use the date navigation bar at the top to jump to a specific year, month, and day — fill in the fields and press Enter or click Go. The timeline centers on the chosen date while preserving your current zoom level. Click Today to jump to the current date
- **Event type distinction** — Timed events have a square dot, while all-day events have a hollow circle dot with a dashed border, making the two types instantly recognizable at a glance
- **Event names** — Each event displays its clean title (with ZettelID and instance dates stripped)
- **Category coloring** — Events are colored based on their category, matching the color rules configured in your calendar settings. This provides instant visual grouping on the timeline
- **Hover tooltips** — Hover over any event to see detailed information in a tooltip, using the same format as the calendar view. For timed events the tooltip shows the time range and duration (e.g., "02:30 PM - 03:45 PM (1h 15m)"), for all-day events it shows the date. The tooltip also displays your configured display properties — using the timed event display properties for timed events and the all-day display properties for all-day events
- **Skipped event indicators** — Skipped events appear faded with a strikethrough title, making gaps in a series immediately visible
- **Current time indicator** — Red line shows the current moment
- **Click to preview** — Click any event to open the event preview modal with full details

The timeline automatically shows all events in the series as labeled points on a time axis. Use the mouse wheel to zoom in for detailed views or zoom out for an overview. Drag the timeline to pan through different time periods.

The timeline is perfect for:
- Visualizing event patterns and frequency
- Seeing gaps in recurring event series
- Understanding event distribution over time
- Identifying clusters of activity

### Heatmap View (Pro)

Click **Heatmap** to open a GitHub-style contribution heatmap showing event density over time. The modal title indicates the context, such as:
- "Heatmap for Recurring - Gym"
- "Heatmap for Name - Team Meeting"
- "Heatmap for Category - Health"

**Features:**

- **Two display modes** — **Yearly** and **Monthly** toggle buttons sit in the header next to the title. Yearly shows a full year as a 7-row x 52-column grid (days of week by weeks), Monthly shows a single month with larger cells and day numbers
- **Navigation** — Use arrow buttons or the **Left/Right arrow keys** to move between years or months. Press **Now** to jump back to the current period. The current period is shown between the arrows
- **Color-coded density** — Cells are colored in 5 quantile buckets from empty to maximum density. For category-scoped views, the gradient uses the category color with varying opacity. For global views, a green gradient is used (matching the GitHub contribution style)
- **Hover tooltips** — Hover over any cell to see the date and event count (e.g., "Mar 11, 2026: 3 events")
- **Click to inspect** — Click any cell to expand a detail panel below the heatmap showing all events for that day. Click an event to open its note
- **Legend** — A 5-level color scale with "Less" and "More" labels helps interpret the density
- **Theme-aware** — Empty cells and labels adapt to your Obsidian theme (light or dark)

The heatmap is also available as a global command via the command palette ("Show all events heatmap"), which displays a heatmap of all events across all series.

The heatmap is a Pro feature. Free users will see an upgrade notice when clicking the button.

### Requirements

The Bases view feature requires:
- Obsidian Bases plugin installed and enabled
- At least one calendar configured in Prisma Calendar settings

The Timeline view and Heatmap view are built-in and require no additional plugins.
