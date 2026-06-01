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

The first time you open Prisma, a **Welcome** modal walks you through a one-time setup. There are only two things to decide: **which folder** Prisma should watch, and **which frontmatter properties** hold your dates. If you are starting fresh, you can use the defaults. You can change these values at any time later in the settings.

Prisma never forces a schema. It reads the notes you point it to look at and turns the ones with date properties into events — nothing is moved, rewritten, or migrated. The modal offers two starting points:

| Choice | Best for | What Prisma does |
| --- | --- | --- |
| **Use notes you already have** | A vault that already has dated notes (daily notes, meetings, tasks, projects) | Reads an existing folder and turns those notes into events using *your* property names |
| **Start with a clean setup** | A fresh planning system from scratch | Creates a dedicated folder (default `Tasks/`) with Prisma's default property names |

Both paths end in the same place: a folder Prisma watches and the property names it reads from. The only difference is whether you adopt names you already use or accept the defaults.

### Adapting Prisma to a folder you already have

Choose **Use notes you already have** and Prisma scans your vault for folders that already contain notes with date-like frontmatter. For each candidate folder it shows the folder name, how many dated notes it found, and the properties it saw — split into:

- **Datetime properties** — values with a time component (e.g. `2025-06-15T09:00`), used for timed events.
- **Date properties** — date-only values (e.g. `2025-06-15`), used for all-day events.

Click a folder to select it. Prisma makes its best guess at the mapping — a datetime property whose name contains "start" becomes your **Start property**, one containing "end" becomes your **End property**, and a date-only property becomes your **Date property**. Every guess is editable: each field has inline **Use** buttons listing the detected properties, so you can fix the mapping in one click — or just type a name yourself.

You're mapping three things:

- **Start property** — the datetime a timed event begins (e.g. your existing `start`, `due`, or `Start Date` field).
- **End property** — the datetime a timed event ends.
- **Date property** — the date-only field for all-day events.

#### Example: adopting an existing meetings folder

Suppose your vault already has a `Meetings/` folder full of notes like this, written long before you installed Prisma:

```yaml
---
start: 2025-06-15T09:00
end: 2025-06-15T10:30
attendees: [Alice, Bob]
project: Q1 Planning
---

Agenda, notes, decisions — whatever you already keep in the note.
```

Point Prisma at `Meetings/`, set **Start property** to `start` and **End property** to `end`, and finish setup. Every note in that folder immediately shows up on the calendar as a timed event — **no edits to your notes required**. Your `attendees`, `project`, and the note body are left exactly as they were; Prisma only reads the two date fields you mapped.

If no dated folders are detected, the modal tells you so — you can still type a folder path manually and set the property names yourself.

:::tip Found more than one dated folder?
Each can become its own independent planning system later — its own folder, its own property names, its own configuration. See [Multiple Planning Systems](#multiple-planning-systems).
:::

### Starting fresh

Choose **Start with a clean setup** and Prisma pre-fills a dedicated folder (default `Tasks/`) and its default property names:

| Field | Default property |
| --- | --- |
| Start property | `Start Date` |
| End property | `End Date` |
| Date property | `Date` |

Rename the folder or the properties if you like, then finish. Prisma creates the folder and you're ready to go. From here on, every event you create through the UI becomes a new note in that folder, written with these property names.

A **timed event** Prisma creates looks like this — start and end are stored as full ISO timestamps (down to milliseconds, ending in `Z`):

```yaml
---
Start Date: 2025-06-15T09:00:00.000Z
End Date: 2025-06-15T10:00:00.000Z
All Day: false
---

# Team Meeting
```

An **all-day event** looks like this:

```yaml
---
Date: 2025-06-20
All Day: true
---

# Project Planning
```

### Changing your setup later

Nothing chosen in the Welcome modal is permanent — Prisma is fully reactive, so changes re-read your notes and update the calendar immediately:

- **Folder** — change the watched folder under **Settings → Prisma Calendar → General → Directory**.
- **Property names** — change which frontmatter keys Prisma reads under **Settings → Prisma Calendar → Properties**. This is also where you map optional fields like the all-day flag, category, status, and location. See [Properties Settings](configuration/properties).
- **Re-detect properties** — re-run folder and property detection on any planning system from its **Configure** action in the calendar management settings.

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
