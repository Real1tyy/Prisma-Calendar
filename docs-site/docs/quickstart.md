# Quick Start

## Initial Setup

1. Open Settings → Prisma Calendar and confirm your Active Calendar.
2. Set Directory to the folder where event notes should live (e.g., `Calendar/`).
3. (Optional) Adjust frontmatter property names for Start/End/AllDay/Title if you use custom keys.
4. (Optional) Set Template path to a Templater template for new events.

## Opening Your Calendar

After installing Prisma Calendar, you can open your calendar in two ways:

### Ribbon Icon (Default)

By default, each calendar adds a calendar icon to the left sidebar. Simply click it to open the calendar.

### Command Palette

1. Press `Ctrl/Cmd + P` to open Obsidian's command palette
2. Type: `Prisma Calendar: Open [Calendar Name]`
3. Press Enter

**Additional options:**
- **Hide ribbon icons** - Go to Settings → Prisma Calendar → select calendar → General → disable "Show ribbon icon"
- **Set a hotkey** - Go to Settings → Hotkeys → search "Prisma Calendar: Open" → assign your preferred shortcut (e.g., `Ctrl + Shift + C`)
- **Multiple calendars** - Each calendar has its own ribbon icon and command

All Prisma Calendar commands start with `Prisma Calendar:` to make them easy to find in the command palette.

## Creating Your First Event

Create an event note (via your template or manually) and add frontmatter like:

```yaml
---
Title: Doctor Appointment
Start: 2025-02-10T14:00
End: 2025-02-10T15:00
AllDay: false
---

Remember insurance card.
```

## Interacting with Events

Once your calendar is open, you can:
- **Hover** to preview notes (if enabled)
- **Click** to open the underlying file
- **Drag** to move/resize; snap respects your Snap duration (Settings → UI Settings)
- **Batch-select** to duplicate/delete or move/clone to next week

### Recurring example

```yaml
---
Title: Standup
Start: 2025-02-03T09:30
RRule: weekly
RRuleSpec: monday, tuesday, wednesday, thursday, friday
---
```

Set “Future instances count” to control how many future notes are generated; beyond that, events appear as read-only virtual items.
