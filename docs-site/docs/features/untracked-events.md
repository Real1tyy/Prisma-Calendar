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

The **Untracked Events Dropdown** provides a convenient way to view and manage events that don't have date properties assigned yet. Think of it as your "inbox" for calendar events.

## Overview

Events are considered **untracked** when they have **none** of the following properties:
- Start Date
- End Date
- Date

These events won't appear on the calendar but are stored in the dropdown for easy access and scheduling.

### Filtering Untracked Events

You can globally filter which untracked events appear in the dropdown using JavaScript expressions:

**Settings → Rules & Filters → Untracked Event Filtering**

**How it works:**
- Filters are applied when files are indexed
- Events must pass all filter expressions to appear in the dropdown
- Works identically to calendar event filtering but only affects untracked events
- Changes apply immediately without triggering full re-indexing

See the [Filtering documentation](./filtering.md) for more details on expression syntax and examples.

## Features

### 📋 View Untracked Events

The dropdown appears in the calendar toolbar as an **"Untracked"** button. Click it to see all your untracked events.

![Untracked Events Dropdown](/img/untracked-dropdown.png)

**What you'll see:**
- Event title (with Zettel ID removed for cleaner display)
- Configured display properties (frontmatter fields you want to show)
- Color coding based on your color rules
- Search bar to filter events by title

### ➕ Create from Dropdown

A **"+ Create untracked event"** button appears at the top of the dropdown. Clicking it closes the dropdown and opens the create modal, identical to using the "Create new untracked event" command from the command palette.

### 🎯 Drag & Drop - From Dropdown to Calendar

Drag any untracked event from the dropdown onto the calendar to assign it a date:

**For timed events:**
 over. Drag event from dropdown
2. Drop on a time slot in week/day view
3. Start time is set to drop time
4. End time is calculated based on default duration (configurable in settings)

**For all-day events:**
1. Drag event from dropdown
2. Drop on a day in month view
3. Date property is set
4. All Day property is set to true

### ↩️ Drag & Drop - From Calendar to Dropdown

Remove dates from calendar events to make them untracked again:

**Two ways to drop:**

1. **Drop on "Untracked" button** (dropdown closed)
   - Drag any calendar event
   - Drop on the "Untracked" button in toolbar
   - Date properties are cleared instantly

2. **Drop in open dropdown** (dropdown open)
   - Open the dropdown first
   - Drag any calendar event
   - Drop anywhere inside the dropdown area
   - Event becomes untracked and appears in the list

**What gets cleared:**
- Start Date → `null`
- End Date → `null`
- Date → `null`
- All Day → `null`

### 🔄 Smart Behavior

**Auto-hide while dragging:**
- If you hover over the dropdown while dragging an event for over **1 second**, it temporarily hides
- This prevents the dropdown from blocking your calendar view
- Reappears automatically when you finish dragging

**Stays open after operations:**
- Dropdown remains open after dropping events
- Allows you to quickly process multiple events without reopening

**Reactive updates:**
- Dropdown automatically refreshes when files change
- Instant updates when events become tracked/untracked
- No manual refresh needed

### ↩️ Undo/Redo Support

All drag & drop operations support full undo/redo:

```
Cmd/Ctrl + Z  →  Undo (revert date changes)
Cmd/Ctrl + Shift + Z  →  Redo
```

The calendar automatically updates when you undo/redo to show the correct state.

### 🎨 Display Properties

Configure which frontmatter properties to show in the dropdown:

**Settings → [Your Calendar] → Display Properties → Untracked Events**

Example configuration:
```
Status, Priority, Project, Tags
```

Properties are rendered with proper formatting:
- Links are clickable
- Lists are comma-separated
- Complex values are stringified

### 🎨 Color Rules

Color rules automatically apply to untracked events. If you have rules like:

```javascript
Status == "urgent" → Red
Project.includes("work") → Blue
```

Untracked events matching these conditions will show with the appropriate colors in the dropdown.

### 🔍 Search

Filter untracked events by typing in the search bar at the top of the dropdown:

- Searches event titles (case-insensitive)
- Zettel IDs are ignored during search
- Updates instantly as you type

## Configuration

For configuration options including enabling/disabling the dropdown, display properties, and default duration settings, see:

📖 **[Configuration Guide](../configuration.md#parsing)** - General settings and display properties

For keyboard shortcuts and command palette access:

📖 **[Hotkeys Guide](./hotkeys.md#toggle-untracked-events-dropdown)** - Toggle command and hotkey setup

## Double-Click to Open

Double-click any event in the dropdown to open its note file directly.

*Single-click initiates drag, so use double-click to open.*
