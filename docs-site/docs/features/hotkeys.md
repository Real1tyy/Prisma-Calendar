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
