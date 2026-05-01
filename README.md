<div align="center">

# Prisma Calendar

![Downloads](https://img.shields.io/github/downloads/Real1tyy/Prisma-Calendar/total?label=Downloads&style=for-the-badge&color=238636) ![Release](https://img.shields.io/github/v/release/Real1tyy/Prisma-Calendar?label=Latest%20Release&style=for-the-badge&color=1f6feb) ![Stars](https://img.shields.io/github/stars/Real1tyy/Prisma-Calendar?style=for-the-badge&color=f0c830) [![Product Page](https://img.shields.io/badge/Product_Page-8957e5?style=for-the-badge)](https://matejvavroproductivity.com/tools/prisma-calendar/?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_product_page) [![Documentation](https://img.shields.io/badge/Documentation-238636?style=for-the-badge)](https://real1tyy.github.io/Prisma-Calendar/?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_documentation)

**Turn any note with a date into a flexible planning system inside Obsidian.**

There are no rigid schemas or predefined structures — just your data, your rules, fully under your control. Prisma lets you see your entire vault through time.

</div>

<img src="docs-site/static/video/PrismaShowcase.gif" alt="Prisma Calendar Preview" width="100%">

<br>
<br>

<table>
<tr>
<td align="center" width="33%">📅 <strong>Plan Projects & Deadlines</strong><br>Turn project notes into timelines, milestones, and dependencies with full visibility.</td>
<td align="center" width="33%">🔁 <strong>Recurring Work & Habits</strong><br>Automatically generate real notes for routines, reviews, and repeating workflows.</td>
<td align="center" width="33%">⏱️ <strong>Track Where Your Time Goes</strong><br>Measure actual time spent and analyze it with categories and statistics.</td>
</tr>
<tr>
<td align="center" width="33%">🧠 <strong>Build a Planning System from Notes</strong><br>Use your existing notes as events — no migration, no new system to learn.</td>
<td align="center" width="33%">🗓️ <strong>Meetings with Context</strong><br>Turn meetings into notes with agendas, links, and prep — all in one place.</td>
<td align="center" width="33%">📊 <strong>Understand & Optimize Your Time</strong><br>Visualize patterns, workload, and capacity to improve how you plan.</td>
</tr>
</table>

---

## ▶️ Quick Start — See Prisma in Action

<div align="center">

<a href="https://www.youtube.com/watch?v=dziQK9UQhvE&utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_youtube_quickstart" target="_blank">
  <img src="https://img.youtube.com/vi/dziQK9UQhvE/maxresdefault.jpg" alt="Prisma Calendar — Quick Start" width="100%">
</a>

👉 **Install the plugin →** follow the Quick Start → create your first event in under 2 minutes.

</div>

---

## How Does It Work?

Prisma reads notes inside a folder you choose and turns them into events based on their frontmatter properties:

- **Start / End** — datetime values for timed events (e.g. `Start: 2025-06-15T09:00`)
- **Date** — a date value for all-day events (e.g. `Date: 2025-06-15`)

You choose which property names Prisma should look for during setup. If you already have notes with date-like properties, Prisma picks them up and visualizes them automatically — no migration, no restructuring, no new system to learn.

```yaml
---
Start: 2025-06-15T09:00
End: 2025-06-15T10:30
AllDay: false
Status: In Progress
Project: Q1 Planning
---
Meeting agenda, notes, links — any content you want.
```

Every event is a regular Obsidian note. You can open it, write inside it, link to other notes, and use it like any other file in your vault. Prisma doesn't own your data — it just visualizes what's already there.

---

## Why Prisma?

<div align="center">

<table>
<tr>
<td width="33%" valign="top">

**Unlike Google Calendar**

You're not locked into someone else's structure. Prisma works with your own markdown fields and custom metadata — fully inside your vault.

</td>
<td width="33%" valign="top">

**Unlike Notion**

No cloud dependency. No lag. No proprietary format. Just your data, local and under your control.

</td>
<td width="33%" valign="top">

**Unlike other calendar plugins**

Not just basic navigation — full planning system, recurrence, dependencies, batch operations, and multi-view planning.

</td>
</tr>
</table>

</div>

---

## Four Views. Four Ways to See Your Vault Through Time.

<table>
<tr>
<td align="center" width="50%">

### 📅 Calendar

Year, month, week, day, and list views for daily scheduling. Drag events, resize durations, create directly on the grid.

</td>
<td align="center" width="50%">

### 📊 Timeline

Horizontal sequencing — see how events flow across days and weeks. Perfect for project phases and deadlines.

</td>
</tr>
<tr>
<td align="center" width="50%">

### 🔥 Heatmap <sup>Pro</sup>

GitHub-style contribution view. Spot patterns, gaps, and consistency at a glance across months or years.

</td>
<td align="center" width="50%">

### 📐 Gantt <sup>Pro</sup>

Dependency-aware project planning. Link tasks with prerequisites and visualize the critical path.

</td>
</tr>
</table>

> [!TIP]
> **Start simple.** You don't need all four views on day one. Begin with the Calendar view and explore from there. Prisma is designed to grow with your system — start with the basics and go deeper when you're ready.

---

## What Makes Prisma Different

> **You don't need all of this to get started.** Start with the Calendar view and basic events — everything else can be explored over time.

### Configure Everything

Other tools force their workflow on you. Prisma adapts to yours. Map your own frontmatter properties, define JavaScript-powered color rules, set up advanced filters, and customize the appearance down to event text, icons, and density. Run **multiple independent planning systems** — each with their own settings and folder scope.

### Fully Reactive

There's no "restart Obsidian to apply changes" here. Every setting change, every color rule tweak, every filter adjustment takes effect **immediately**. Edit a note's frontmatter and watch the calendar update in real time.

### Undo and Redo Everything

Made a mistake? Hit undo. Changed your mind? Redo. Every action — creating, editing, moving, deleting, batch operations — is tracked in a full history. You'll see exactly what's being reversed, so you're always in control.

### Recurring Events That Generate Real Notes

Most calendar plugins show recurring events as ephemeral entries. In Prisma, recurring events create **actual Obsidian notes** — one per instance, fully linked back to the source. Define a frequency (daily, weekly, bi-weekly, monthly, custom) and Prisma handles the rest. Virtual previews show future instances without cluttering your vault.

### Batch Operations

Managing 50 events one by one? No. Select multiple events and delete, duplicate, move, clone, skip, or open them — all at once. Shift entire weeks forward or backward.

### Smart Categories

Define categories with color coding, then let Prisma **auto-assign them** based on event names. Title autocomplete keeps naming consistent and prevents typos. Categories also power event group aggregation, giving you a bird's-eye view of related events across your entire planning system.

### Statistics and Time Insights

See where your time actually goes. Pie charts, category breakdowns, and detailed tables — filterable by day, week, month, or all time. Recurring series get their own statistics so you can track consistency and trends over time.

### Built-in Notifications

Set up reminders and get notified directly inside Obsidian — no external tools needed.

### Time Tracker

Start and stop a timer from any event modal. Track actual time spent vs planned durations and build a real picture of how your time is used.

### Event Presets and Templates

Create reusable presets with pre-filled frontmatter so you can spin up new events in seconds. Pair with Templater for template-driven workflows.

### Scriptable via API

Prisma exposes a programmatic API — create, modify, and query events from scripts, Templater templates, or other plugins. Automate workflows and integrate your planning system into your broader Obsidian setup.

### CalDAV and ICS Sync

Connect your external calendars. Sync with Fastmail, Nextcloud, iCloud, Google Calendar, Outlook, and any CalDAV/ICS-compatible service. Synced events become real Obsidian notes with full frontmatter — no black-box sync, just your data in your vault.

### Tabbed Views

Switch between Calendar (year/month/week/day/list), Timeline, Daily+Stats, and Dual Daily — all in a persistent tabbed container. Pro adds Heatmap, Gantt, and Dashboard. Zoom time slots from 1 to 60 minutes. Display frontmatter properties directly inside event chips.

### 55+ Header Actions

One-click shortcut buttons for any command — fully customizable. Reorder, rename, change icons and colors, or hide actions via the gear button.

### Capacity Tracking

See at a glance how full your schedule is — used vs total hours with remaining time and auto-inferred boundaries.

### Global Event Management

Browse, search, and manage all events across all planning systems from a single interface. Auto-group events by recurring rule, category, or name.

---

## 📸 Gallery & Documentation

[![View Gallery](https://img.shields.io/badge/View_Gallery_→-1f6feb?style=for-the-badge)](https://real1tyy.github.io/Prisma-Calendar/gallery?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_gallery) [![View Full Documentation](https://img.shields.io/badge/View_Full_Documentation_→-238636?style=for-the-badge)](https://real1tyy.github.io/Prisma-Calendar/?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_documentation)

[Installation](https://real1tyy.github.io/Prisma-Calendar/installation?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_installation) • [Quickstart](https://real1tyy.github.io/Prisma-Calendar/quickstart?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_quickstart) • [Configuration](https://real1tyy.github.io/Prisma-Calendar/configuration?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_configuration) • [Features Overview](https://real1tyy.github.io/Prisma-Calendar/features/overview?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_features_overview) • [FAQ](https://real1tyy.github.io/Prisma-Calendar/faq?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_faq) • [Troubleshooting](https://real1tyy.github.io/Prisma-Calendar/troubleshooting?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_troubleshooting)

---

## 🎬 Go Deeper — The Complete Encyclopedia

<div align="center">

<a href="https://www.youtube.com/watch?v=HrcNKh6uFH8&utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_youtube_encyclopedia" target="_blank">
  <img src="https://img.youtube.com/vi/HrcNKh6uFH8/maxresdefault.jpg" alt="Prisma Calendar — The Complete Encyclopedia" width="100%">
</a>

Every feature broken down from A to Z — views, events, recurrence, time tracking, categories, color rules, batch operations, filtering, integrations, AI, the API, and every setting. A full walkthrough and a long-term reference you can come back to anytime.

**[YouTube Playlist →](https://www.youtube.com/playlist?list=PLMVJknbUasLCULubO4MdCDvg9MyXu3kG4&utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_playlist)** — All Prisma Calendar videos.

</div>

---

## Free vs Pro

Prisma follows a freemium model — **all core features are completely free.** No account, no trial required, no limitations on the core experience. Just install and go.

For more connected, advanced workflows, **Prisma Pro** unlocks calendar synchronization, advanced visualizations, Bases integration for embedding views directly inside notes, and other power-user capabilities built for serious planning inside Obsidian.

**Try every Pro feature with a 30-day free trial. Cancel anytime.**

[![Start Free Trial](https://img.shields.io/badge/Start_Free_Trial_→-238636?style=for-the-badge)](https://matejvavroproductivity.com/tools/prisma-calendar/?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_free_trial)

<details>
<summary><strong>What you get for free</strong></summary>

<br>

Tabbed view navigation (Calendar, Timeline, Daily+Stats, Dual Daily), 55+ customizable header actions, up to 3 independent planning systems, up to 2 event presets, recurring events (9 types + custom intervals with real note generation), 50-action undo/redo, 10+ batch operations, built-in time tracker, capacity tracking, statistics dashboard, event groups, JavaScript color rules, advanced filtering with saved presets, desktop notifications, holidays (50+ countries), title autocomplete, auto-assign categories, untracked events inbox, ICS import/export, and 60+ hotkeys.

</details>

<details>
<summary><strong>What Pro adds</strong></summary>

<br>

AI Chat (Claude & GPT), Heatmap View, Dashboard, Gantt View, Bases Calendar View, Prerequisite Connections, CalDAV & ICS URL Sync, Programmatic API, Custom Category Presets, Unlimited Planning Systems, Unlimited Event Presets, and Priority Support.

**[Learn more about Free vs Pro →](https://real1tyy.github.io/Prisma-Calendar/features/free-vs-pro?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_free_vs_pro)**

</details>

---

## Why Pro?

**"Why should I pay for an Obsidian plugin?"**

Fair question. Here's the honest answer.

Prisma is fully free and feature-rich out of the box. You can use it forever without paying a cent. Pro exists for users who want to go deeper — external calendar sync, Gantt charts, heatmaps, AI features, the scripting API, and more.

But there's a bigger reason Pro matters.

There's a well-known pattern in the Obsidian ecosystem: a developer builds a great plugin, it gets popular, and then slowly gets abandoned. Life gets busy. Updates slow down. Bugs pile up. Eventually the plugin goes silent. That happens because maintaining a complex plugin takes serious, ongoing time — and most developers can't justify spending 20+ hours a week on something that doesn't pay the bills.

Pro breaks that cycle. Every Pro license directly funds full-time development of Prisma. It means I can prioritize this work, ship improvements consistently, fix bugs fast, and build the features you ask for.

This isn't a side project. It's my work. Pro is what makes that sustainable — for me and for everyone who uses Prisma, free or paid. If you rely on Prisma, Pro ensures it keeps improving — consistently and long-term.

> [!NOTE]
> I regularly publish update videos, and every change is documented in the [changelog](https://real1tyy.github.io/Prisma-Calendar/changelog?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_changelog). Prisma is under active, full-time development.

---

## Frequently Asked Questions

<details>
<summary><strong>Is my data safe?</strong></summary>

<br>

Prisma is 100% local-first. Your notes stay in your vault — nothing is uploaded, synced to my servers, or shared with anyone. There is zero client-side telemetry. The only server communication is Pro license verification, and if you use the free version, no data leaves your machine at all.

</details>

<details>
<summary><strong>Will it work with my existing notes?</strong></summary>

<br>

Yes. Prisma is schema-agnostic — it reads whatever frontmatter properties you already use. You tell it which fields represent your start date, end date, categories, and so on. No migration, no restructuring, no predefined schemas required.

</details>

<details>
<summary><strong>Is it hard to set up?</strong></summary>

<br>

Install it, point it at a folder, map your frontmatter fields — that's it. Most users are up and running in under 5 minutes. The [Quick Start video](#%EF%B8%8F-quick-start--see-prisma-in-action) above walks you through the entire process.

</details>

<details>
<summary><strong>Does it work on mobile?</strong></summary>

<br>

Yes. Core features work on mobile with a responsive design. I'm continuously improving the mobile experience based on user feedback.

</details>

<details>
<summary><strong>Can I sync with Google Calendar, Outlook, or Apple Calendar?</strong></summary>

<br>

Yes — through CalDAV and ICS integration. You can sync with Google Calendar, Outlook, Apple Calendar, iCloud, Fastmail, Nextcloud, and any service that supports CalDAV or ICS. Synced events become real Obsidian notes with full frontmatter. Automatic sync requires a Pro license, but you can also import and export `.ics` files manually for free.

</details>

<details>
<summary><strong>What happens if I stop paying for Pro?</strong></summary>

<br>

All free features keep working exactly as before. Pro features (Gantt, Heatmap, AI, CalDAV sync, etc.) deactivate, but nothing is deleted or lost. You can reactivate anytime.

</details>

<details>
<summary><strong>Will it slow down Obsidian?</strong></summary>

<br>

No. Prisma is built for performance and handles vaults with thousands of notes. The reactive engine only processes changes — it doesn't re-scan everything on every edit.

</details>

<details>
<summary><strong>Is my data locked into Prisma's format?</strong></summary>

<br>

No. Events are plain Markdown notes with standard YAML frontmatter. If you ever uninstall Prisma, your notes remain exactly as they are — readable, searchable, and usable by any other tool or plugin.

</details>

---

## 📦 Installation

Install via **BRAT**, the **Obsidian Community Plugin store**, or manually from [GitHub Releases](https://github.com/Real1tyy/Prisma-Calendar/releases?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_releases).

[![Installation Guide](https://img.shields.io/badge/Installation_Guide-1f6feb?style=for-the-badge)](https://real1tyy.github.io/Prisma-Calendar/installation?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_installation_guide)

---

## Support & Sponsorship

The best way to support Prisma Calendar is by purchasing a **[Pro License](https://real1tyy.github.io/Prisma-Calendar/features/free-vs-pro?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_advanced_features)**. You get powerful pro capabilities, priority support, and you directly fund continued development.

You can also support through a donation:

[![Donation Options](https://img.shields.io/badge/Donation_Options-8957e5?style=for-the-badge)](https://matejvavroproductivity.com/support/?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_donation)

## Third-Party Independence

Prisma Calendar is developed by [Matej Vavro](https://matejvavroproductivity.com/?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_author) and is an independent, third-party product. **I am not affiliated with, endorsed by, or sponsored by Obsidian (Dynalist Inc.).** Prisma Calendar is a third-party community plugin. All references to "Obsidian" are for descriptive and compatibility purposes only.

## Privacy & Telemetry

Prisma Calendar **does not include any client-side telemetry or analytics** — no vault content, file names, or personal data is ever transmitted. The only server communication happens during Pro license verification, which sends basic device and version info for activation seat management. **If you only use the free features, no data is collected at all.**

[Privacy Policy](https://matejvavroproductivity.com/privacy/?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_privacy) · [Terms of Service](https://matejvavroproductivity.com/terms/?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_terms) · [Legal Notice](https://matejvavroproductivity.com/legal/?utm_campaign=prisma_calendar&utm_source=github&utm_medium=repo&utm_content=readme_legal)

## License

[AGPL-3.0](./LICENSE).

---

## Credits & Acknowledgments

Prisma Calendar is built using [FullCalendar](https://fullcalendar.io/), a powerful and flexible JavaScript calendar library. FullCalendar provides the robust calendar rendering engine that powers Prisma Calendar's views and interactions. I'm grateful to the FullCalendar team for creating such an excellent foundation.

---

> **This repository is a public, read-only mirror.** Development happens in a private monorepo — this mirror exists for transparency and to follow the Obsidian convention of one repo per plugin. The code is licensed AGPL-3.0.
