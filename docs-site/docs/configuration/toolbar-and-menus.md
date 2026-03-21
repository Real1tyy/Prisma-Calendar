# Configuration Settings

## Desktop Toolbar Buttons

Customize which buttons appear in the calendar's top toolbar on desktop. All buttons are enabled by default. Uncheck items to hide them and save space in narrow sidebars. Reopen the calendar view for changes to take effect.

Available buttons: Previous/Next, Today, Now, Create Event, Zoom Level, Filter Presets, Search Input, Expression Filter, Untracked Events.

For a detailed description of each toolbar button and what it does, see [Calendar View → Toolbar](../features/calendar/calendar-view#toolbar).

## Mobile Toolbar Buttons

Customize which buttons appear in the calendar's top toolbar on mobile. Configured independently from desktop. All buttons are enabled by default. Uncheck items to hide them and save space on smaller screens. Reopen the calendar view for changes to take effect.

Available buttons are the same as desktop: Previous/Next, Today, Now, Create Event, Zoom Level, Filter Presets, Search Input, Expression Filter, Untracked Events.

## Batch Selection

- **Batch action buttons**: customize which action buttons appear in the batch selection mode toolbar. You can enable or disable individual buttons to streamline your workflow:
  - **Select All**: Select all visible events on the current calendar view
  - **Clear**: Deselect all currently selected events
  - **Duplicate**: Create duplicate copies of selected events
  - **Move By**: Move selected events by a specified number of days/weeks
  - **Mark as Done**: Mark selected events as done using the configured status property
  - **Mark as Not Done**: Mark selected events as not done
  - **Categories**: Open batch category assignment for selected events
  - **Frontmatter**: Open batch frontmatter update for selected events
  - **Clone Next**: Clone selected events to the next week
  - **Clone Prev**: Clone selected events to the previous week
  - **Move Next**: Move selected events to the next week
  - **Move Prev**: Move selected events to the previous week
  - **Open All**: Open all selected event notes in separate tabs
  - **Skip**: Mark selected events as skipped (hidden from calendar)
  - **Delete**: Delete selected event notes

  Not all buttons are enabled by default — Move By, Open All, Move Prev, Clone Prev, and Frontmatter are disabled by default. The Counter (showing selection count) and Exit buttons are always shown and cannot be disabled.

## Context Menu

- **Context menu items**: customize which actions appear when right-clicking events. You can enable or disable individual context menu items to declutter the menu and keep only relevant actions:
  - **Enlarge**: Open event preview in a modal
  - **Preview**: Show hover preview for the event
  - **Go to source**: Navigate to the source recurring event
  - **Edit source event**: Open edit modal with source recurring event data (only appears on physical/virtual recurring instances)
  - **Duplicate recurring instance**: Create a duplicate of a physical recurring instance
  - **View event groups**: Open modal showing all event groups (recurring, by category, by name)
  - **Edit event**: Open event edit modal
  - **Assign categories**: Open category assignment modal
  - **Assign prerequisites**: Open prerequisite assignment modal for linking dependent events
  - **Duplicate event**: Create a duplicate of the event
  - **Move by...**: Move event by a custom time offset
  - **Mark as done/undone**: Toggle event completion status
  - **Move to next week**: Move event forward one week
  - **Clone to next week**: Duplicate event to next week
  - **Move to previous week**: Move event back one week
  - **Clone to previous week**: Duplicate event to previous week
  - **Fill start time from current time**: Set event start to now
  - **Fill end time from current time**: Set event end to now
  - **Fill start time from previous event**: Set start to previous event's end time
  - **Fill end time from next event**: Set end to next event's start time
  - **Delete event**: Delete the event note
  - **Skip event**: Hide event from calendar
  - **Open file**: Open event note in editor
  - **Open file in new window**: Open event note in a new window
  - **Enable/Disable recurring event**: Toggle recurring event visibility
  - **Trigger stopwatch**: Start or stop the time tracker for the event
  - **Duplicate remaining week days**: Duplicate event to all remaining days of the current week (disabled by default)

  All items are enabled by default unless noted otherwise. Menu items that don't apply to a specific event (e.g., recurring-specific actions on non-recurring events) are automatically hidden.

## Performance

- **Enable name series tracking**: track name-based event series (groups events sharing the same title). Used for name series propagation and series views. Disable to reduce memory usage in large vaults (enabled by default).
- **File operation concurrency limit**: maximum number of files to modify in parallel during batch operations. Applies to recurring event frontmatter propagation, name/category series propagation, and file deletions (e.g., when deleting a CalDAV account or ICS subscription with many events). Lower values reduce the risk of Obsidian freezing on large batch operations; higher values complete faster. Range: 1–50, default: 10.
