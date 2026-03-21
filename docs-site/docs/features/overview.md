# Features Overview

Prisma Calendar provides a comprehensive set of features for managing calendar events inside Obsidian. This page serves as an index — click any feature to see its full documentation.

---

## Core Capabilities

### [Multiple Isolated Calendars](./calendar/multiple-calendars)
Up to 10 separate calendars with independent configurations, dedicated folders, custom hotkeys, and clone/duplicate support.

### [Folder-Based Event Scanning](./calendar/folder-scanning)
Automatic indexing of notes with frontmatter, recursive subfolder scanning, real-time updates, and date property normalization for external tool compatibility (Dataview, Bases).

### [Templater Integration](./advanced/templater)
Use Templater templates to scaffold consistent event metadata and custom frontmatter structures.

---

## Notifications & Alerts

### [Notifications](./management/notifications)
Desktop notifications with flexible timing (minutes for timed events, days for all-day), per-event overrides, snooze, and automatic duplicate prevention. Includes visual highlighting of upcoming events.

---

## Customization & Visual Control

### [Dynamic Color Rules](./organization/color-rules)
JavaScript expressions map frontmatter to colors (`Priority === 'High'` → `#ef4444`). First match wins, with default fallback and live updates.

### [Advanced Filtering & Search](./organization/filtering)
[Global event search](./management/global-events-management) with cycle filters, search bar for quick text filtering, expression filter for property-based logic, filter presets, and filtered events modal. Includes commands to highlight events by category.

### [Statistics & Time Tracking](./organization/statistics)
Daily, weekly, monthly, and all-time views with pie charts and breakdown tables. Dual aggregation modes (Event Name vs Category), break time support, smart grouping, period navigation, and paginated tables (20 entries per page).

### [Tabbed Views](./views/tabbed-views)
Persistent tab bar with Calendar (month/week/day/list), [Timeline](./views/timeline), [Daily+Stats](./views/daily-stats), and [Dual Daily](./views/dual-daily) — plus Pro-only [Heatmap](./views/heatmap), [Gantt](./views/gantt), and [Dashboard](./views/dashboard). Tabs can be reordered, renamed, and hidden. Group tabs support nested subtabs.

### [Calendar View](./calendar/calendar-view)
Month, week, day, and list views with a fully customizable toolbar, CTRL+scroll zoom, display density options, event text coloring, sticky headers, event overlap control, and customizable time ranges.

### [Header Actions](./views/header-actions)
55+ customizable shortcut buttons in the view header for one-click access to any calendar command. Reorder, rename, change icons and colors, show/hide via the gear button. 19 shown by default.

### [Capacity Tracking](./views/capacity-tracking)
Compact indicator showing used vs total hours (e.g., "7h 30m / 11h (68%)") in the page header and statistics. Boundaries auto-inferred from earliest and latest events.

### [Heatmap View](./views/heatmap) (Pro)
GitHub-style contribution heatmap showing event density over time with yearly and monthly modes, category-colored gradients, click-to-inspect day details, and arrow-key navigation.

### [Dashboard](./views/dashboard) (Pro)
Full-page overview with three subtabs (By Name, By Category, Recurring) featuring a resizable 2x2 grid: pie chart, summary stat cards with Top 10 bar chart, and a sortable/searchable paginated table.

### [Gantt View](./views/gantt) (Pro)
Horizontal event bars on a date timeline with Day/Week/Month/Year view modes and native dependency arrows between prerequisite pairs. "Connected only" filter shows exclusively events in prerequisite relationships.

### [Bases Calendar View](./views/bases-calendar-view) (Pro)
Render Prisma events inside any Obsidian Base as a fully interactive calendar with month/week/day views, drag-and-drop, context menus, batch selection, and hover previews.

### [Prerequisite Connections](./advanced/prerequisite-connections) (Pro)
SVG arrow overlay on the Calendar tab showing directed dependencies between events. Dashed stub arrows appear at the calendar edge for off-screen connections. Toggled via command or header action.

### Frontmatter Display
Display custom properties inside event chips with clickable wikilinks and configurable property selection. Configure in Settings → Calendar → Frontmatter display properties.

---

## [Recurring Events System](./events/recurring-dsl)

Node-based architecture where one source file controls an entire series. Creates real Obsidian notes with complete frontmatter and content inheritance. [Virtual events](./events/virtual-events) show far-future instances without creating files. Includes calendar-based creation, source navigation, instance dropdown, and centralized [Events Browser](./events/event-groups#events-browser) with type filters and quick actions.

---

## Event Interaction & Management

### [Event Naming](./management/zettelid-naming)
ZettelID gives every file a unique timestamp suffix (e.g., `Meeting-20250106143022.md`) while displaying just `Meeting` in the UI. The Calendar Title property stores a clean wiki-link display name in frontmatter, used across the calendar view, Bases, modals, and context menus.

### [Event Previews](./events/event-previews)
Hover previews and enlarged modals with clickable frontmatter, wikilink navigation, and complete event context.

### [Event Icons](./events/event-icons)
Custom emoji or text icons displayed on events via a frontmatter property. Configurable precedence over recurring markers, CalDAV, ICS, and holiday icons.

### Event Creation & Editing

Create and edit events with full frontmatter support, recurring options, categories, break time, and a [built-in time tracker](./management/time-tracker) with session and break timers.

Features: quick create button, drag & drop, resize with edge scrolling, "Now" button for current time, and direct file opening.

**Fast Editing Commands**: Hover any event to focus it, then use hotkeys for rapid time updates — set start/end to now, or fill from previous/next events. See [Hotkeys](./advanced/hotkeys) for recommended keybindings.

**Category Management**: Assign categories from the event modal or context menu. Multi-select interface with search, color indicators, and inline category creation. See [Categories](./organization/categories) for details.

### [Event Presets](./events/event-presets)
Save reusable templates with pre-filled values including title, dates, categories, recurring patterns, and custom properties. Configure a default preset that auto-applies to new events.

### [Event Skipping](./events/event-skipping)
Mark events as skipped without deletion. Preserves recurring series integrity with management dialog and undo support.

### [Untracked Events](./events/untracked-events)
Inbox for notes without dates. Browse, filter, and drag & drop undated notes directly onto the calendar to assign dates. Dedicated filtering with JavaScript expressions.

---

## [Batch Operations](./management/batch-operations)

Multi-select mode with visual indication and selection persistence. Bulk actions include delete, duplicate, week shifting (move/clone), batch skip, batch category assignment, batch frontmatter updates, and batch open in tabs.

---

## System Features

### Manual Calendar Refresh
Trigger a full resync via command palette when events appear out of sync or after bulk file operations.

### Reactive Settings
All settings changes apply instantly without restart. Color rules, filters, and views recalculate in real time.

### [Undo/Redo System](./management/undo-redo)
Every action is undoable with descriptive labels ("Undo Create Event", "Undo Batch Delete"). Full history across all calendar operations.

### Fill Time from Adjacent Events
Right-click timed events to fill start/end times from neighboring events or current time:
- Fill start/end time from previous/next event (eliminate gaps)
- Fill start/end time from current time (instant time logging)

All operations support undo/redo.

### [Integrations](./advanced/integrations)
Export/import ICS files with timezone selection, skip filtering, and broad compatibility (Google Calendar, Apple Calendar, Outlook, Nextcloud). Includes CalDAV sync and ICS URL subscriptions.

---

## Example Configurations

### Example Frontmatter

```yaml
---
Title: Sprint Planning
Start: 2025-02-03T10:00
End: 2025-02-03T11:00
RRule: bi-weekly
RRuleSpec: monday
Project: Work
Priority: High
Status: Active
Tags: [meeting, planning, sprint]
---

## Meeting Agenda
- Review last sprint
- Plan upcoming sprint
- Assign tasks
```

### Example Color Rules

```javascript
Priority === 'High'          → #ef4444  // Red for high priority
Project === 'Work'           → #3b82f6  // Blue for work projects
Status === 'Done'            → #10b981  // Green for completed
Tags?.includes('urgent')     → #f59e0b  // Orange for urgent
```

### Example Filter

```javascript
// Show only active, non-completed events
Status !== 'Done' && Status !== 'Cancelled'

// Show only work-related events
Project === 'Work' || Tags?.includes('work')

// Hide archived events
!Tags?.includes('archived')
```
