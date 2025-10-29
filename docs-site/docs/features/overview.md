# Features Overview

Prisma Calendar is packed with powerful features designed for flexibility, efficiency, and complete control over your calendar workflow.

---

## 🎯 **Core Capabilities**

### **Multiple Isolated Calendars**
- **Up to 10 separate calendars** with completely independent configuration
- **Dedicated folders** - Each calendar scans its own directory tree (subfolders included)
- **Custom hotkeys** - Instant switching between calendars
- **Clone & duplicate** - Copy entire calendars with all settings intact
- **Independent rules** - Each calendar has its own color rules, filters, and display settings

### **Folder-Based Event Scanning**
- **Automatic indexing** - Point a calendar at any folder and notes with frontmatter become events
- **Subfolder support** - Recursively scans all subfolders in the configured path
- **Real-time updates** - File changes are detected and processed instantly
- **Smart parsing** - Efficiently handles large vaults with hundreds or thousands of events

### **Templater Integration**
- **Template scaffolding** - Use Templater templates to create consistent event metadata
- **Custom frontmatter** - Define your own property structure that works with your workflow
- **Automatic application** - New events created via calendar use your configured template

---

## 🔔 **Notifications & Alerts**

### **Smart Notification System**
- **Desktop notifications** - System alerts before events start
- **Rich modal interface** - Complete event details with interactive properties
- **Flexible timing** - Separate defaults for timed events (minutes) and all-day events (days)
- **Per-event overrides** - Each event can specify custom notification timing
- **Snooze functionality** - Postpone notifications with smart recalculation (timed events only)
- **Automatic tracking** - Prevents duplicate notifications with "Already Notified" property
- **Example**: `Minutes Before: 15` notifies 15 minutes before event starts

### **Visual Enhancements**
- **Highlight upcoming events** - Automatically highlights current or next upcoming event
- **Higher contrast** - Makes active and upcoming events stand out
- **Smart detection** - Highlights all currently active events, or if none, the closest upcoming one
- **Configurable** - Enable/disable in settings (enabled by default)

## 🎨 **Customization & Visual Control**

### **Dynamic Color Rules**
- **JavaScript expressions** - `Priority === 'High' → #ef4444`
- **First match wins** - Rules evaluated in order, first matching rule applies
- **Default fallback** - Set a default color for events that don't match any rule
- **Live updates** - Color changes reflect immediately as you edit rules

### **Advanced Filtering & Search**
- **Global event search** - Search across all events in calendar with cycle filters for recurring, all-day, and skipped events
- **Search bar** - Quick text-based filtering by event title in calendar view
- **Expression filter** - Use property names directly to show/hide events
- **Filter presets** - Save and reuse common filter expressions
- **Filtered events modal** - See what's being hidden by active filters
- **Search in list modals** - Find events in disabled/skipped event lists
- **Complex logic** - Combine conditions with `&&`, `||`, and comparison operators
- **Dynamic visibility** - Filter events by any frontmatter property
- **Example**: `Status !== 'Done'` to hide completed tasks

### **Frontmatter Display**
- **Show custom properties** - Display additional frontmatter fields inside event chips
- **Configurable** - Choose which properties to show in calendar view
- **Clickable links** - All wikilinks and references are interactive
- **Contextual information** - See important metadata without opening the file

### **View Modes & Display**
- **Multiple views** - Month, week, day, list with fully customizable time ranges
- **Zoom controls** - CTRL+scroll with configurable zoom levels (1-60 minute increments)
- **Display density** - Compact or comfortable modes for different screen sizes
- **Event overlap control** - Configure how overlapping events display (stacked vs columns)
- **Customizable time range** - Set visible hours for week/day views

---

## 🔄 **Recurring Events System**

### **Node-Based Recurrence**
- **Source node architecture** - One configuration file controls the entire recurring series
- **Real note generation** - Creates actual Obsidian notes, not just calendar entries
- **Complete inheritance** - All frontmatter properties and content copy to each instance
- **DSL patterns** - Use `RRule`/`RRuleSpec` for flexible recurrence patterns
- **Stable tracking** - `RRuleID` maintains series integrity across edits

### **Virtual Events**
- **Future previews** - See far-future instances without cluttering your vault
- **Read-only display** - Virtual events appear in calendar but don't create files
- **Source access** - Click virtual events to view their source configuration
- **Performance** - Keeps vault lean while showing complete recurring patterns

### **Calendar-Based Creation**
- **Direct creation** - Create recurring events directly from the calendar interface
- **Full frontmatter support** - Set all properties during creation
- **Atomic indexing** - Events are instantly picked up and processed
- **Immediate generation** - Instances create immediately when RRule property is set

### **Source Navigation**
- **Source button** - Navigate to source node from any recurring instance
- **Instance dropdown** - View all physical instances of a recurring series
- **Past filter** - Toggle past event visibility to reduce clutter
- **Linked navigation** - Jump between related recurring events seamlessly

---

## ⚡ **Event Interaction & Management**

### **Hidden ZettelID Naming System**
- **Clean display names** - Events shown without timestamp clutter in the calendar
- **Unique filenames** - Every event file includes a hidden timestamp suffix (ZettelID)
- **Multiple same-named events** - Create unlimited events with identical user-facing names
- **Automatic uniqueness** - No manual numbering or naming conflicts
- **Transparent UX** - ZLID stripped from display when editing, previewing, or viewing events
- **Example**: File stored as `Meeting-20250106143022.md` but displayed as `Meeting`

### **Enhanced Event Previews**
- **Hover previews** - See note content without opening files
- **Enlarged modal** - Expanded view showing complete frontmatter and full content
- **Clickable frontmatter** - All frontmatter properties are interactive
- **Wikilink navigation** - Follow links directly from preview modal
- **Complete context** - See all event details in one comprehensive view

### **Event Creation & Editing**
- **Quick create button** - Create events instantly from calendar interface
- **Enhanced edit modal** - Full frontmatter editing with all configured properties
- **Drag & drop** - Move events by dragging to new time slots
- **Resize support** - Adjust event duration by dragging edges
- **Click to open** - Open event files directly from calendar

### **Event Skipping**
- **Skip individual instances** - Mark events as skipped without deletion
- **Preserve series** - Skipping doesn't break recurring event chains
- **Skip management dialog** - View and manage all skipped events
- **Undo support** - Skipped events can be restored via undo

---

## 🚀 **Batch Operations**

### **Multi-Select Mode**
- **Click to select** - Select multiple events across your calendar
- **Visual indication** - Selected events are clearly highlighted
- **Selection persistence** - Maintain selection across view changes
- **Select all visible** - Quickly grab all events on screen

### **Bulk Actions**
- **Batch delete** - Remove multiple events with one confirmation
- **Batch duplicate** - Create copies of selected events instantly
- **Week shifting** - Move or clone entire sets of events forward/backward
- **Batch skip** - Skip multiple events at once
- **Batch open** - Open all selected event files in editor tabs simultaneously

---

## 🔧 **System Features**

### **Reactive Settings**
- **Instant updates** - All settings changes apply immediately without restart
- **Live recalculation** - Color rules, filters, and views update automatically
- **Zero downtime** - Never interrupt your workflow with restarts
- **Real-time feedback** - See changes as you make them

### **Undo/Redo System**
- **Command pattern** - Every action is undoable
- **Semantic labels** - See exactly what you're undoing ("Undo Create Event", "Undo Batch Delete")
- **Full history** - Undo/redo across all calendar operations
- **Safety net** - Experiment confidently knowing you can always revert

### **Performance**
- **Debounced scanning** - Efficient file watching for large vaults
- **Smart indexing** - Optimized parser for thousands of events
- **Timezone support** - Automatic system timezone detection with custom override
- **Lightweight** - Events are plain Markdown — you own your data

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
7. **[Recurring Events](./recurring-dsl)** - Master recurring event patterns
8. **[Batch Operations](./batch-operations)** - Learn efficiency workflows
