# Hotkeys

Prisma Calendar provides a comprehensive set of hotkeys to streamline your workflow. You can assign custom key combinations to these actions in Obsidian's settings under `Settings` → `Hotkeys`.

## Opening Your Calendar

Before using any hotkeys, you need to access your calendar. **Prisma Calendar is accessed through Obsidian commands, not visible buttons:**

1. Press `Ctrl/Cmd + P` to open the command palette
2. Type: `Prisma Calendar: Open [Calendar Name]`
3. Press Enter

**Highly Recommended:** Assign a custom hotkey to this command (e.g., `Ctrl/Cmd + Shift + C`) for instant calendar access:
- Go to `Settings` → `Hotkeys`
- Search for `Prisma Calendar: Open`
- Click the + icon and press your desired key combination

Each calendar has its own open command, so you can assign different hotkeys to different calendars.

## Hotkey System Overview

Prisma Calendar's hotkeys are designed to be both powerful and intuitive. They are divided into two main categories:

1.  **Calendar-Specific Hotkeys**: Each calendar you create gets its own dedicated "Open" command. This allows you to assign a unique hotkey to quickly open each of your calendars.
2.  **Global Hotkeys**: Most commands (batch operations, filtering, navigation) are managed by a single set of global hotkeys. These hotkeys automatically target the calendar view that is currently active or in focus.

## Global Hotkeys

Global hotkeys work across all calendars and automatically target the currently active calendar view.

### Batch Operations

Batch operation hotkeys require **Batch Selection Mode** to be active first. Activate by clicking "Batch Select" button or using the `Toggle Batch Selection` hotkey.

**Available batch commands:**

Here is a complete list of the batch operations you can assign hotkeys to:

-   `Toggle Batch Selection`: Activates or deactivates the batch selection mode for the focused calendar.
-   `Batch: Select All`: Selects all events currently visible within the calendar's view.
-   `Batch: Clear Selection`: Deselects all events that are currently selected.
-   `Batch: Duplicate Selection`: Creates an exact copy of each selected event.
-   `Batch: Delete Selection`: Permanently deletes all selected events after a confirmation.
-   `Batch: Open Selection`: Opens the corresponding note for each selected event in a new tab.
-   `Batch: Clone to Next Week`: Clones each selected event to the same day of the following week.
-   `Batch: Clone to Previous Week`: Clones each selected event to the same day of the previous week.
-   `Batch: Move to Next Week`: Moves each selected event to the same day of the following week.
-   `Batch: Move to Previous Week`: Moves each selected event to the same day of the previous week.
-   `Batch: Move By`: Opens a dialog to move selected events by a custom number of days. Supports positive values (move forward) and negative values (move backward). For example, enter `7` to move events one week forward, or `-3` to move them 3 days back.
-   `Batch: Skip Selection`: Marks all selected events as skipped (hidden from calendar).
-   `Batch: Mark Selection as Done`: Marks all selected events as done by setting the status property to the done value configured in settings.
-   `Batch: Assign categories to selection`: Opens the category assignment modal to assign categories to all selected events at once. The modal shows all available categories with their configured colors and allows multi-select. The operation is fully undoable.

## Filtering Commands

### Focus Search

-   **Function**: Jumps focus to the search bar in the calendar toolbar
-   **Use Case**: Quick keyboard access to title-based event filtering
-   **See Also**: [Filtering documentation](./filtering.md) for details on search functionality

### Focus Expression Filter

-   **Function**: Jumps focus to the expression filter input in the calendar toolbar
-   **Use Case**: Quick keyboard access to advanced property-based filtering
-   **See Also**: [Filtering documentation](./filtering.md) for expression syntax and examples

### Open Filter Preset Selector

-   **Function**: Opens the filter preset dropdown menu
-   **Use Case**: Quick access to saved filter expressions
-   **See Also**: [Filtering documentation](./filtering.md) for creating and managing presets

### Show Filtered Events

-   **Function**: Opens a modal displaying all events currently hidden by active filters
-   **Features**:
    -   Search within filtered events by name
    -   Click any event to open its file
    -   Helps identify which events are excluded by current search and expression filters
-   **See Also**: [Filtering documentation](./filtering.md) for filter behavior

## Navigation Commands

### Scroll to Current Time

-   **Function**: Scrolls to the current time or centers the current day
-   **Behavior**:
    -   In week/day views: Navigates to today and centers the timeline on the current time
    -   In month view: Navigates to today and centers the current day in the viewport
    -   In list view: Navigates to today
-   **Use Cases**:
    -   Quickly return to the present time after scrolling through different time periods
    -   Re-orient yourself during the day, especially when deeply zoomed or scrolled
    -   Navigate back to "now" with a single command or button click
-   **Available As**: Toolbar button ("Now") and Obsidian command

### Open Current Note in Calendar

The **Open Current Note in Calendar** command provides quick navigation from any note to its corresponding event in the calendar:

-   **Function**: Opens the calendar view and navigates to the date of the currently active note
-   **Behavior**:
    -   Automatically detects which calendar the note belongs to (based on directory)
    -   Opens the calendar view if not already open, or focuses it if already open
    -   Switches to week view and navigates to the event's date
    -   Highlights the event for 5 seconds for easy identification
-   **Requirements**: The active note must:
    -   Be located in a calendar directory
    -   Have frontmatter with a date property (Start, Date, or configured start property)

## Filtering & Search Commands

The filtering commands enable keyboard-driven navigation of the calendar's powerful filtering system:

### Focus Search

-   **Function**: Jumps directly to the search bar input in the calendar toolbar
-   **Use Case**: Quick text-based filtering by event title

### Focus Expression Filter

-   **Function**: Jumps directly to the expression filter input
-   **Use Case**: Advanced property-based filtering with JavaScript expressions

### Open Filter Preset Selector

-   **Function**: Opens the filter presets dropdown for quick preset selection
-   **Use Case**: Apply saved filter expressions with a single click

## Event Management Commands

### Create New Event

-   **Function**: Opens the create event modal for the active calendar
-   **Use Case**: Quickly create events without clicking the calendar

### Edit Last Focused Event

-   **Function**: Opens the edit modal for the last event you hovered over
-   **Use Case**: Rapid editing workflow - hover an event, press hotkey to edit

### Set Start Time to Now (Focused Event)

-   **Function**: Updates the start time of the last hovered event to the current moment
-   **Use Case**: Log actual start times after beginning a task
-   **Workflow**: Hover event → Press hotkey → Start time updated instantly

### Set End Time to Now (Focused Event)

-   **Function**: Updates the end time of the last hovered event to the current moment
-   **Use Case**: Log actual end times immediately after completing a task
-   **Workflow**: Hover event → Press hotkey → End time updated instantly

### Fill Start Time from Previous Event (Focused Event)

-   **Function**: Sets the start time to match the end time of the previous event
-   **Use Case**: Chain tasks together seamlessly with no gaps
-   **Workflow**: Hover event → Press hotkey → Start time fills from previous event's end

### Fill End Time from Next Event (Focused Event)

-   **Function**: Sets the end time to match the start time of the next event
-   **Use Case**: Fill gaps between events or adjust boundaries
-   **Workflow**: Hover event → Press hotkey → End time fills from next event's start

### Show Recurring Events

-   **Function**: Opens a modal listing all recurring event sources
-   **Features**: View, filter, enable/disable, and navigate to recurring events
-   **See Also**: [Recurring Events documentation](./recurring-dsl.md)

### Show Skipped Events

-   **Function**: Opens a modal listing all events marked as skipped
-   **Features**: Quickly enable, navigate to, or open skipped events

### Toggle Untracked Events Dropdown

-   **Function**: Toggles the visibility of the untracked events dropdown in the calendar toolbar
-   **Features**:
    -   Opens/closes the dropdown showing events without date properties
    -   Quick keyboard access without using the mouse
    -   Works whether the dropdown is currently open or closed
-   **See Also**: [Untracked Events documentation](./untracked-events.md)

### Show Disabled Recurring Events

-   **Function**: Opens a modal listing all disabled recurring events
-   **Features**: Quickly enable, navigate to, or open disabled recurring event sources

### Global Event Search

-   **Function**: Opens the global event search modal
-   **Features**: Search across all events with cycle filters for recurring, all-day, and skipped events
-   **See Also**: [Global Search documentation](./global-search.md)

### Highlight Events Without Categories

-   **Function**: Temporarily highlights all events missing category assignments
-   **Duration**: Events are highlighted for 10 seconds
-   **Use Case**: Quickly identify which events need category assignment

### Highlight Events With Category

-   **Function**: Opens a modal to select a category and highlights all events with that category
-   **Duration**: Events are highlighted for 10 seconds
-   **Use Case**: Quickly identify all events belonging to a specific category
-   **Modal**: Dropdown selector with all available categories from your events

### Refresh Calendar

-   **Function**: Manually triggers a full resync of the indexer and refreshes all calendar events
-   **Use Cases**:
    -   Force refresh when events appear out of sync
    -   Update calendar after bulk file operations outside Obsidian
    -   Refresh after modifying event files through external scripts or sync tools

## Statistics Commands

### Show Daily Statistics

-   **Function**: Opens daily statistics modal for the current day
-   **Features**: Pie chart and breakdown table showing time distribution for a single day
-   **See Also**: [Statistics documentation](./statistics.md)

### Show Weekly Statistics

-   **Function**: Opens weekly statistics modal for the current week
-   **Features**: Pie chart and breakdown table showing time distribution for the week
-   **See Also**: [Statistics documentation](./statistics.md)

### Show Monthly Statistics

-   **Function**: Opens monthly statistics modal for the current month
-   **Features**: Pie chart and breakdown table showing time distribution for the month
-   **See Also**: [Statistics documentation](./statistics.md)

### Show All-Time Statistics

-   **Function**: Opens all-time statistics modal
-   **Features**: Pie chart and breakdown table showing lifetime time distribution
-   **See Also**: [Statistics documentation](./statistics.md)

### Show Daily Statistics for Now

-   **Function**: Opens daily statistics modal for today (current date)
-   **Features**: Shows statistics for today, regardless of which day is currently visible in the calendar
-   **Use Case**: Quickly view today's statistics while viewing a different date in the calendar
-   **See Also**: [Statistics documentation](./statistics.md)

### Show Weekly Statistics for Now

-   **Function**: Opens weekly statistics modal for the current week
-   **Features**: Shows statistics for this week, regardless of which week is currently visible in the calendar
-   **Use Case**: Quickly view this week's statistics while viewing a different week in the calendar
-   **See Also**: [Statistics documentation](./statistics.md)

### Show Monthly Statistics for Now

-   **Function**: Opens monthly statistics modal for the current month
-   **Features**: Shows statistics for this month, regardless of which month is currently visible in the calendar
-   **Use Case**: Quickly view this month's statistics while viewing a different month in the calendar
-   **See Also**: [Statistics documentation](./statistics.md)

### Show Current Interval in Bases

-   **Function**: Opens a Bases table view showing all events in the current calendar interval
-   **Behavior**: Displays events from the visible calendar range (day/week/month) in a structured table
-   **Features**: Full Bases filtering, sorting, and column customization
-   **Use Case**: Analyze and manage events within the current view using Bases' powerful table interface
-   **See Also**: [Configuration](../configuration.md#bases-view-properties) for customizing displayed columns

## Undo/Redo Commands

-   **Undo**: Reverses the last calendar operation
-   **Redo**: Reapplies a previously undone operation

## Integration Commands

### Import .ics File

-   **Function**: Opens the ICS import modal to import events from external calendars
-   **Use Case**: Import events from Google Calendar, Apple Calendar, Outlook, etc.
-   **See Also**: [Integrations documentation](./integrations.md)

### Export Calendar as .ics

-   **Function**: Opens the ICS export modal to export calendar events
-   **Features**: Select timezone, exclude skipped events, export to file
-   **See Also**: [Integrations documentation](./integrations.md)

### Sync Calendar Accounts

-   **Function**: Manually triggers CalDAV synchronization
-   **Use Case**: Force sync with external CalDAV servers (Fastmail, Nextcloud, iCloud)
-   **See Also**: [CalDAV Integration documentation](./integrations.md#caldav-integration)

## Utility Commands

### Open Prisma Main

-   **Function**: Opens the main Prisma Calendar view/interface
-   **Use Case**: Quick access to calendar overview

### Restore Minimized Event Modal

-   **Function**: Restores a previously minimized event creation/edit modal
-   **Use Case**: Resume event creation after minimizing the modal
-   **See Also**: [Time Tracker documentation](./time-tracker.md) for minimize functionality

### Assign Categories to Minimized Event

-   **Function**: Opens the category assignment modal for a minimized event without restoring the full modal
-   **Use Case**: Quickly assign or update categories while keeping the event modal minimized
-   **Workflow**: When you have a minimized event, run this command to assign categories and continue working
-   **See Also**: [Time Tracker documentation](./time-tracker.md) for minimize functionality

## Tips

-   **Batch operations** require batch selection mode to be active first
-   **Undo/redo** supports all event modifications (create, delete, move, edit)
-   **Command palette**: Access all commands via `Ctrl/Cmd+P` → search "Prisma Calendar"
-   **Filter commands** enable mouse-free navigation between filtering options
-   **Navigation commands** work even when the calendar is not currently open
