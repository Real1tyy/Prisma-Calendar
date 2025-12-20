# Global Event Search

Search across all events in your calendar with powerful filtering and quick navigation.

![Global Event Search](/img/global_event_search.png)

*Search all events with cycle filters for recurring, all-day, and skipped events*

## Overview

The Global Event Search modal provides a fast way to find and navigate to any event in your current calendar. Unlike the [toolbar search](./filtering.md) which filters the visible calendar, this modal shows all matching events in a searchable list.

**Access**: Command palette → "Open global event search" or assign a [hotkey](./hotkeys.md)

## Usage

Type to filter events by title. Each result shows the event title, type indicator (🔴 Timed, ⚪ All-day, 🔁 Recurring), and date/time.

**Actions**:
- **Open**: Opens the event's note file
- **Navigate to**: Switches to week view and navigates to the event's date

## Cycle Filters

Three filter buttons narrow results by event type. Each button cycles through three states:

1. **Normal** - Shows all events
2. **Only** - Shows only this type
3. **Skip** - Hides this type

**Available Filters**:
- **Recurring**: Filter by [recurring events](./recurring-dsl.md)
- **All-day**: Filter by all-day vs timed events
- **Skipped**: Filter by [skipped events](./event-skipping.md)

Filters combine with AND logic. Example: "Only Recurring + Skip All-day" shows only recurring timed events.

## Notes

- Shows only physical event files, not [virtual recurring previews](./virtual-events.md)
- Respects calendar-level [filter rules](./filtering.md) from settings
- Events display with your configured [color rules](./color-rules.md)

## Related Features

- [Filtering](./filtering.md) - Toolbar search and expression filters
- [Event Skipping](./event-skipping.md) - Managing skipped events
- [Recurring Events](./recurring-dsl.md) - Recurring event patterns
- [Hotkeys](./hotkeys.md) - Assign keyboard shortcuts
