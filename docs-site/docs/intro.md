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

**The Ultimate Temporal Visualization Engine for Obsidian.**

Prisma Calendar is a **schema-agnostic visualization layer** that turns any Obsidian note with a date into a first-class citizen on your timeline. No rigid schemas, no predefined fields — just your data, your rules, your filters, rendered exactly how you need it.

It's not just a calendar. It's a way to **see your entire vault through time**.

Every setting is configurable. Every change is reactive. Every action is undoable.

Whether you need recurring events that generate real notes, batch operations across dozens of events, intelligent category auto-assignment with fuzzy matching, time-based statistics, CalDAV sync, a scriptable API, or just a clean timeline that works exactly how you want — Prisma does it all.

## Preview

</div>

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
    <source src={useBaseUrl("/video/Reaccur.webm")} type="video/webm" />
  </video>
  <video controls autoPlay loop muted playsInline style={{"flex": "1 1 45%", "minWidth": "300px", "maxWidth": "50%", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/UntrackedEvents.webm")} type="video/webm" />
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

## The Missing Piece for Your Obsidian Workflow

Prisma is fundamentally different from any conventional calendar. Tools like Google Calendar lock you into predefined fields that rarely fit complex needs. Platforms like Notion lack the seamless database visualization required for advanced workflows. Prisma breaks free from both.

It takes any data with a time parameter and projects it onto a unified, fully customizable timeline. For Obsidian users managing thousands of heavily customized markdown files, Prisma flawlessly renders those individual properties onto a single cohesive view — turning your vault into a full **enterprise resource planning** system. Plan projects, track habits, manage people, schedule tasks — all powered by the frontmatter you already write.

Prisma is production-ready, fully featured, and built for users who demand absolute freedom over how their information is visualized.

## Why Prisma Calendar?

The core challenge for power users is simple: how do you visualize entirely disparate records — sharing only a timestamp — in a single, cohesive view? Prisma solves this by stepping beyond the definition of a "calendar." It is a visualization layer that renders your data using your custom rules, properties, and filters. Projects, habits, meetings, tasks, people — if it has a date, Prisma displays it.

Here's what makes it the best calendar option for Obsidian, hands down.

---

### Configure Literally Everything
Prisma Calendar adapts to you, not the other way around. Map your own frontmatter properties, define JavaScript-powered [color rules](/features/organization/color-rules), set up advanced [filters](/features/organization/filtering), and customize the calendar appearance down to event text, icons, and density. Manage up to **10 independent calendars**, each with their own settings and folder scope. [Learn more →](/features/calendar/multiple-calendars)

### Fully Reactive — Changes Propagate Instantly
There's no "restart Obsidian to apply changes" here. Every setting change, every color rule tweak, every filter adjustment takes effect **immediately**. Edit a note's frontmatter and watch the calendar update in real time. This isn't a static display — it's a live, reactive system.

### Undo and Redo Everything
Every action you take — creating, editing, moving, deleting, batch operations — is tracked in a full memento history. Made a mistake? Hit undo. Changed your mind? Redo. You'll see exactly what's being reversed ("Undo Batch Delete", "Undo Move Event") so you're always in control. [Learn more →](/features/management/undo-redo)

### Recurring Events That Actually Work
Define a source node with a frequency (daily, weekly, bi-weekly, monthly, or a [custom DSL](/features/events/recurring-dsl)), and Prisma generates **real Obsidian notes** for each instance — fully linked back to the source. [Virtual previews](/features/events/virtual-events) let you see future instances without cluttering your vault. Navigate between instances with one click, and view statistics about your recurring series at a glance. [Learn more →](/features/events/event-groups)

### Batch Operations at Scale
Select multiple events and delete, duplicate, move, clone, skip, or open them — all at once. Shift entire weeks of events forward or backward. When you're managing a busy schedule, this isn't a nice-to-have — it's essential. [Learn more →](/features/management/batch-operations)

### Smart Categories with Fuzzy Matching
Define [categories](/features/organization/categories) with color coding, then let Prisma **auto-assign them** based on event names. The built-in fuzzy matching catches typos and close matches, so your events get categorized correctly even when you're typing fast. Categories also power event group aggregation, giving you a bird's-eye view of related events across your calendar.

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

## Help Shape the Future

This plugin is under active development and is personally used every day by the developer. The goal is to make it the best calendar for Obsidian, and community feedback is crucial.

Have an idea or a feature request?
1.  **Open an Issue** on our [GitHub repository](https://github.com/Real1tyy/Prisma-Calendar/issues).
2.  **Upvote Existing Ideas**: If you see a feature request you'd like, give it a 👍 reaction.

We prioritize development based on community demand, so your voice helps us build a better calendar for everyone.

---

## Credits & Acknowledgments

Prisma Calendar is built using [FullCalendar](https://fullcalendar.io/), a powerful and flexible JavaScript calendar library. FullCalendar provides the robust calendar rendering engine that powers Prisma Calendar's views and interactions. We're grateful to the FullCalendar team for creating such an excellent foundation.
