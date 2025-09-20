# Undo/Redo System

Prisma Calendar features a powerful and reliable undo/redo system for every action you take. You can confidently make changes, knowing you can easily reverse them.

## Per-Calendar History

Each calendar has its own independent history. This means:

-   Actions in one calendar don't affect another's undo history.
-   The system remembers your last 50 actions for each calendar.
-   When you perform a new action, the "redo" history for that calendar is cleared, which is standard behavior in most apps.

## How to Use

Simply use Obsidian's hotkeys for undo and redo.

-   **Assign Shortcuts**: Go to `Settings -> Hotkeys` and set your preferred shortcuts for `Prisma Calendar: Undo` and `Prisma Calendar: Redo`.
-   **Active Calendar**: The undo/redo actions will always apply to the calendar pane you are currently focused on.

## What You Can Undo and Redo

Virtually every operation in the calendar is tracked, giving you complete control.

### Single Event Actions
-   **Create Event**: Undoing removes the newly created event file.
-   **Edit Event**: Undoing reverts any changes made in the edit dialog.
-   **Delete Event**: Undoing brings the deleted event right back.
-   **Clone Event**: Undoing removes the cloned copy.
-   **Move Event**: Undoing moves the event back to its original date.

### Drag-and-Drop and Resizing
-   **Move by Dragging**: Drag an event to a new day? You can undo it.
-   **Resize Duration**: Lengthen or shorten an event by dragging its edge? You can undo that too.

### Batch Operations
All batch selection operations are fully undoable, often as a single action:
-   **Batch Delete**: Undo restores all selected events at once.
-   **Batch Duplicate**: Undo removes all the duplicated copies.
-   **Batch Clone**: Undo removes all cloned events from the target week.
-   **Batch Move**: Undo moves the whole group of events back to their original dates.