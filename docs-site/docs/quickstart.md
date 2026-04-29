# Quick Start

👉 [Install the plugin](installation) → follow this guide → start using Prisma Calendar in minutes.

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <iframe
    width="100%"
    style={{"maxWidth": "800px", "aspectRatio": "16/9", "borderRadius": "8px", "border": "none"}}
    src="https://www.youtube.com/embed/dziQK9UQhvE"
    title="Prisma Calendar Quick Start"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen
  />
</div>

---

## Initial Setup

When you first install Prisma, a **Welcome** modal appears with two choices:

- **Use notes you already have** — Prisma scans your vault for folders containing notes with date-like frontmatter. Detected properties are split into **datetime** (with a time component) and **date** (date-only) categories, each clickable to copy. Inline **"Use"** buttons next to the Start, End, and Date fields let you prefill them with one click. If multiple folders are detected, each can become its own planning system later.
- **Start with a clean setup** — Prisma creates a new dedicated folder (e.g. `Tasks/`) so you can start planning right away.

### How Prisma Maps Your Notes

Prisma looks for notes inside your chosen folder and reads their frontmatter properties to turn them into events:

- **Start / End properties** — datetime values used for timed events (e.g. `Start: 2025-06-15T09:00`).
- **Date property** — a date value used for all-day events (e.g. `Date: 2025-06-15`).

You choose which property names Prisma should look for during setup. If you already have notes with date properties, Prisma picks them up and visualizes them automatically — no migration needed.

You can change these property names anytime in **Settings → Prisma Calendar → General**, or use the **Configure current** button in the calendar management section to re-run property detection on any planning system.

---

## Opening Your Calendar

Once setup is complete, open your calendar in two ways:

- **Ribbon icon** — each planning system adds a calendar icon to the left sidebar. Click it to open.
- **Command palette** — press `Ctrl/Cmd + P`, type `Prisma Calendar: Open`, and select your planning system.

**Tip:** assign a hotkey via Settings → Hotkeys → search "Prisma Calendar: Open" for instant access.

---

## Creating Events

There are three ways to create an event:

- **Click** any empty spot on the calendar to create an event at that date and time.
- **Drag** across a time range to create a timed event with a specific duration.
- **+ Create Event button** at the top left of the calendar view.

All three open the event creation modal where you set the title, time, and other details.

### What Happens Under the Hood

Every event is a regular Obsidian note with frontmatter. When you create an event titled "Team Meeting" at 9:00–10:00, Prisma creates a markdown file with your configured property names filled in. The note is fully yours — you can open it, write content inside it, link to other notes, and use it like any other file in your vault.

---

## Working with Events

- **Drag** events to reschedule them to a different day or time.
- **Drag the edge** of a timed event to adjust its duration.
- **Drag** all-day events into timed slots or vice versa.
- **Right-click** any event to open the context menu — from here you can **edit**, **delete**, **duplicate**, or perform other actions.
- **Hover** over an event to see a quick preview of the note content.
- **Click** an event to open the underlying note directly.

### Undo & Redo

Every action — creating, editing, moving, deleting — is tracked. Made a mistake? Just undo. Changed your mind? Redo.

### Note Content & Preview

Events aren't just titles — you can write any content inside the note (agendas, links, context). Open an event's note to edit it directly, or use the **preview** option from the right-click menu to read the full content without leaving the calendar. You can also trigger a quick preview by hovering over any event while holding `Ctrl/Cmd`.

---

## Categories & Colors

You can assign **categories** to events to visually distinguish them. Once categorized, go to **Settings → Categories** to customize the color for each category. Your calendar will color-code events automatically so you can see at a glance which events belong to what.

For more details, see [Categories](features/organization/categories).

---

## Recurring Events

To make an event recurring, check the **Recurring** checkbox in the event creation modal. Choose a frequency (daily, weekly, monthly, yearly), select specific days, and optionally set an end date.

Prisma generates **real notes** for upcoming instances — each one is a separate file you can edit independently. Beyond those, future instances appear as **virtual events** (read-only previews) so your vault doesn't fill up with notes you haven't reached yet.

For more details, see [Recurring Events](features/events/recurring-dsl).

---

## Statistics

Open the statistics panel to see a **weekly pie chart breakdown** of your events — durations, percentages, and category-level analysis of where your time goes.

For more details, see [Statistics](features/organization/statistics).

---

## Multiple Planning Systems

You can create **multiple independent planning systems**, each pointing to a different folder with its own configuration, property names, and rules. For example, one for `Tasks/` and another for `Meetings/` — fully isolated from each other.

For more details, see [Multiple Calendars](features/calendar/multiple-calendars).

---

## Settings

Open **Settings → Prisma Calendar** to configure everything — property names, calendar appearance, categories, notifications, color rules, and more. Each planning system has its own isolated settings.

For more details, see [Configuration](configuration).

---

## Prisma Pro

All of the core features above are completely free. For more connected, advanced workflows, **Prisma Pro** unlocks calendar synchronization, advanced visualizations, Bases integration for embedding views directly inside notes, and other power-user capabilities built for serious planning inside Obsidian.

That's something you can explore over time as your system grows. Prisma offers a **30-day free trial** so you can test out the Pro capabilities with no strings attached.

For more details, see [Free vs Pro](features/free-vs-pro).

---

## What's Next?

Start simple — use the calendar view, create a few events, and plan out your week. As you get more comfortable, explore categories, recurring events, and the other views. You don't need to use everything at once. It may feel a bit overwhelming at first, but focus on the basics and take it one step at a time.

### Learn & Go Deeper

1. **[Encyclopedia Video](https://www.youtube.com/watch?v=HrcNKh6uFH8)** — every feature broken down from A to Z. A full walkthrough and a long-term reference you can come back to anytime.
2. **[Features Overview](features/overview)** — full documentation with visual examples, so you can quickly find anything you want to learn more about.
3. **[Gallery](gallery)** — videos and screenshots of every major feature in action.

### Stay Up to Date

I regularly publish update videos and every change is documented in the [Changelog](changelog). Prisma is under active, full-time development — new features, improvements, and fixes ship consistently.

**[YouTube Playlist →](https://www.youtube.com/playlist?list=PLMVJknbUasLCULubO4MdCDvg9MyXu3kG4)** — all Prisma Calendar videos in one place.

### Share Your Feedback

If you spot any bugs or have ideas for improvement, please share your feedback through **[GitHub Issues](https://github.com/Real1tyy/Prisma-Calendar/issues)**. Clear bug reports and feature suggestions are extremely valuable and actively reviewed. The plugin is under active development and your input directly shapes what gets built next.
