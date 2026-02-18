---
slug: /
title: Prisma Calendar
---
import useBaseUrl from '@docusaurus/useBaseUrl';

<div align="center">

# Prisma Calendar

<p>
  <img src="https://img.shields.io/github/downloads/Real1tyy/Prisma-Calendar/total?label=Downloads&style=for-the-badge" alt="Downloads" />
  {" "}
  <img src="https://img.shields.io/github/v/release/Real1tyy/Prisma-Calendar?label=Latest%20Release&style=for-the-badge" alt="Release" />
  {" "}
  <img src="https://img.shields.io/github/stars/Real1tyy/Prisma-Calendar?style=for-the-badge" alt="Stars" />
  {" "}
  <img src="https://img.shields.io/github/license/Real1tyy/Prisma-Calendar?style=for-the-badge" alt="License" />
  {" "}
  <img src="https://img.shields.io/badge/obsidian-plugin-purple.svg?style=for-the-badge" alt="Obsidian" />
</p>

**The most powerful and flexible calendar plugin ever built for Obsidian — fully configurable, reactive, and engineered for power users who want real control over their time-linked notes.**

</div>

## Preview

<div style={{"display": "flex", "flexWrap": "wrap", "gap": "1em", "justifyContent": "center", "marginBottom": "1em"}}>
  <video controls autoPlay loop muted playsInline style={{"flex": "1 1 45%", "minWidth": "300px", "maxWidth": "50%", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/StatisticPiechart.webm")} type="video/webm" />
  </video>
  <video controls autoPlay loop muted playsInline style={{"flex": "1 1 45%", "minWidth": "300px", "maxWidth": "50%", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/batchFULL.webm")} type="video/webm" />
  </video>
</div>

<div style={{"display": "flex", "flexWrap": "wrap", "gap": "1em", "justifyContent": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"flex": "1 1 45%", "minWidth": "300px", "maxWidth": "50%", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/AssignCategory.webm")} type="video/webm" />
  </video>
  <video controls autoPlay loop muted playsInline style={{"flex": "1 1 45%", "minWidth": "300px", "maxWidth": "50%", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/GlobalTimelineView.webm")} type="video/webm" />
  </video>
</div>

---

## 🎬 Video Tutorials

:::tip Watch All Videos
Check out the [complete video tutorial collection](/videos) with all videos, detailed chapters, and timestamps!
:::

### Part 1: Feature Showcase — Core Capabilities

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <iframe
    style={{"width":"100%", "aspectRatio": "16/9"}}
    src="https://www.youtube.com/embed/aULuB6petbU"
    title="Prisma Calendar - Feature Showcase (Part 1)"
    frameBorder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen>
  </iframe>
  <p><strong>Full walkthrough of core features:</strong> Event creation, editing, drag-and-drop, batch operations, undo/redo system, recurring events with source nodes, dynamic color rules, filtering, and calendar customization. See how Prisma Calendar gives you real control over your time-linked notes inside Obsidian.</p>
</div>

---

## 📚 **Documentation**

Quick Links:
- [Installation](/installation) • [Quickstart](/quickstart) • [Configuration](/configuration)
- [Features Overview](/features/overview) • [FAQ](/faq) • [Troubleshooting](/troubleshooting)

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

### 🔗 **Recurring Event Management**
- **Source button** - Navigate to source node from any recurring instance
- **Instance dropdown** - View all physical instances of a recurring series
- **Past filter** - Toggle past event visibility to reduce clutter
- **Virtual event source preview** - Click virtual events to see their source configuration

### 🗓️ **Multiple Isolated Calendars**
- **Up to 10 separate calendars** with independent configuration
- **Dedicated folders** - Each calendar scans its own directory tree
- **Custom hotkeys** - Instant switching between calendars
- **Clone & duplicate** - Copy calendars with all settings intact

### 🎨 **Dynamic Visual Customization**
- **JavaScript-powered color rules** - `Priority === 'High' → #ef4444`
- **Property-based filtering** - Show/hide events with complex expressions
- **Frontmatter display** - Show extra frontmatter properties inside event chips
- **Multiple view modes** - Month, week, day, list with customizable time ranges
- **Zoom controls** - CTRL+scroll with configurable zoom levels (1-60 minutes)

### 🔄 **CalDAV & ICS Integration**
- **Read-only CalDAV sync** - Automatically import events from external CalDAV servers (Fastmail, Nextcloud, iCloud, etc.)
- **ICS import & export** - Import `.ics` calendar files into Prisma, or export your calendar/events to standard ICS format for use in other apps and services
- **Auto-sync** - Configurable sync intervals with manual trigger option
- **Smart updates** - Incremental CalDAV sync using ETags for efficiency
- **Multiple accounts** - Connect multiple CalDAV or ICS sources to different Prisma calendars
- **Note creation** - Synced or imported events become Obsidian notes with full frontmatter

> **⚠️ Security Warning**: CalDAV credentials are stored in **plaintext** in your vault's `data.json` file. Always use **app-specific passwords**, never your main account password. See [documentation](/features/integrations#security-considerations) for detailed security considerations.

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

---

## Credits & Acknowledgments

Prisma Calendar is built using [FullCalendar](https://fullcalendar.io/), a powerful and flexible JavaScript calendar library. FullCalendar provides the robust calendar rendering engine that powers Prisma Calendar's views and interactions. We're grateful to the FullCalendar team for creating such an excellent foundation.
