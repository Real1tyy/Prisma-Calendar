---
slug: /
title: Prisma Calendar
---
import useBaseUrl from '@docusaurus/useBaseUrl';

<div align="center">

# Prisma Calendar

![Downloads](https://img.shields.io/github/downloads/Real1tyy/Prisma-Calendar/total?label=Downloads&style=for-the-badge) ![Release](https://img.shields.io/github/v/release/Real1tyy/Prisma-Calendar?label=Latest%20Release&style=for-the-badge) ![Stars](https://img.shields.io/github/stars/Real1tyy/Prisma-Calendar?style=for-the-badge)

**The Ultimate Flexible Planning System for Obsidian.**

Prisma Calendar is a **schema-agnostic planning system** that turns any Obsidian note with a date into a first-class citizen on your timeline. No rigid schemas, no predefined fields — just your data, your rules, your filters, rendered exactly how you need it.

It's not just a calendar. It's a way to **see your entire vault through time**.

Every setting is configurable. Every change is reactive. Every action is undoable.

**Four dedicated views — four ways to understand time.** Calendar for scheduling, Timeline for sequencing, Heatmap for patterns, and Gantt for dependencies. Each reveals a different perspective, and together they turn Prisma into a complete planning system.

Recurring events that generate real notes. Batch operations across dozens of events. Time-based statistics. CalDAV sync. A scriptable API. Prisma Calendar handles the workflows other planning tools can't.

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

### The Missing Piece for Your Obsidian Workflow

Other Obsidian calendar plugins give you a basic view. Prisma Calendar gives you **a complete planning system** — with the depth of a standalone app and the seamless integration only a native plugin can offer.

The core challenge for power users is simple: how do you visualize entirely disparate records — sharing only a timestamp — in a single, cohesive view? Prisma solves this by stepping beyond the definition of a "calendar." It is a planning system that takes any data with a time parameter and renders it using your custom rules, properties, and filters. Projects, habits, meetings, tasks, people — if it has a date, Prisma displays it.

Prisma is fundamentally different from any conventional calendar. Tools like Google Calendar lock you into predefined fields that rarely fit complex needs. Platforms like Notion lack the seamless database visualization required for advanced workflows. Prisma breaks free from both.

It takes any data with a time parameter and projects it onto a unified, fully customizable timeline. For Obsidian users managing thousands of heavily customized markdown files, Prisma flawlessly renders those individual properties onto a single cohesive view — turning your vault into a full **enterprise resource planning** system. Plan projects, track habits, manage people, schedule tasks — all powered by the frontmatter you already write.

Prisma is production-ready, fully featured, and built for users who demand absolute freedom over how their information is visualized.

---

## 🎬 The Complete Encyclopedia

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

**Every feature systematically broken down from A to Z**: views, event management, recurring events, time tracking, categories, color rules, batch operations, filtering, integrations, AI, the programmatic API, and every setting explained. This is both a full walkthrough and a long-term reference — the definitive video for Prisma Calendar.

**[YouTube Playlist →](https://www.youtube.com/playlist?list=PLMVJknbUasLCULubO4MdCDvg9MyXu3kG4)** — All Prisma Calendar videos.

## Gallery

</div>

<div style={{"marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "borderRadius": "8px", "marginBottom": "1em"}}>
    <source src={useBaseUrl("/video/HeatmapViewPreview.mp4")} type="video/mp4" />
  </video>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/DailyStatsViewPreview.mp4")} type="video/mp4" />
  </video>
</div>

---

## 📚 **Documentation**

Quick Links:
- [Installation](/installation) • [Quickstart](/quickstart) • [Configuration](/configuration)
- [Features Overview](/features/overview) • [FAQ](/faq) • [Troubleshooting](/troubleshooting)

---

## Why Prisma Calendar?

### Configure Literally Everything
Prisma Calendar adapts to you, not the other way around. Map your own frontmatter properties, define JavaScript-powered [color rules](/features/organization/color-rules), set up advanced [filters](/features/organization/filtering), and customize the appearance down to event text, icons, and density. Manage **multiple independent planning systems**, each with their own settings and folder scope. [Learn more →](/features/calendar/multiple-calendars)

### Fully Reactive — Changes Propagate Instantly
There's no "restart Obsidian to apply changes" here. Every setting change, every color rule tweak, every filter adjustment takes effect **immediately**. Edit a note's frontmatter and watch the planning system update in real time. This isn't a static display — it's a live, reactive system.

### Undo and Redo Everything
Every action you take — creating, editing, moving, deleting, batch operations — is tracked in a full memento history. Made a mistake? Hit undo. Changed your mind? Redo. You'll see exactly what's being reversed ("Undo Batch Delete", "Undo Move Event") so you're always in control. [Learn more →](/features/management/undo-redo)

### Recurring Events That Actually Work
Define a source node with a frequency (daily, weekly, bi-weekly, monthly, or a [custom DSL](/features/events/recurring-dsl)), and Prisma generates **real Obsidian notes** for each instance — fully linked back to the source. [Virtual previews](/features/events/virtual-events) let you see future instances without cluttering your vault. Navigate between instances with one click, and view statistics about your recurring series at a glance. [Learn more →](/features/events/event-groups)

### Batch Operations at Scale
Select multiple events and delete, duplicate, move, clone, skip, or open them — all at once. Shift entire weeks of events forward or backward. When you're managing a busy schedule, this isn't a nice-to-have — it's essential. [Learn more →](/features/management/batch-operations)

### Smart Categories with Title Autocomplete
Define [categories](/features/organization/categories) with color coding, then let Prisma **auto-assign them** based on event names. [Title autocomplete](/features/events/title-autocomplete) suggests matching names as you type, keeping naming consistent and preventing typos. Categories also power event group aggregation, giving you a bird's-eye view of related events across your planning system.

### Statistics and Time Insights
Track how you spend your time with visual [statistics](/features/organization/statistics) — pie charts, breakdowns by category, and detailed tables — all filterable by time horizon. See where your hours go across days, weeks, or months. Recurring event series get their own statistics too, so you can track consistency and trends.

### Built-in Notifications
Set up reminders for your events and get [notified](/features/management/notifications) directly inside Obsidian. Never miss an important event without needing an external tool.

### Time Tracker
Start and stop a timer directly from any event modal. Track actual time spent on tasks, compare it against planned durations, and build a real picture of how your time is used. [Learn more →](/features/management/time-tracker)

### Event Presets and Templates
Create reusable [event presets](/features/events/event-presets) so you can spin up new events with pre-filled frontmatter in seconds. Pair with [Templater integration](/features/advanced/templater) for even more powerful template-driven workflows.

### Scriptable via Programmatic API
Prisma Calendar exposes a [programmatic API](/features/advanced/programmatic-api/overview), so you can create, modify, and query events from scripts, Templater templates, or other plugins. Automate event creation, build custom workflows, and integrate your planning system into your broader Obsidian setup.

### CalDAV and ICS Integration
Sync events from external CalDAV servers (Fastmail, Nextcloud, iCloud, and more) or import/export `.ics` files — compatible with Google Calendar, Microsoft Outlook, and any service that supports the ICS standard. Synced events become real Obsidian notes with full frontmatter. Connect multiple sources to different calendars with configurable auto-sync intervals. [Learn more →](/features/advanced/integrations)

### Tabbed Views
Switch between Calendar (month/week/day/list), [Timeline](/features/views/timeline), [Daily+Stats](/features/views/daily-stats), and [Dual Daily](/features/views/dual-daily) views — all in a persistent [tabbed container](/features/views/tabbed-views). Tabs can be reordered, renamed, and hidden. Pro adds [Heatmap](/features/views/heatmap), [Gantt](/features/views/gantt), and [Dashboard](/features/views/dashboard). Zoom into time slots from 1 to 60 minutes. Display frontmatter properties inside event chips. Filter with complex expressions.

### 55+ Header Actions
One-click [shortcut buttons](/features/views/header-actions) for event creation, search, statistics, category highlighting, undo/redo, AI chat, and more — all customizable. Reorder, rename, change icons and colors, or hide actions via the gear button.

### Capacity Tracking
See at a glance how full your schedule is. A compact indicator shows today's used vs total hours (e.g., "7h 30m / 11h (68%)") with remaining time and auto-inferred boundaries. [Learn more →](/features/views/capacity-tracking)

### Global Event Management
Browse, search, and manage all events across all your planning systems from a single unified interface. Auto-group events by recurring rule, category, or name with the [Event Series Modal](/features/events/event-groups). View series statistics, timelines, and heatmaps from [one place](/features/management/global-events-management).

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

---

## 📱 **Mobile Support**

Core features work on mobile without any problems. The design is responsive, and I'm continuously tightening up the mobile experience based on feedback to make it rock solid. If you run into anything, please open a [GitHub issue](https://github.com/Real1tyy/Prisma-Calendar/issues).

---

## 📦 Installation

Install via **BRAT**, the **Obsidian Community Plugin store**, or manually from [GitHub Releases](https://github.com/Real1tyy/Prisma-Calendar/releases).

**[Full installation guide →](/installation)**

## Free vs Pro

Prisma Calendar is free and fully-featured out of the box — no account, no trial, no limitations on the core experience.

[Learn more about Free vs Pro →](/features/free-vs-pro)

### What you get for free

Tabbed view navigation (Calendar, Timeline, Daily+Stats, Dual Daily), 55+ customizable header actions, up to 3 independent planning systems, up to 2 event presets, recurring events (9 types + custom intervals with real note generation), 50-action undo/redo, 10+ batch operations, built-in time tracker, capacity tracking, statistics dashboard, event groups, JavaScript color rules, advanced filtering with saved presets, desktop notifications, holidays (50+ countries), title autocomplete, auto-assign categories, untracked events inbox, ICS import/export, and 60+ hotkeys.

### What Pro adds

AI Chat (Claude & GPT), Heatmap View, Dashboard, Gantt View, Bases Calendar View, Prerequisite Connections, CalDAV & ICS URL Sync, Programmatic API, Custom Category Presets, Unlimited Planning Systems, Unlimited Event Presets, and Priority Support.

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
