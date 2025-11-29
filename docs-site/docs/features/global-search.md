# Global Event Search

Search across all events in your calendar with powerful filtering and quick navigation.

![Global Event Search](/img/global_event_search.png)

*Search all events with cycle filters for recurring, all-day, and skipped events*

## Overview

The Global Event Search modal provides a fast way to find and navigate to any event in your current calendar. Unlike the toolbar search which filters the visible calendar, this modal shows all matching events in a searchable list.

## Opening Global Search

**Command Palette**
- Open command palette (`Ctrl/Cmd + P`)
- Search for "Open global event search"
- Press Enter

**Hotkey** (Recommended)
- Assign a custom hotkey in Obsidian Settings → Hotkeys
- Search for "Open global event search"
- Bind to your preferred key combination (e.g., `Ctrl/Cmd + Shift + F`)

## Basic Usage

### Search Events

1. Open the global search modal
2. The search input is automatically focused
3. Type to filter events by title
4. Results update in real-time as you type

### Event Information

Each event in the results shows:

- **Title**: The event's name
- **Type**: Visual indicator (🔴 Timed, ⚪ All-day, 🔁 Recurring)
- **Date/Time**:
  - Timed events show start and end date/times
  - All-day events show just the date
- **Recurring Indicator**: Shows if the event repeats

### Quick Actions

Two buttons appear for each event:

**Open**
- Opens the event's note file in the editor
- Use this to edit event details or content

**Navigate to**
- Switches calendar to week view
- Navigates to the event's date
- Opens the event's note file
- Use this to see the event in context with surrounding events

## Filtering

Three cycle-filter buttons let you narrow results by event type.

### Filter Buttons

Each filter button cycles through three states when clicked:

1. **Normal** (default) - Shows all events
2. **Only** - Shows only events of this type
3. **Skip** - Hides events of this type

The cycle order: **Normal → Only → Skip → Normal**

### Available Filters

**Recurring**
- Normal: Show both recurring and non-recurring events
- Only: Show only recurring events (have RRule property)
- Skip: Hide recurring events

**All-day**
- Normal: Show both all-day and timed events
- Only: Show only all-day events
- Skip: Hide all-day events

**Skipped**
- Normal: Show both skipped and normal events
- Only: Show only skipped events
- Skip: Hide skipped events

### Combining Filters

Filters work together. For example:
- **Only Recurring + Skip All-day** = Shows only recurring timed events
- **Only All-day + Skip Skipped** = Shows only all-day events that aren't skipped

## Use Cases

### Find Specific Events
Search for events by name across your entire calendar:
```
Search: "dentist"
```
Instantly see all dental appointments regardless of date.

### Review Recurring Events
```
Filter: Only Recurring
Search: (leave empty)
```
See all recurring event series in one list.

### Check All-Day Events
```
Filter: Only All-day
```
View all full-day events like holidays, deadlines, and birthdays.

### Find Skipped Events
```
Filter: Only Skipped
```
Review events you've skipped to decide if you want to restore them.

### Navigate to Old Events
```
Search: "project kickoff"
Action: Navigate to
```
Jump to an event from months ago to see what else was scheduled that week.

## Tips

- **Auto-focus**: Search input is focused automatically when modal opens, start typing immediately
- **Event Count**: Bottom of modal shows total matching events
- **Color Rules**: Events display with your configured color rules
- **Global Filters**: Respects calendar-level filter rules from settings
- **Physical Events Only**: Only shows actual event files, not virtual recurring previews

## Keyboard Navigation

- `Enter` - Opens first event in results
- `Escape` - Closes modal
- `Ctrl/Cmd + F` - Re-focuses search input (if focus moved)

## Related Features

- **[Filtering](./filtering)** - Calendar toolbar search and expression filters
- **[Event Skipping](./event-skipping)** - Managing skipped events
- **[Recurring Events](./recurring-dsl)** - Understanding recurring event patterns
