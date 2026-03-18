# Bases Calendar View (Pro)

Render your Prisma Calendar events directly inside any Obsidian Base as a fully interactive calendar. Use Base queries to filter events and visualize them in month, week, or day layouts.

## Prerequisites

The Base must query files from a folder that is configured as a calendar directory in Prisma Calendar settings. If you want to use this view for a different folder, first create a new calendar in **Settings → Calendars** pointing to that folder with the correct property mappings, then select it in the view options.

## How to Use

1. Open or create a Base (`.base` file or inline `base` code block) that filters files from your calendar directory.
2. Click the view selector in the Bases toolbar.
3. Select **Prisma Calendar** from the list.
4. In the view options, choose which calendar to use.

Only files recognized as events in the selected calendar are displayed.

## View Options

Access view options from the Bases toolbar menu:

- **Calendar** — Choose which calendar to display events from.
- **View** — Set the calendar layout: Month, Week, or Day.
- **Initial Date** — Optionally set a date (e.g. `2026-03-15`) to navigate to on first load. Leave empty to start at today.

## Interactions

The Bases Calendar View supports the same interactions as the main calendar:

- **Click** an event to open its note.
- **Right-click** for the full context menu (edit, duplicate, skip, delete, etc.).
- **Hover** over an event to see a preview tooltip with note content.
- **Drag and drop** events to reschedule them.
- **Drag edges** to change event duration.
- **Click a date** to create a new event.
- **Click and drag a time range** to create an event with a specific start and end time.

## Requirements

- Prisma Calendar Pro license
- Obsidian 1.10.0 or later (Bases support)
- A configured calendar pointing to the folder queried by the Base
