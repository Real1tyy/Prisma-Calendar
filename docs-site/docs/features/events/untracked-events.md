# Untracked Events

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
    <source src={useBaseUrl("/video/UntrackedEvents.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

The **Untracked Events Dropdown** is an inbox for events that don't have date properties yet.

## Overview

Events are considered **untracked** when they have **none** of the following properties:
- Start Date
- End Date
- Date

These events won't appear on the calendar but are accessible from the dropdown for easy scheduling.

### Filtering Untracked Events

Filter which untracked events appear using JavaScript expressions in **Settings → Rules & Filters → Untracked Event Filtering**.

- Filters apply when files are indexed
- Events must pass all filter expressions to appear
- Works identically to calendar event filtering
- Changes apply immediately

See [Filtering](../organization/filtering.md) for expression syntax and examples.

## Features

### View Untracked Events

The dropdown appears in the calendar toolbar as an **"Untracked"** button. Click to see all untracked events.

![Untracked Events Dropdown](/img/untracked-dropdown.png)

Each event shows:
- Event title (ZettelID stripped for clean display)
- Configured display properties (frontmatter fields)
- Color coding based on your color rules
- Search bar to filter by title

### Create from Dropdown

A **"+ Create untracked event"** button at the top of the dropdown opens the create modal — identical to the "Create new untracked event" command.

### Drag & Drop — From Dropdown to Calendar

Drag any untracked event from the dropdown onto the calendar to assign it a date:

**Timed events:**
1. Drag event from dropdown
2. Drop on a time slot in week/day view
3. Start time is set to the drop time
4. End time is calculated from default duration (configurable in settings)

**All-day events:**
1. Drag event from dropdown
2. Drop on a day in month view
3. Date property is set and All Day is set to true

### Drag & Drop — From Calendar to Dropdown

Remove dates from calendar events to make them untracked again:

1. **Drop on "Untracked" button** (dropdown closed) — drag any calendar event onto the button
2. **Drop in open dropdown** (dropdown open) — drag any calendar event into the dropdown area

Date properties (Start Date, End Date, Date, All Day) are all cleared.

### Smart Behavior

- **Auto-hide while dragging**: If you hover over the dropdown for over 1 second while dragging, it temporarily hides to unblock the calendar view
- **Stays open after operations**: Dropdown remains open after dropping events, so you can process multiple events without reopening
- **Reactive updates**: Dropdown refreshes automatically when files change

### Undo/Redo Support

All drag & drop operations support full undo/redo. The calendar updates automatically when you undo/redo.

### Display Properties

Configure which frontmatter properties to show in the dropdown:

**Settings → [Your Calendar] → Display Properties → Untracked Events**

Example: `Status, Priority, Project, Tags`

Properties render with proper formatting — links are clickable, lists are comma-separated.

### Color Rules

[Color rules](../organization/color-rules.md) automatically apply to untracked events. Events matching your rules display with the appropriate colors in the dropdown.

### Search

Filter untracked events by typing in the search bar at the top of the dropdown. Searches event titles (case-insensitive), ignores ZettelIDs, and updates instantly.

## Configuration

- **[Configuration Guide](../../configuration.md#parsing)** — Enable/disable, display properties, default duration
- **[Hotkeys](../advanced/hotkeys.md#toggle-untracked-events-dropdown)** — Toggle command and hotkey setup

## Double-Click to Open

Double-click any event in the dropdown to open its note file. Single-click initiates drag, so use double-click to open.
