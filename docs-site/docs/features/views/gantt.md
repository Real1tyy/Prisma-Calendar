---
sidebar_label: Gantt
---

# Gantt View

:::info Pro Feature
The Gantt tab requires [Prisma Calendar Pro](../free-vs-pro.md).
:::

import useBaseUrl from "@docusaurus/useBaseUrl";

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/GanttView.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/GanttView.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

The Gantt tab renders all events as horizontal bars on a date timeline, with dependency arrows between prerequisite pairs.

## Prerequisites

Events must have the Prerequisite property configured. See [Properties](../../configuration/properties.md) for setup. The property stores wiki-links to other event notes (e.g. `[[Team Meeting]]`).

## Toolbar

The toolbar sits above the chart and contains navigation, event creation, and filtering controls.

### Navigation

- **« / ‹ buttons**: Move the viewport back by one month or one week.
- **Today button**: Centers the chart on the current date.
- **› / » buttons**: Move the viewport forward by one week or one month.
- **Drag to pan**: Left-click and drag anywhere on the canvas to scroll horizontally and vertically.

### Create Button

Click **Create** to open the event creation modal directly from the Gantt view.

### Filtering and Search

The Gantt toolbar includes the same filter bar available in all views — filter preset dropdown, expression filter, and search bar. See [Rules & Filters](../organization/filtering.md) for details on filtering syntax and presets.

## Context Menu

Right-click any bar to open the context menu. The menu is fully customizable — reorder items, rename labels, change icons, and show/hide actions. See [Context Menu](../../configuration/toolbar-and-menus.md#context-menu) for customization details.

### Bar Context Menu

| Action | Description |
|--------|-------------|
| **Enlarge** | Opens the event preview modal. |
| **Edit event** | Opens the event edit modal. |
| **Open file** | Opens the event's note in the editor. |
| **Open file in new window** | Opens the event's note in a new Obsidian window. |
| **Mark as done** | Toggles the event's done status. Shows "Mark as undone" if already done. |
| **Skip event** | Toggles the event's skip status. |
| **Assign prerequisites** | Enters prerequisite selection mode — click another bar on the chart to assign it as a prerequisite. Press **Escape** or click **Cancel** to exit. |
| **Assign categories** | Opens the category assignment modal. |
| **Duplicate** | Creates a copy of the event. |
| **Delete event** | Deletes the event. |

### Arrow Context Menu

Right-click any dependency arrow to see the connection it represents (e.g. "Remove: Event A → Event B"). Clicking the item removes that prerequisite relationship.

## Click to Preview

Click any bar to open the event preview modal with full event details.

## Colors

Bars are colored using the same [Color Rules](../organization/color-rules.md) as the calendar view. Integration events (CalDAV, ICS) use their configured integration color.

## Layout

The chart fills the full height of the tab. Events from independent prerequisite chains are packed into shared rows when their time ranges don't overlap, keeping the layout compact. Within a chain, dependent events are always placed below their prerequisites.

Bar width reflects the event's title length with padding, capped at a maximum width. Long event titles word-wrap inside the bar.

## Live Updates

The Gantt view updates automatically when events, prerequisites, or settings change — new bars appear, dependency arrows adjust, and color rule changes are reflected immediately without switching tabs.

## Performance

Prerequisite relationships are tracked incrementally — when you add, edit, or delete an event, only that event's prerequisites are updated instead of rebuilding the entire dependency graph. This keeps the Gantt tab responsive even with large vaults.
