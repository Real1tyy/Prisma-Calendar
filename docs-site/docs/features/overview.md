# Features Overview

Prisma Calendar is packed with powerful features designed for flexibility, efficiency, and complete control over your calendar workflow.

---

## 🎯 **Core Capabilities**

### **[Multiple Isolated Calendars](./multiple-calendars)**
Up to 10 separate calendars with independent configurations, dedicated folders, custom hotkeys, and clone/duplicate support.

### **[Folder-Based Event Scanning](./folder-scanning)**
Automatic indexing of notes with frontmatter, recursive subfolder scanning, and real-time updates for large vaults.

### **[Templater Integration](./templater)**
Use Templater templates to scaffold consistent event metadata and custom frontmatter structures.

---

## 🔔 **[Notifications & Alerts](./notifications)**

Desktop notifications with rich modal interface, flexible timing (minutes for timed events, days for all-day), per-event overrides, snooze functionality, and automatic duplicate prevention. Includes visual highlighting of upcoming events with configurable contrast.

## 🎨 **Customization & Visual Control**

### **[Dynamic Color Rules](./color-rules)**
JavaScript expressions map frontmatter to colors (`Priority === 'High' → #ef4444`). First match wins, with default fallback and live updates.

### **[Advanced Filtering & Search](./filtering)**
[Global event search](./global-search) with cycle filters, search bar for quick text filtering, expression filter for property-based logic, filter presets, and filtered events modal. Includes command to highlight events without categories.

### **[Statistics & Time Tracking](./statistics)**
Daily, weekly, monthly, and all-time views with pie charts and breakdown tables. Dual aggregation modes (Event Name vs Category), break time support, smart grouping, period navigation, and paginated tables (20 entries per page).

### **Frontmatter Display**
Display custom properties inside event chips with clickable wikilinks and configurable property selection.

### **View Modes & Display**
Month, week, day, and list views with CTRL+scroll zoom (1-60 minute increments), display density options, event overlap control, and customizable time ranges.

---

## 🔄 **[Recurring Events System](./recurring-dsl)**

Node-based architecture where one source file controls the entire series. Creates real Obsidian notes with complete frontmatter and content inheritance. [Virtual events](./virtual-events) show far-future instances without creating files. Includes calendar-based creation, source navigation, instance dropdown, and centralized management modal with type filters and quick actions.

---

## ⚡ **Event Interaction & Management**

### **[Hidden ZettelID Naming System](./zettelid-naming)**
Create unlimited events with identical display names. Files stored with unique timestamp suffixes (e.g., `Meeting-20250106143022.md`) but displayed as `Meeting` throughout the UI.

### **[Enhanced Event Previews](./event-previews)**
Hover previews and enlarged modals with clickable frontmatter, wikilink navigation, and complete event context.

### **Event Creation & Editing**

<div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem'}}>
  <img src="/img/create_event_modal.png" alt="Create Event Modal" style={{maxWidth: '48%', minWidth: '300px'}} />
  <img src="/img/edit_event_modal.png" alt="Edit Event Modal" style={{maxWidth: '48%', minWidth: '300px'}} />
</div>

*Create and edit events with full frontmatter support, recurring options, categories, break time, and built-in time tracker*

Quick create button, enhanced edit modal with full frontmatter editing, "Now" button for current time, [built-in time tracker](./time-tracker) with break time support, drag & drop, resize support, edge scrolling for cross-week movement, and direct file opening.

### **Event Presets**
Save reusable templates with pre-filled values including title, dates, categories, recurring patterns, and custom properties. Configure a default preset that auto-applies to new events.

### **[Event Skipping](./event-skipping)**
Mark events as skipped without deletion. Preserves recurring series integrity with management dialog and undo support.

---

## 🚀 **[Batch Operations](./batch-operations)**

Multi-select mode with visual indication and selection persistence. Bulk actions include delete, duplicate, week shifting (move/clone), batch skip, and batch open in tabs.

---

## 🔧 **System Features**

### **Manual Calendar Refresh**
Manually trigger full resync via command palette when events appear out of sync or after bulk file operations. Automatic refresh with loading indicator.

### **Reactive Settings**
All settings changes apply instantly without restart. Live recalculation of color rules, filters, and views with real-time feedback.

### **[Undo/Redo System](./undo-redo)**
Every action is undoable with semantic labels ("Undo Create Event", "Undo Batch Delete"). Full history across all calendar operations.

### **[Fill Time from Adjacent Events](./fill-time)**
Right-click timed events or use modal buttons to fill start/end times from neighboring events. Schedule back-to-back meetings and eliminate calendar gaps.


### **[ICS Integrations](./integrations)**
Export/import ICS files with timezone selection, skip filtering, and wide compatibility (Google Calendar, Apple Calendar, Outlook, Nextcloud). Includes VALARM reminders and CalDAV sync.

---

## 📋 **Example Configurations**

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
fm.Priority === 'High'          → #ef4444  // Red for high priority
fm.Project === 'Work'           → #3b82f6  // Blue for work projects
fm.Status === 'Done'            → #10b981  // Green for completed
fm.Tags?.includes('urgent')     → #f59e0b  // Orange for urgent
```

### Example Filter

```javascript
// Show only active, non-completed events
fm.Status !== 'Done' && fm.Status !== 'Cancelled'

// Show only work-related events
fm.Project === 'Work' || fm.Tags?.includes('work')

// Hide archived events
!fm.Tags?.includes('archived')
```

---

## 🎯 **Getting Started**

1. **[Installation](../installation)** - Get Prisma Calendar installed
2. **[Quickstart](../quickstart)** - Basic setup and first calendar
3. **[Configuration](../configuration)** - Deep dive into customization
4. **[Notifications](./notifications)** - Set up event alerts and reminders
5. **[Global Search](./global-search)** - Search and navigate all events
6. **[Filtering](./filtering)** - Master search and filter expressions
7. **[Statistics](./statistics)** - Track time with daily, weekly, monthly, and all-time insights
8. **[Time Tracker](./time-tracker)** - Precision stopwatch for tracking work sessions
9. **[Recurring Events](./recurring-dsl)** - Master recurring event patterns
10. **[Batch Operations](./batch-operations)** - Learn efficiency workflows
11. **[Integrations](./integrations)** - Export and import with external calendars
