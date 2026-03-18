# Bases Calendar View (Pro)

Render your Prisma Calendar events directly inside any Obsidian Base as a fully interactive calendar. Use Base queries to filter and sort events, then visualize them in month, week, or day layouts — with the same features as the main calendar view.

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

## Toolbar

The calendar toolbar provides navigation and actions:

- **Navigation** — Previous, Next, and Today buttons to move between periods.
- **Untracked Events** — Dropdown button showing events in the calendar folder that are not yet tracked. Drag them onto the calendar to assign a date.
- **Batch Select** — Enter batch selection mode to perform operations on multiple events at once.

## Batch Operations

Click **Batch Select** in the toolbar to enter selection mode. Click events to select them, then use the batch action buttons:

- **All / Clear** — Select all visible events or clear the selection.
- **Duplicate** — Duplicate selected events.
- **Move By** — Shift selected events by a custom duration.
- **Clone Next / Clone Prev** — Clone events to the next or previous period.
- **Move Next / Move Prev** — Move events to the next or previous period.
- **Open** — Open all selected event notes.
- **Skip** — Mark selected events as skipped.
- **Done / Not Done** — Toggle completion status.
- **Categories** — Assign categories to selected events.
- **Frontmatter** — Bulk-edit frontmatter properties on selected events.
- **Delete** — Delete selected events.
- **Exit** — Leave batch selection mode.

## Event Interactions

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
