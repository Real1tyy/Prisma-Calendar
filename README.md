<div align="center">

# Prisma Calendar

![Downloads](https://img.shields.io/github/downloads/Real1tyy/Prisma-Calendar/total?label=Downloads&style=for-the-badge)
![Release](https://img.shields.io/github/v/release/Real1tyy/Prisma-Calendar?label=Latest%20Release&style=for-the-badge)
![Stars](https://img.shields.io/github/stars/Real1tyy/Prisma-Calendar?style=for-the-badge)
![License](https://img.shields.io/github/license/Real1tyy/Prisma-Calendar?style=for-the-badge)
![Obsidian](https://img.shields.io/badge/obsidian-plugin-purple.svg?style=for-the-badge)

**The most powerful and flexible calendar plugin ever built for Obsidian — fully configurable, reactive, and built for power users who want real control over their schedule.**

---

## 🎬 Video Tutorials

**[View All Video Tutorials →](https://real1tyy.github.io/Prisma-Calendar/videos)**

### Part 1: Feature Showcase — Core Capabilities

<a href="https://www.youtube.com/watch?v=aULuB6petbU" target="_blank">
  <img src="https://img.youtube.com/vi/aULuB6petbU/maxresdefault.jpg" alt="Prisma Calendar - Feature Showcase (Part 1)" style="width:100%;">
</a>

**Core Features Walkthrough**: This video covers many of the fundamental features of Prisma Calendar including event creation, editing, batch operations, undo/redo system, recurring events, color rules, and more.

For the **Full Tutorial** (Zero to Mastery), **Part 2** (Intelligence & Automation), and **Part 3** (Advanced Workflow Tools), visit the [complete video tutorial collection](https://real1tyy.github.io/Prisma-Calendar/videos).

</div>

---

## 📸 Screenshots

### Full Calendar View

![Full Calendar View](docs-site/static/img/full_calendar.png)
_Weekly calendar view with color-coded events, time grid, and powerful toolbar_

### Batch Operations

![Batch Selection Mode](docs-site/static/img/batch_select.png)
_Select multiple events for bulk operations like delete, duplicate, move, or skip_

### Event Creation & Editing

<p align="center">
<img src="docs-site/static/img/create_event_modal.png" alt="Create Event Modal" width="45%">
<img src="docs-site/static/img/edit_event_modal.png" alt="Edit Event Modal" width="45%">
</p>

_Create and edit events with full frontmatter support, recurring event options, and built-in time tracker_

### Weekly Statistics

![Weekly Statistics](docs-site/static/img/weekly_stats_pie.png)
_Visual time tracking with pie charts and detailed breakdown tables_

Check out the [complete screenshots gallery](https://real1tyy.github.io/Prisma-Calendar/screenshots) in the documentation to see all the plugin's visuals, including calendar views, event modals, batch operations, statistics, settings, and more.

---

## 📚 Documentation

**[View Full Documentation →](https://real1tyy.github.io/Prisma-Calendar/)**

Quick Links:

- [Installation](https://real1tyy.github.io/Prisma-Calendar/installation) • [Quickstart](https://real1tyy.github.io/Prisma-Calendar/quickstart) • [Configuration](https://real1tyy.github.io/Prisma-Calendar/configuration)
- [Features Overview](https://real1tyy.github.io/Prisma-Calendar/features/overview) • [FAQ](https://real1tyy.github.io/Prisma-Calendar/faq) • [Troubleshooting](https://real1tyy.github.io/Prisma-Calendar/troubleshooting)

---

## 📦 Installation

Prisma Calendar is currently **awaiting approval** for the Obsidian Community Plugin store. In the meantime, you can install it using one of these methods:

### 🎯 Recommended: BRAT (Beta Reviewers Auto-update Tool)

The easiest way to install and keep Prisma Calendar up to date:

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) from Obsidian's Community Plugins
2. Open BRAT settings (Settings → BRAT)
3. Click **Add Beta Plugin**
4. Enter this repository URL: `https://github.com/Real1tyy/Prisma-Calendar`
5. Click **Add Plugin**
6. Enable Prisma Calendar in Settings → Community Plugins

**Benefits**: Automatic updates, smooth experience, one-click installation

### 📥 Manual Installation from GitHub Releases

1. Go to [Releases](https://github.com/Real1tyy/Prisma-Calendar/releases)
2. Download the latest release assets:
   - `main.js`
   - `manifest.json`
   - `styles.css`
3. Create folder: `{VaultFolder}/.obsidian/plugins/prisma-calendar/`
4. Move downloaded files into the folder
5. Reload Obsidian (Ctrl/Cmd + R)
6. Enable Prisma Calendar in Settings → Community Plugins

**Note**: All releases are versioned and tagged for easy reference.

### ✨ Coming Soon

Once approved for the Community Plugin store, you'll be able to install Prisma Calendar directly from Settings → Community Plugins → Browse.

---

## 📱 **Mobile Support**

**Core features work on mobile without any problems**. We have users who rely on mobile, and thanks to their feedback, we continually improve and tighten up the mobile experience to make it rock solid. Our design is responsive, so most things work, and we're committed to making it even better over time. If you encounter any problems or have suggestions for improvement, please create a [GitHub issue](https://github.com/Real1tyy/Prisma-Calendar/issues) and we'll address it.

---

## **Top 5 Killer Features**

### **1️⃣ Flexibility — Fully Configurable Everything**

Every aspect of Prisma Calendar is customizable. From frontmatter properties to calendar appearance and behavior, everything adapts to **your** workflow. You define the rules — Prisma Calendar follows.

- **Custom frontmatter mapping** - Use your own property names (`Start`, `Begin`, `Date` — your choice)
- **Dynamic color rules** - JavaScript expressions for intelligent event coloring
- **Filtering system** - Show/hide events based on any frontmatter property
- **View customization** - Adjust time ranges, zoom levels, display density, and visual themes
- **Multiple calendars** - Up to 10 isolated calendars, each with independent settings

### **2️⃣ Reactivity — No Restarts. Ever.**

Change a setting → The calendar **immediately updates**. No more restarting Obsidian. Every parameter, toggle, or setting change is applied live, instantly reflecting in your workspace.

- **Instant feedback** - All settings changes apply in real-time
- **Live recalculation** - Color rules, filters, and views update automatically
- **Zero downtime** - Never interrupt your workflow with restarts

### **3️⃣ History & Memento System — Undo / Redo Like a Pro**

Prisma Calendar keeps a complete memento history of your actions. Every move, edit, or deletion can be undone or redone instantly. Misclicked? Don't worry — we've got you covered.

- **Command pattern architecture** - Every action is undoable
- **Semantic undo** - See exactly what you're undoing ("Undo Create Event", "Undo Batch Delete")
- **Full history** - Undo/redo across all calendar operations
- **Safety net** - Experiment confidently knowing you can always revert

### **4️⃣ Recurring Events — Smart, Linked, Isolated**

Recurring events are built around a **source node** that defines frequency (daily, weekly, bi-weekly, etc.). Each instance is an independent Obsidian note, fully linked to its source — giving you both structure and freedom.

- **Source node architecture** - One configuration file controls the entire series
- **Real note generation** - Physical Obsidian notes, not just calendar entries
- **Complete inheritance** - All frontmatter and content copied to instances
- **Virtual previews** - See far-future instances without cluttering your vault
- **Source navigation** - Jump between instances and their source with one click
- **Calendar creation** - Create recurring events directly from the calendar interface with full frontmatter support

### **5️⃣ Batch Operations — Work Fast, Think Big**

Select multiple events and perform bulk actions: **clone, move, skip, delete, or open them** — all at once. Perfect for power users who value efficiency and speed.

- **Multi-select mode** - Click to select multiple events
- **Bulk operations** - Delete, duplicate, move, or clone selected events
- **Skip functionality** - Mark events as skipped without deletion
- **Batch open** - Open all selected event files in editor tabs
- **Week shifting** - Move or clone entire sets of events forward/backward

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

- **JavaScript-powered color rules** - `fm.Priority === 'High' → #ef4444`
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

> **⚠️ Security Warning**: CalDAV credentials are stored in **plaintext** in your vault's `data.json` file. Always use **app-specific passwords**, never your main account password. See [documentation](https://real1tyy.github.io/Prisma-Calendar/features/integrations#security-considerations) for detailed security considerations.

## Support & Sponsorship

If you find Prisma Calendar useful and want to support its ongoing development, please consider becoming a sponsor. Your contribution helps ensure continuous maintenance, bug fixes, and the introduction of new features.

- [Support My Work](https://matejvavroproductivity.com/support/)

Every contribution, no matter the size, is greatly appreciated!

## License

[AGPL-3.0](./LICENSE). Versions before v2.0.0 were MIT.

## Contributing

PRs welcome! Contributions are licensed under AGPL-3.0.

---

## Credits & Acknowledgments

Prisma Calendar is built using [FullCalendar](https://fullcalendar.io/), a powerful and flexible JavaScript calendar library. FullCalendar provides the robust calendar rendering engine that powers Prisma Calendar's views and interactions. We're grateful to the FullCalendar team for creating such an excellent foundation.
