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

The context menu appears when you right-click any event. It is fully customizable — you can reorder, rename, change icons, pick colors, and show/hide individual items directly from the menu itself.

### Managing menu items

Click **"Manage menu items..."** at the bottom of the context menu to open the item manager. From there you can:

- **Sections**: Items are organized into sections (Navigation, Edit, Move, Danger, Recurring). Section headers appear in the manager to help you understand the grouping. Separators are inserted between sections in the actual context menu.
- **Reorder within a section**: Use the up/down arrow buttons to move items within their section. Drag items to reorder within the same section.
- **Move between sections**: Drag an item and drop it onto a different section to reassign it. The item adopts the target section's grouping and a separator will appear accordingly in the context menu.
- **Rename**: Click the pencil icon on any item, then edit the Name field. A badge shows the original name for reference. Click the reset button to restore the default label.
- **Change icon**: Click the pencil icon, then click the Icon button to pick from all available Obsidian icons.
- **Change color**: Click the pencil icon, then use the Color picker to tint the item's icon.
- **Show/Hide**: Click the eye icon to hide an item. Hidden items appear dimmed at the bottom of their section. Click the eye-off icon to restore them. At least one item must remain visible.
- **Toggle settings button**: The toggle at the top of the manager controls whether the "Manage menu items..." entry appears in the context menu.
- **Search**: Use the search bar at the top to filter items by name (flat list, ignoring sections).

All changes persist automatically per calendar.

### Backward compatibility

If you previously configured context menu visibility via the settings tab (prior to 2.8.0), your show/hide preferences are automatically migrated on first load.

### Available items

- **Enlarge**: Open event preview in a modal
- **Preview**: Show hover preview for the event
- **Go to source**: Navigate to the source recurring event
- **Edit source event**: Open edit modal with source recurring event data (only appears on physical/virtual recurring instances)
- **Duplicate recurring instance**: Create a duplicate of a physical recurring instance
- **View event groups**: Open modal showing all event groups (recurring, by category, by name)
- **Show name series**: Open the event series modal directly on the By Name tab
- **Show category series**: Open the event series modal directly on the By Category tab (only visible when the event has categories)
- **Show recurring series**: Open the event series modal directly on the Recurring tab (only visible for recurring events)
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
- **Duplicate remaining week days**: Duplicate event to all remaining days of the current week (hidden by default)

All items are visible by default unless noted otherwise. Items that don't apply to a specific event type (e.g., recurring-specific actions on non-recurring events) are automatically hidden regardless of configuration.

## Performance

- **Enable name series tracking**: track name-based event series (groups events sharing the same title). Used for name series propagation and series views. Disable to reduce memory usage in large vaults (enabled by default).
- **File operation concurrency limit**: maximum number of files to modify in parallel during batch operations. Applies to recurring event frontmatter propagation, name/category series propagation, and file deletions (e.g., when deleting a CalDAV account or ICS subscription with many events). Lower values reduce the risk of Obsidian freezing on large batch operations; higher values complete faster. Range: 1–50, default: 10.
