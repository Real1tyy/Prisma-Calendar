# Quick Start

import useBaseUrl from "@docusaurus/useBaseUrl";

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video
    controls
    autoPlay
    loop
    muted
    playsInline
    style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}
  >
    <source src={useBaseUrl("/video/Quickstart.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

## Initial Setup

On a fresh install, Prisma opens a **Welcome** modal first.

Use it to:

1. Set the first calendar directory without leaving the modal.
2. Pick one of the auto-detected folders if Prisma finds notes with date-like frontmatter in your vault.
3. Open the Tutorial video or playlist if you want a guided walkthrough before going deeper.

After you press **Continue**, Prisma opens the calendar immediately.

If you skip the modal or want to change the setup later:

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

There are two ways to create an event:

- **Click on the calendar** — click any empty spot on the calendar canvas to create an event at that date/time.
- **Create Event button** — click the **+ Create Event** button at the top left of the calendar view.

Both methods open the event creation modal where you can set the title, time, recurrence, and more.

## Recurring Events

To make an event recurring, check the **Recurring** checkbox in the event creation modal. From there you can configure the frequency (daily, weekly, monthly, yearly), select specific days, set an end date, and more.

Set “Future instances count” in settings to control how many future notes are generated; beyond that, events appear as read-only virtual items.

## Interacting with Events

Once your calendar is open, you can:
- **Hover** to preview notes (if enabled)
- **Click** to open the underlying file
- **Drag** to move/resize; snap respects your Snap duration (Settings → UI Settings)
- **Batch-select** to duplicate/delete or move/clone to next week
