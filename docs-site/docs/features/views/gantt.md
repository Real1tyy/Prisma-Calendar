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

The Gantt tab renders all events as horizontal bars on a date timeline, with native dependency arrows between prerequisite pairs.

## Prerequisites

Events must have the Prerequisite property configured. See [Properties](../../configuration/properties.md) for setup. The property stores wiki-links to other event notes (e.g. `[[Team Meeting]]`).

## Controls

- **Today button**: Scrolls the chart to the current date.
- Click any bar to open the event preview modal.
- **Drag to pan**: Left-click and drag anywhere on the canvas to scroll horizontally and vertically.

## Colors

Bars are colored using the same [Color Rules](../organization/color-rules.md) as the calendar view. Integration events (CalDAV, ICS) use their configured integration color.

## Layout

The chart fills the full height of the tab. Events from independent prerequisite chains are packed into shared rows when their time ranges don't overlap, keeping the layout compact. Within a chain, dependent events are always placed below their prerequisites.

## Performance

Prerequisite relationships are tracked incrementally — when you add, edit, or delete an event, only that event's prerequisites are updated instead of rebuilding the entire dependency graph. This keeps the Gantt tab responsive even with large vaults.
