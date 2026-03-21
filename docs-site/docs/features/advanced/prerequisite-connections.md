---
sidebar_label: Prerequisite Connections
---

# Prerequisite Connections

:::info Pro Feature
Prerequisite Connections requires [Prisma Calendar Pro](../free-vs-pro.md).
:::

Prerequisite Connections makes dependency relationships between events visible directly on the Calendar tab as directed SVG arrows.

## Prerequisites

Events must have the Prerequisite property configured. See [Properties](../../configuration/properties.md) for setup. The property stores wiki-links to other event notes (e.g. `[[Team Meeting]]`).

## Connection Arrows

Toggle arrows on the Calendar tab with the **"Toggle prerequisite connection arrows"** command (bindable to any hotkey via Settings → Hotkeys, or via the header action button).

When active, directed SVG arrows draw from each prerequisite event to its dependent. If a connected event is outside the current view range, a **dashed stub arrow** appears at the left or right calendar edge to indicate a dependency continues off-screen.

Arrows update automatically when you navigate dates, change zoom levels, or scroll the calendar. Connection lines render behind the sticky toolbar, day headers, and all-day section so they never obscure fixed UI elements.

