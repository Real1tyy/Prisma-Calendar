---
slug: /
title: Prisma Calendar
---

<div align="center">

<div className="video-container" style={{"textAlign": "center", "marginBottom": "1em"}}>
  <iframe
    style={{"width":"100%", "aspectRatio": "16/9"}}
    src="https://www.youtube.com/embed/aULuB6petbU"
    title="YouTube video player"
    frameBorder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen>
  </iframe>
  <p><em>Play the demo to see Prisma Calendar in action!</em></p>
</div>

# Prisma Calendar

**The most powerful and flexible calendar plugin for Obsidian — fully configurable, reactive, and built for power users.**

</div>

Built for power users and workflow optimization enthusiasts, Prisma Calendar delivers multiple isolated calendars, fine-grained filtering and color rules, fast folder-based indexing, and a sophisticated recurring event system — all backed by plain Markdown notes.

---

## 🎬 **Top 5 Killer Features**

### **1️⃣ Flexibility — Fully Configurable Everything**
Every aspect of Prisma Calendar is customizable. From frontmatter properties to calendar appearance and behavior, everything adapts to **your** workflow. You define the rules — Prisma Calendar follows.

**What you can configure:**
- **Frontmatter mapping** - Use your own property names (`Start`, `Begin`, `EventDate` — your choice)
- **Dynamic color rules** - JavaScript expressions for intelligent event coloring (`Priority === 'High' → #ef4444`)
- **Advanced filtering** - Show/hide events based on any frontmatter property or complex expressions
- **View customization** - Adjust time ranges, zoom levels, display density, themes, and layouts
- **Multiple calendars** - Up to 10 isolated calendars, each with completely independent settings

### **2️⃣ Reactivity — No Restarts. Ever.**
Change a setting → The calendar **immediately updates**. No more restarting Obsidian. Every parameter, toggle, or setting change is applied live, instantly reflecting in your workspace.

**Real-time updates for:**
- All settings changes apply instantly
- Color rules and filters recalculate automatically
- View changes reflect immediately
- Zero downtime — never interrupt your workflow

### **3️⃣ History & Memento System — Undo / Redo Like a Pro**
Prisma Calendar keeps a complete memento history of your actions. Every move, edit, or deletion can be undone or redone instantly. Misclicked? Don't worry — we've got you covered.

**Safety net features:**
- **Command pattern architecture** - Every action is undoable
- **Semantic undo** - See exactly what you're undoing ("Undo Create Event", "Undo Batch Delete", "Undo Move Event")
- **Full operation history** - Undo/redo across all calendar operations
- **Confidence to experiment** - Try anything knowing you can always revert

### **4️⃣ Recurring Events — Smart, Linked, Isolated**
Recurring events are built around a **source node** that defines frequency (daily, weekly, bi-weekly, monthly, etc.). Each instance is an independent Obsidian note, fully linked to its source — giving you both structure and freedom.

**Advanced recurrence system:**
- **Source node architecture** - One configuration file controls the entire series
- **Real note generation** - Physical Obsidian notes, not just calendar entries
- **Complete inheritance** - All frontmatter properties and content copied to each instance
- **Virtual previews** - See far-future instances without cluttering your vault
- **Source navigation** - Jump between instances and their source with one click
- **Calendar creation** - Create recurring events directly from the calendar with full frontmatter support
- **Instance management** - View all recurring instances in a dropdown, filter past events

### **5️⃣ Batch Operations — Work Fast, Think Big**
Select multiple events and perform bulk actions: **clone, move, skip, delete, or open them** — all at once. Perfect for power users who value efficiency and speed.

**Bulk operation capabilities:**
- **Multi-select mode** - Click to select multiple events across your calendar
- **Batch delete** - Remove multiple events with one confirmation
- **Batch duplicate** - Create copies of selected events instantly
- **Week shifting** - Move or clone entire sets of events forward/backward
- **Skip functionality** - Mark events as skipped without breaking recurring series
- **Batch open** - Open all selected event files in editor tabs simultaneously

---

## ✨ **Additional Powerful Features**

### 🔔 **Smart Notification System**
Never miss a deadline with Prisma Calendar's comprehensive notification system — fully configurable, intelligent, and built for reliability.

- **Desktop notifications** - System alerts appear before events start with event details and quick actions
- **Rich notification modal** - Complete event preview showing all properties and action buttons
- **Flexible timing** - Separate defaults for timed events (minutes before) and all-day events (days before)
- **Per-event overrides** - Each event can specify its own notification timing via frontmatter
- **Smart snooze** - Postpone notifications with intelligent recalculation (timed events only)
- **Automatic tracking** - "Already Notified" property prevents duplicate alerts
- **Configurable snooze duration** - Set custom snooze intervals (default: 15 minutes)
- **Sound alerts** - Optional notification sound when alerts appear
- **Never miss deadlines** - Reliable notification queue with precise timing down to the second

### 📋 **Enhanced Event Interaction**
- **Hidden ZettelID naming** - Events display with clean names in the calendar, but files include unique timestamp suffixes for collision-free storage
- **Clickable frontmatter** - All frontmatter properties are interactive, wikilinks are clickable
- **Enlarged previews** - Expanded modal view showing complete frontmatter and full content
- **Quick create button** - Create events instantly from the calendar interface
- **Event skipping** - Skip individual recurring event instances without breaking the series
- **Hover previews** - See note content without opening files
- **Direct file access** - Click events to open the underlying note immediately

### 🔗 **Recurring Event Management**
- **Source button** - Navigate to source node from any recurring instance
- **Instance dropdown** - View all physical instances of a recurring series in one list
- **Past filter** - Toggle past event visibility to reduce visual clutter
- **Virtual event source preview** - Click virtual events to see their source configuration
- **Atomic creation** - Recurring events created via calendar are instantly indexed and processed
- **Frontmatter inheritance** - Set all frontmatter properties in the source, they copy to every instance

### 🗓️ **Multiple Isolated Calendars**
- **Up to 10 separate calendars** with completely independent configuration
- **Dedicated folders** - Each calendar scans its own directory tree (subfolders included)
- **Custom hotkeys** - Instant switching between calendars with keyboard shortcuts
- **Clone & duplicate** - Copy entire calendars with all settings, rules, and configurations intact
- **Independent rules** - Each calendar has its own color rules, filters, and display settings

### 📁 **Smart Event Management**
- **Folder-based scanning** - Any note with frontmatter becomes an event automatically
- **Templater integration** - Scaffold consistent event metadata using your templates
- **Deep linking** - Click events to open notes, follow wikilinks, navigate references
- **Batch file operations** - Open multiple event files simultaneously in tabs
- **Automatic indexing** - File changes are detected and processed instantly

### 🎨 **Dynamic Visual Customization**
- **JavaScript-powered color rules** - `fm.Priority === 'High' → #ef4444`
- **Property-based filtering** - Complex expressions to show/hide events (`fm.Status !== 'Done'`)
- **Frontmatter display** - Show extra frontmatter properties inside event chips
- **Multiple view modes** - Month, week, day, list with fully customizable time ranges
- **Zoom controls** - CTRL+scroll with configurable zoom levels (1-60 minute increments)
- **Display density** - Compact or comfortable modes for different screen sizes

### ⚡ **Performance & UX**
- **Debounced scanning** - Efficient file watching and processing for large vaults
- **Fast indexing** - Optimized parser for vaults with hundreds or thousands of events
- **Lightweight** - Events are plain Markdown — you own your data, no proprietary formats

### What does an event look like?

Events are plain Markdown notes with frontmatter. You pick which frontmatter keys the calendar should read (e.g., `Start`, `End`, `AllDay`).

```yaml
---
Start: 2025-01-15T09:00
End: 2025-01-15T10:30
AllDay: false
RRule: weekly
RRuleSpec: monday, wednesday, friday
Status: In Progress
Project: Q1 Planning
---

Agenda...
```

See Configuration for how to map these property names to your preferences and how to display extra properties inside event chips.

## Help Shape the Future

This plugin is under active development and is personally used every day by the developer. The goal is to make it the best calendar for Obsidian, and community feedback is crucial.

Have an idea or a feature request?
1.  **Open an Issue** on our [GitHub repository](https://github.com/Real1tyy/Prisma-Calendar/issues).
2.  **Upvote Existing Ideas**: If you see a feature request you'd like, give it a 👍 reaction.

We prioritize development based on community demand, so your voice helps us build a better calendar for everyone.
