# Hotkeys

Prisma Calendar provides a comprehensive set of hotkeys to streamline your workflow. You can assign custom key combinations to these actions in Obsidian’s settings under `Settings` → `Hotkeys`.

## Hotkey System Overview

Prisma Calendar's hotkeys are designed to be both powerful and intuitive. They are divided into two main categories:

1.  **Calendar-Specific Hotkeys**: Each calendar you create gets its own dedicated "Open" command. This allows you to assign a unique hotkey to quickly open each of your calendars.
2.  **Global Batch Hotkeys**: All batch operations (like duplicating, deleting, or moving events) are managed by a single set of global hotkeys. These hotkeys automatically target the calendar view that is currently active or in focus.

## Global Batch Operations

The batch operation hotkeys are a core feature for managing multiple events efficiently. Here’s how they work:

-   **Shared Across Calendars**: There is only one set of hotkeys for all batch actions, regardless of how many calendars you have. For example, the `Batch: Delete Selection` hotkey will work on any calendar that is currently active.
-   **Requires Batch Selection Mode**: **Crucially**, for any of the batch operation hotkeys to work, you must first activate **Batch Selection Mode**. You can do this by clicking the "Batch Select" button in the calendar's header or by using the `Toggle Batch Selection` hotkey.
-   **Context-Aware**: If you try to use a batch hotkey when Batch Selection Mode is not active, the command will not trigger, and you will see a notice informing you that the mode must be enabled.

### Available Batch Hotkey Commands

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

## Navigation Commands

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

### Show Skipped Events

-   **Function**: Opens a modal listing all events marked as skipped
-   **Features**: Quickly enable, navigate to, or open skipped events

### Show Disabled Recurring Events

-   **Function**: Opens a modal listing all disabled recurring events
-   **Features**: Quickly enable, navigate to, or open disabled recurring event sources

## Undo/Redo Commands

-   **Undo**: Reverses the last calendar operation
-   **Redo**: Reapplies a previously undone operation

## Recommended Keybindings

Here are suggested keybindings organized by workflow:

### Essential Bindings
| Command | Suggested Binding | Why |
|---------|------------------|-----|
| Open current note in calendar | `Ctrl/Cmd+Shift+C` | Quick calendar navigation from any note |
| Focus search | `Ctrl/Cmd+F` | Standard search shortcut |
| Toggle batch selection | `Ctrl/Cmd+B` | Quick access to batch operations |
| Undo | `Ctrl/Cmd+Z` | Standard undo binding |
| Redo | `Ctrl/Cmd+Y` | Standard redo binding |

### Advanced Filtering
| Command | Suggested Binding | Why |
|---------|------------------|-----|
| Focus expression filter | `Ctrl/Cmd+Shift+F` | Advanced search variant |
| Open filter preset selector | `Ctrl/Cmd+Shift+P` | Quick preset access |

### Batch Operations
| Command | Suggested Binding | Why |
|---------|------------------|-----|
| Batch: Delete Selection | `Ctrl/Cmd+Shift+Delete` | Clear batch delete |
| Batch: Duplicate Selection | `Ctrl/Cmd+D` | Quick duplication |
| Batch: Move By | `Ctrl/Cmd+M` | Precise date adjustments |

## Tips

-   **Batch operations** require batch selection mode to be active first
-   **Undo/redo** supports all event modifications (create, delete, move, edit)
-   **Command palette**: Access all commands via `Ctrl/Cmd+P` → search "Prisma Calendar"
-   **Filter commands** enable mouse-free navigation between filtering options
-   **Navigation commands** work even when the calendar is not currently open
