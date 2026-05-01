---
slug: /
title: Prisma Calendar
---
import useBaseUrl from '@docusaurus/useBaseUrl';

<div align="center">

# Prisma Calendar

![Downloads](https://img.shields.io/github/downloads/Real1tyy/Prisma-Calendar/total?label=Downloads&style=for-the-badge) ![Release](https://img.shields.io/github/v/release/Real1tyy/Prisma-Calendar?label=Latest%20Release&style=for-the-badge) ![Stars](https://img.shields.io/github/stars/Real1tyy/Prisma-Calendar?style=for-the-badge)

**Turn any note with a date into a flexible planning system inside Obsidian.**

Visualize, manage, and analyze tasks, projects, habits, meetings, and anything with a date — using the frontmatter you already have. No rigid schemas. No forced structure. Just your data, your rules, and four ways to see your vault through time.

Every setting configurable. Every change instant. Every action undoable.

**[View Full Product Page →](https://matejvavroproductivity.com/tools/prisma-calendar/?utm_campaign=prisma_calendar&utm_source=docs&utm_medium=intro&utm_content=product_page)**

</div>

<div style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video autoPlay muted loop playsInline style={{"width": "100%", "borderRadius": "12px", "boxShadow": "0 8px 30px rgba(0,0,0,0.3)"}}>
    <source src={useBaseUrl("/video/LandingPageUnifiedViews.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/LandingPageUnifiedViews.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

<div align="center">

**Project timelines** · **Recurring tasks** · **Meeting schedules** · **Habit tracking** · **Content calendars** · **Workload planning** · **Time analysis** · **Anything with a date**

---

## ▶️ Quick Start — See Prisma in Action

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <iframe
    style={{"width":"100%", "aspectRatio": "16/9"}}
    src="https://www.youtube.com/embed/dziQK9UQhvE"
    title="Prisma Calendar — Quick Start"
    frameBorder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen>
  </iframe>
</div>

Install, configure, and start planning in under 10 minutes.

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

You can change property names anytime in **Settings → Prisma Calendar → General**. See [Configuration](/configuration) for full details.

---

## Why Prisma?

<div align="center">

Other calendar plugins help you navigate dates.<br/>
Prisma helps you **operate on time-based data**.

</div>

| | Google Calendar | Notion | Other Obsidian plugins | **Prisma** |
|---|---|---|---|---|
| Works with your own markdown fields | ❌ | ❌ | Partial | ✅ |
| Native to your Obsidian vault | ❌ | ❌ | ✅ | ✅ |
| Multiple views (Calendar, Timeline, Heatmap, Gantt) | ❌ | Partial | ❌ | ✅ |
| Recurring events that generate real notes | ❌ | ❌ | ❌ | ✅ |
| Batch operations, undo/redo, statistics | ❌ | Partial | ❌ | ✅ |
| Local-first, no cloud dependency | ❌ | ❌ | ✅ | ✅ |

---

## Four Views. Four Ways to See Your Vault Through Time.

| | |
|---|---|
| **📅 Calendar** — Year, month, week, day, and list views for daily scheduling. Drag events, resize durations, create directly on the grid. | **📊 Timeline** — Horizontal sequencing — see how events flow across days and weeks. Perfect for project phases and deadlines. |
| **🔥 Heatmap** <sup>Pro</sup> — GitHub-style contribution view. Spot patterns, gaps, and consistency at a glance across months or years. | **📐 Gantt** <sup>Pro</sup> — Dependency-aware project planning. Link tasks with prerequisites and visualize the critical path. |

:::tip Start simple
You don't need all four views on day one. Begin with the Calendar view and explore from there. Prisma is designed to grow with your system — start with the basics and go deeper when you're ready.
:::

---

## What Makes Prisma Different

### Configure Everything
Other tools force their workflow on you. Prisma adapts to yours. Map your own frontmatter properties, define JavaScript-powered [color rules](/features/organization/color-rules), set up advanced [filters](/features/organization/filtering), and customize appearance down to event text, icons, and density. Run **multiple independent planning systems** — each with their own settings and folder scope. [Learn more →](/features/calendar/multiple-calendars)

### Fully Reactive
There's no "restart Obsidian to apply changes" here. Every setting change, every color rule tweak, every filter adjustment takes effect **immediately**. Edit a note's frontmatter and watch the calendar update in real time.

### Undo and Redo Everything
Made a mistake? Hit undo. Changed your mind? Redo. Every action — creating, editing, moving, deleting, batch operations — is tracked in a full history. You'll see exactly what's being reversed, so you're always in control. [Learn more →](/features/management/undo-redo)

### Recurring Events That Generate Real Notes
Most calendar plugins show recurring events as ephemeral entries. In Prisma, recurring events create **actual Obsidian notes** — one per instance, fully linked back to the source. Define a frequency (daily, weekly, bi-weekly, monthly, or a [custom DSL](/features/events/recurring-dsl)) and Prisma handles the rest. [Virtual previews](/features/events/virtual-events) show future instances without cluttering your vault. [Learn more →](/features/events/event-groups)

### Batch Operations
Managing 50 events one by one? No. Select multiple events and delete, duplicate, move, clone, skip, or open them — all at once. Shift entire weeks forward or backward. [Learn more →](/features/management/batch-operations)

### Smart Categories
Define [categories](/features/organization/categories) with color coding, then let Prisma **auto-assign them** based on event names. [Title autocomplete](/features/events/title-autocomplete) keeps naming consistent and prevents typos. Categories also power event group aggregation, giving you a bird's-eye view of related events across your entire planning system.

### Statistics and Time Insights
See where your time actually goes. Pie charts, category breakdowns, and detailed tables — filterable by day, week, month, or all time. Recurring series get their own [statistics](/features/organization/statistics) so you can track consistency and trends over time.

### Built-in Notifications
Set up reminders and get [notified](/features/management/notifications) directly inside Obsidian — no external tools needed.

### Time Tracker
Start and stop a timer from any event modal. Track actual time spent vs planned durations and build a real picture of how your time is used. [Learn more →](/features/management/time-tracker)

### Event Presets and Templates
Create reusable [event presets](/features/events/event-presets) with pre-filled frontmatter so you can spin up new events in seconds. Pair with [Templater integration](/features/advanced/templater) for template-driven workflows.

### Scriptable via API
Prisma exposes a [programmatic API](/features/advanced/programmatic-api/overview) — create, modify, and query events from scripts, Templater templates, or other plugins. Automate workflows and integrate your planning system into your broader Obsidian setup.

### CalDAV and ICS Sync
Connect your external calendars. Sync with Fastmail, Nextcloud, iCloud, Google Calendar, Outlook, and any CalDAV/ICS-compatible service. Synced events become real Obsidian notes with full frontmatter — no black-box sync, just your data in your vault. [Learn more →](/features/advanced/integrations)

### Tabbed Views
Switch between Calendar (year/month/week/day/list), [Timeline](/features/views/timeline), [Daily+Stats](/features/views/daily-stats), and [Dual Daily](/features/views/dual-daily) — all in a persistent [tabbed container](/features/views/tabbed-views). Pro adds [Heatmap](/features/views/heatmap), [Gantt](/features/views/gantt), and [Dashboard](/features/views/dashboard). Zoom time slots from 1 to 60 minutes. Display frontmatter properties directly inside event chips.

### 55+ Header Actions
One-click [shortcut buttons](/features/views/header-actions) for any command — fully customizable. Reorder, rename, change icons and colors, or hide actions via the gear button.

### Capacity Tracking
See at a glance how full your schedule is — used vs total hours with remaining time and auto-inferred boundaries. [Learn more →](/features/views/capacity-tracking)

### Global Event Management
Browse, search, and manage all events across all planning systems from a single interface. Auto-group by recurring rule, category, or name with the [Event Series Modal](/features/events/event-groups). [Learn more →](/features/management/global-events-management)

---

## 📸 Gallery

<div style={{"marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "borderRadius": "8px", "marginBottom": "1em"}}>
    <source src={useBaseUrl("/video/HeatmapViewPreview.mp4")} type="video/mp4" />
  </video>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/DailyStatsViewPreview.mp4")} type="video/mp4" />
  </video>
</div>

---

## 🎬 Go Deeper — The Complete Encyclopedia

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <iframe
    style={{"width":"100%", "aspectRatio": "16/9"}}
    src="https://www.youtube.com/embed/HrcNKh6uFH8"
    title="Prisma Calendar — The Complete Encyclopedia"
    frameBorder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen>
  </iframe>
</div>

Every feature broken down from A to Z — views, events, recurrence, time tracking, categories, color rules, batch operations, filtering, integrations, AI, the API, and every setting. A full walkthrough and a long-term reference you can come back to anytime.

**[YouTube Playlist →](https://www.youtube.com/playlist?list=PLMVJknbUasLCULubO4MdCDvg9MyXu3kG4)** — All Prisma Calendar videos.

---

## 📚 Documentation

[Installation](/installation) • [Quickstart](/quickstart) • [Configuration](/configuration) • [Features Overview](/features/overview) • [FAQ](/faq) • [Troubleshooting](/troubleshooting)

---

## Free vs Pro

Prisma follows a freemium model — **all core features are completely free.** No account, no trial required, no limitations on the core experience. Just install and go.

For more connected, advanced workflows, **Prisma Pro** unlocks calendar synchronization, advanced visualizations, Bases integration for embedding views directly inside notes, and other power-user capabilities built for serious planning inside Obsidian.

**Try every Pro feature with a 30-day free trial. Cancel anytime.**

**[Start your free trial →](https://matejvavroproductivity.com/tools/prisma-calendar/?utm_campaign=prisma_calendar&utm_source=docs&utm_medium=intro&utm_content=free_trial)**

<details>
<summary><strong>What you get for free</strong></summary>

Tabbed view navigation (Calendar, Timeline, Daily+Stats, Dual Daily), 55+ customizable header actions, up to 3 independent planning systems, up to 2 event presets, recurring events (9 types + custom intervals with real note generation), 50-action undo/redo, 10+ batch operations, built-in time tracker, capacity tracking, statistics dashboard, event groups, JavaScript color rules, advanced filtering with saved presets, desktop notifications, holidays (50+ countries), title autocomplete, auto-assign categories, untracked events inbox, ICS import/export, and 60+ hotkeys.

</details>

<details>
<summary><strong>What Pro adds</strong></summary>

AI Chat (Claude & GPT), Heatmap View, Dashboard, Gantt View, Bases Calendar View, Prerequisite Connections, CalDAV & ICS URL Sync, Programmatic API, Custom Category Presets, Unlimited Planning Systems, Unlimited Event Presets, and Priority Support.

[Learn more about Free vs Pro →](/features/free-vs-pro)

</details>

---

## Why Pro?

**"Why should I pay for an Obsidian plugin?"**

Fair question. Here's the honest answer.

Prisma is fully free and feature-rich out of the box. You can use it forever without paying a cent. Pro exists for users who want to go deeper — external calendar sync, Gantt charts, heatmaps, AI features, the scripting API, and more.

But there's a bigger reason Pro matters.

There's a well-known pattern in the Obsidian ecosystem: a developer builds a great plugin, it gets popular, and then slowly gets abandoned. Life gets busy. Updates slow down. Bugs pile up. Eventually the plugin goes silent. That happens because maintaining a complex plugin takes serious, ongoing time — and most developers can't justify spending 20+ hours a week on something that doesn't pay the bills.

Pro breaks that cycle. Every Pro license directly funds full-time development of Prisma. It means I can prioritize this work, ship improvements consistently, fix bugs fast, and build the features you ask for.

This isn't a side project. It's my work. Pro is what makes that sustainable — for me and for everyone who uses Prisma, free or paid.

:::note Active Development
I regularly publish update videos, and every change is documented in the [changelog](/changelog). Prisma is under active, full-time development.
:::

---

## Frequently Asked Questions

<details>
<summary><strong>Is my data safe?</strong></summary>

Prisma is 100% local-first. Your notes stay in your vault — nothing is uploaded, synced to my servers, or shared with anyone. There is zero client-side telemetry. The only server communication is Pro license verification, and if you use the free version, no data leaves your machine at all.

</details>

<details>
<summary><strong>Will it work with my existing notes?</strong></summary>

Yes. Prisma is schema-agnostic — it reads whatever frontmatter properties you already use. You tell it which fields represent your start date, end date, categories, and so on. No migration, no restructuring, no predefined schemas required.

</details>

<details>
<summary><strong>Is it hard to set up?</strong></summary>

Install it, point it at a folder, map your frontmatter fields — that's it. Most users are up and running in under 5 minutes. The Quick Start video above walks you through the entire process.

</details>

<details>
<summary><strong>Does it work on mobile?</strong></summary>

Yes. Core features work on mobile with a responsive design. I'm continuously improving the mobile experience based on user feedback.

</details>

<details>
<summary><strong>Can I sync with Google Calendar, Outlook, or Apple Calendar?</strong></summary>

Yes — through CalDAV and ICS integration. You can sync with Google Calendar, Outlook, Apple Calendar, iCloud, Fastmail, Nextcloud, and any service that supports CalDAV or ICS. Synced events become real Obsidian notes with full frontmatter. Automatic sync requires a Pro license, but you can also import and export `.ics` files manually for free.

</details>

<details>
<summary><strong>What happens if I stop paying for Pro?</strong></summary>

All free features keep working exactly as before. Pro features (Gantt, Heatmap, AI, CalDAV sync, etc.) deactivate, but nothing is deleted or lost. You can reactivate anytime.

</details>

<details>
<summary><strong>Will it slow down Obsidian?</strong></summary>

No. Prisma is built for performance and handles vaults with thousands of notes. The reactive engine only processes changes — it doesn't re-scan everything on every edit.

<details>
<summary><strong>Is my data locked into Prisma's format?</strong></summary>

No. Events are plain Markdown notes with standard YAML frontmatter. If you ever uninstall Prisma, your notes remain exactly as they are — readable, searchable, and usable by any other tool or plugin.

</details>

---

## 📦 Installation

Install via **BRAT**, the **Obsidian Community Plugin store**, or manually from [GitHub Releases](https://github.com/Real1tyy/Prisma-Calendar/releases).

**[Full installation guide →](/installation)**

---

## Help Shape the Future

This plugin is under active development and is personally used every day by the developer. The goal is to make it the best calendar for Obsidian, and community feedback is crucial.

Have an idea or a feature request?
1.  **Open an Issue** on the [GitHub repository](https://github.com/Real1tyy/Prisma-Calendar/issues).
2.  **Upvote Existing Ideas**: If you see a feature request you'd like, give it a 👍 reaction.

---

## Third-Party Independence

Prisma Calendar is developed by [Matej Vavro](https://matejvavroproductivity.com/?utm_campaign=prisma_calendar&utm_source=docs&utm_medium=intro&utm_content=author) and is an independent, third-party product. **It is not affiliated with, endorsed by, or sponsored by Obsidian (Dynalist Inc.).** Prisma Calendar is a third-party community plugin distributed through Obsidian's community plugin marketplace. All references to "Obsidian" are for descriptive and compatibility purposes only and do not imply any official partnership or endorsement.

## Privacy & Telemetry

Prisma Calendar **does not include any client-side telemetry or analytics** — no vault content, file names, or personal data is ever transmitted. The only server communication happens during Pro license verification, which sends basic device and version info for activation seat management. **If you only use the free features, no data is collected at all.**

[Privacy Policy](https://matejvavroproductivity.com/privacy/?utm_campaign=prisma_calendar&utm_source=docs&utm_medium=intro&utm_content=privacy) · [Terms of Service](https://matejvavroproductivity.com/terms/?utm_campaign=prisma_calendar&utm_source=docs&utm_medium=intro&utm_content=terms) · [Legal Notice](https://matejvavroproductivity.com/legal/?utm_campaign=prisma_calendar&utm_source=docs&utm_medium=intro&utm_content=legal)

---

## Credits & Acknowledgments

Prisma Calendar is built using [FullCalendar](https://fullcalendar.io/), a powerful and flexible JavaScript calendar library. FullCalendar provides the robust calendar rendering engine that powers Prisma Calendar's views and interactions. I'm grateful to the FullCalendar team for creating such an excellent foundation.
