---
slug: /
title: Prisma Calendar
---
import useBaseUrl from '@docusaurus/useBaseUrl';

<div align="center">

# Prisma Calendar

![Downloads](https://img.shields.io/github/downloads/Real1tyy/Prisma-Calendar/total?label=Downloads&style=for-the-badge) ![Release](https://img.shields.io/github/v/release/Real1tyy/Prisma-Calendar?label=Latest%20Release&style=for-the-badge) ![Stars](https://img.shields.io/github/stars/Real1tyy/Prisma-Calendar?style=for-the-badge)

**The Ultimate Temporal Visualization Engine for Obsidian.**

Prisma Calendar is a **schema-agnostic visualization layer** that turns any Obsidian note with a date into a first-class citizen on your timeline. No rigid schemas, no predefined fields — just your data, your rules, your filters, rendered exactly how you need it.

It's not just a calendar. It's a way to **see your entire vault through time**.

Every setting is configurable. Every change is reactive. Every action is undoable.

Recurring events that generate real notes. Batch operations across dozens of events. Time-based statistics. CalDAV sync. A scriptable API. Prisma Calendar handles the workflows other calendars can't.

**[View Full Product Page →](https://matejvavroproductivity.com/tools/prisma-calendar/)**

</div>

<div style={{"textAlign": "center", "marginBottom": "2em"}}>
  <img src={useBaseUrl("/img/landing_page.png")} alt="Prisma Calendar Preview" style={{"width": "100%", "maxWidth": "900px", "borderRadius": "12px", "boxShadow": "0 8px 30px rgba(0,0,0,0.3)"}} />
</div>

<div align="center">

### The Missing Piece for Your Obsidian Workflow

Other Obsidian calendar plugins give you a basic view. Prisma Calendar gives you **a complete event management platform** — with the depth of a standalone app and the seamless integration only a native plugin can offer.

The core challenge for power users is simple: how do you visualize entirely disparate records — sharing only a timestamp — in a single, cohesive view? Prisma solves this by stepping beyond the definition of a "calendar." It is a visualization layer that takes any data with a time parameter and renders it using your custom rules, properties, and filters. Projects, habits, meetings, tasks, people — if it has a date, Prisma displays it.

Prisma is fundamentally different from any conventional calendar. Tools like Google Calendar lock you into predefined fields that rarely fit complex needs. Platforms like Notion lack the seamless database visualization required for advanced workflows. Prisma breaks free from both.

It takes any data with a time parameter and projects it onto a unified, fully customizable timeline. For Obsidian users managing thousands of heavily customized markdown files, Prisma flawlessly renders those individual properties onto a single cohesive view — turning your vault into a full **enterprise resource planning** system. Plan projects, track habits, manage people, schedule tasks — all powered by the frontmatter you already write.

Prisma is production-ready, fully featured, and built for users who demand absolute freedom over how their information is visualized.

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

## Preview

</div>

<div style={{"display": "flex", "flexWrap": "wrap", "gap": "1em", "justifyContent": "center", "marginBottom": "1em"}}>
  <video controls autoPlay loop muted playsInline style={{"flex": "1 1 45%", "minWidth": "300px", "maxWidth": "50%", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/StatisticPiechart.webm")} type="video/webm" />
  </video>
  <video controls autoPlay loop muted playsInline style={{"flex": "1 1 45%", "minWidth": "300px", "maxWidth": "50%", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/BatchFull.webm")} type="video/webm" />
  </video>
</div>

<div style={{"display": "flex", "flexWrap": "wrap", "gap": "1em", "justifyContent": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"flex": "1 1 45%", "minWidth": "300px", "maxWidth": "50%", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/ReaccuringEvents.webm")} type="video/webm" />
  </video>
  <video controls autoPlay loop muted playsInline style={{"flex": "1 1 45%", "minWidth": "300px", "maxWidth": "50%", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/UntrackedEvents.webm")} type="video/webm" />
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
Prisma Calendar adapts to you, not the other way around. Map your own frontmatter properties, define JavaScript-powered [color rules](/features/organization/color-rules), set up advanced [filters](/features/organization/filtering), and customize the calendar appearance down to event text, icons, and density. Manage **multiple independent calendars**, each with their own settings and folder scope. [Learn more →](/features/calendar/multiple-calendars)

### Fully Reactive — Changes Propagate Instantly
There's no "restart Obsidian to apply changes" here. Every setting change, every color rule tweak, every filter adjustment takes effect **immediately**. Edit a note's frontmatter and watch the calendar update in real time. This isn't a static display — it's a live, reactive system.

### Undo and Redo Everything
Every action you take — creating, editing, moving, deleting, batch operations — is tracked in a full memento history. Made a mistake? Hit undo. Changed your mind? Redo. You'll see exactly what's being reversed ("Undo Batch Delete", "Undo Move Event") so you're always in control. [Learn more →](/features/management/undo-redo)

### Recurring Events That Actually Work
Define a source node with a frequency (daily, weekly, bi-weekly, monthly, or a [custom DSL](/features/events/recurring-dsl)), and Prisma generates **real Obsidian notes** for each instance — fully linked back to the source. [Virtual previews](/features/events/virtual-events) let you see future instances without cluttering your vault. Navigate between instances with one click, and view statistics about your recurring series at a glance. [Learn more →](/features/events/event-groups)

### Batch Operations at Scale
Select multiple events and delete, duplicate, move, clone, skip, or open them — all at once. Shift entire weeks of events forward or backward. When you're managing a busy schedule, this isn't a nice-to-have — it's essential. [Learn more →](/features/management/batch-operations)

### Smart Categories with Title Autocomplete
Define [categories](/features/organization/categories) with color coding, then let Prisma **auto-assign them** based on event names. [Title autocomplete](/features/events/title-autocomplete) suggests matching names as you type, keeping naming consistent and preventing typos. Categories also power event group aggregation, giving you a bird's-eye view of related events across your calendar.

### Statistics and Time Insights
Track how you spend your time with visual [statistics](/features/organization/statistics) — pie charts, breakdowns by category, and detailed tables — all filterable by time horizon. See where your hours go across days, weeks, or months. Recurring event series get their own statistics too, so you can track consistency and trends.

### Built-in Notifications
Set up reminders for your events and get [notified](/features/management/notifications) directly inside Obsidian. Never miss an important event without needing an external tool.

### Time Tracker
Start and stop a timer directly from any event modal. Track actual time spent on tasks, compare it against planned durations, and build a real picture of how your time is used. [Learn more →](/features/management/time-tracker)

### Event Presets and Templates
Create reusable [event presets](/features/events/event-presets) so you can spin up new events with pre-filled frontmatter in seconds. Pair with [Templater integration](/features/advanced/templater) for even more powerful template-driven workflows.

### Scriptable via Programmatic API
Prisma Calendar exposes a [programmatic API](/features/advanced/programmatic-api), so you can create, modify, and query events from scripts, Templater templates, or other plugins. Automate event creation, build custom workflows, and integrate your calendar into your broader Obsidian setup.

### CalDAV and ICS Integration
Sync events from external CalDAV servers (Fastmail, Nextcloud, iCloud, and more) or import/export `.ics` files — compatible with Google Calendar, Microsoft Outlook, and any service that supports the ICS standard. Synced events become real Obsidian notes with full frontmatter. Connect multiple sources to different calendars with configurable auto-sync intervals. [Learn more →](/features/advanced/integrations)

### Multiple Views, Full Control
Switch between month, week, day, and list views. Zoom into time slots from 1 to 60 minutes. Display extra frontmatter properties inside event chips. Filter events with complex expressions. Toggle [holidays](/features/calendar/holidays) on or off. The calendar looks and works exactly how you want it to. [Learn more →](/features/calendar/calendar-view)

### Global Event Management
Browse, search, and manage all events across all your calendars from a single unified interface. No more hunting through folders — everything is accessible from [one place](/features/management/global-events-management).

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

### What you get for free

| Feature | Details |
|---------|---------|
| **4 Calendar Views** | Month, Week, Day, List — CTRL+scroll zoom and density options |
| **Up to 3 Calendars** | Independent settings, directories, property mappings, and views |
| **Up to 2 Event Presets** | Quick event creation with pre-filled frontmatter |
| **Recurring Events** | 9 recurrence types + custom intervals, real notes, virtual previews |
| **50-Action Undo/Redo** | Full memento history for every operation |
| **10+ Batch Operations** | Multi-select delete, duplicate, move, clone, skip, and more |
| **Time Tracker** | Built-in stopwatch with start, break, resume, minimize |
| **Statistics Dashboard** | Pie charts, category breakdowns, daily/weekly/monthly/all-time |
| **Color Rules** | JavaScript expressions mapping frontmatter to colors |
| **Advanced Filtering** | Text search + JS expression filters + saved presets |
| **Desktop Notifications** | Configurable lead time, snooze, per-event overrides |
| **Holidays** | 50+ countries offline, ~20 language locales |
| **Title Autocomplete** | Ghost text from categories, presets, and history |
| **Auto-Assign Categories** | Automatic matching when event name matches category name |
| **ICS Import/Export** | Manual `.ics` file exchange with any calendar app |
| **30+ Hotkeys** | Full keyboard control for navigation and operations |

### What Pro adds

| Feature | Details |
|---------|---------|
| **AI Chat** | Built-in sidebar with Claude and GPT — query, create, edit, and plan via natural language |
| **CalDAV & ICS URL Sync** | One-way read-only sync from Google Calendar, Apple Calendar, Fastmail, Nextcloud, iCloud |
| **Programmatic API** | `window.PrismaCalendar` and URL scheme for full CRUD, batch ops, and scripting |
| **Custom Category Presets** | Map event names to categories with comma-separated rules |
| **Unlimited Calendars** | Remove the 3-calendar limit |
| **Unlimited Event Presets** | Remove the 2-preset limit |
| **Priority Support** | First in line for help and feature requests |

[Learn more about Free vs Pro →](/features/free-vs-pro)

---

## Help Shape the Future

This plugin is under active development and is personally used every day by the developer. The goal is to make it the best calendar for Obsidian, and community feedback is crucial.

Have an idea or a feature request?
1.  **Open an Issue** on our [GitHub repository](https://github.com/Real1tyy/Prisma-Calendar/issues).
2.  **Upvote Existing Ideas**: If you see a feature request you'd like, give it a 👍 reaction.

---

## Third-Party Independence

Prisma Calendar is developed by [Matej Vavro](https://matejvavroproductivity.com/) and is an independent, third-party product. **We are not affiliated with, endorsed by, or sponsored by Obsidian (Dynalist Inc.).** Prisma Calendar is a third-party community plugin distributed through Obsidian's community plugin marketplace. All references to "Obsidian" are for descriptive and compatibility purposes only and do not imply any official partnership or endorsement.

## Privacy & Telemetry

Prisma Calendar **does not include any client-side telemetry or analytics**. No vault content, file names, note content, or personal data from your Obsidian vault is ever transmitted.

**Server-side telemetry** is collected exclusively during license verification requests for Pro (advanced) features. When the plugin contacts the license server, the following data is transmitted:

- License key
- Plugin version
- Obsidian version
- Operating system / platform
- Device identifier (a locally generated unique ID)
- Device name

This data is used solely for license validation, activation seat management (up to 5 devices per license), compatibility monitoring, abuse prevention, and product improvement. **If you only use the free features, no telemetry data is collected.**

This approach complies with [Obsidian Developer Policies](https://docs.obsidian.md/Developer+policies), which permit server-side telemetry with disclosure and a linked privacy policy, while prohibiting client-side telemetry.

For full details, please review the legal documents:

- [Privacy Policy](https://matejvavroproductivity.com/privacy/)
- [Terms of Service](https://matejvavroproductivity.com/terms/)
- [Legal Notice / Imprint](https://matejvavroproductivity.com/legal/)

---

## Credits & Acknowledgments

Prisma Calendar is built using [FullCalendar](https://fullcalendar.io/), a powerful and flexible JavaScript calendar library. FullCalendar provides the robust calendar rendering engine that powers Prisma Calendar's views and interactions. We're grateful to the FullCalendar team for creating such an excellent foundation.
