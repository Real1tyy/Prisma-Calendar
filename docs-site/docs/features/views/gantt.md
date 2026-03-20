---
sidebar_label: Gantt
---

# Gantt View

:::info Pro Feature
The Gantt tab requires [Prisma Calendar Pro](../free-vs-pro.md).
:::

The Gantt tab renders all events as horizontal bars on a date timeline, with native dependency arrows between prerequisite pairs.

## Prerequisites

Events must have the Prerequisite property configured. See [Properties](../../configuration/properties.md) for setup. The property stores wiki-links to other event notes (e.g. `[[Team Meeting]]`).

## Controls

- **View mode** (Day / Week / Month / Year): Switch the time scale of the chart.
- **Connected only**: When checked, only events that participate in at least one prerequisite relationship are shown.

Click any bar to open the event preview modal.

