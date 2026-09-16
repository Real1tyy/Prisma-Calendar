# Undo/Redo System

import useBaseUrl from "@docusaurus/useBaseUrl";

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video
    controls
    autoPlay
    loop
    muted
    playsInline
    style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}
  >
    <source src={useBaseUrl("/video/UndoRedo.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

Prisma Calendar features a powerful and reliable undo/redo system for every action you take. You can confidently make changes, knowing you can easily reverse them.

## Per-Planning-System History

Each planning system has its own independent history. This means:

-   Actions in one planning system don't affect another's undo history.
-   The system remembers your last 100 actions for each planning system. Beyond that, the oldest entry drops off.
-   Undoing something doesn't throw away the ability to redo it later — an undone operation stays in the log and can be re-applied even after you've done other things. See [Operation history](#operation-history).

## How to Use

Simply use Obsidian's hotkeys for undo and redo.

-   **Assign Shortcuts**: Go to `Settings -> Hotkeys` and set your preferred shortcuts for `Prisma Calendar: Undo` and `Prisma Calendar: Redo`.
-   **Active Calendar**: The undo/redo actions will always apply to the calendar pane you are currently focused on.

![Undo/Redo Commands](/img/undo_redo.png)

## Operation History

Undo and redo walk the stack one step at a time. The **Operation history** modal shows you the whole stack at once, so you can reach any operation directly.

Open it from the clock-rewind button in the calendar toolbar, or run `Prisma Calendar: Show operation history` (assign it a hotkey in `Settings -> Hotkeys`).

### What you see

Every recorded operation, one row each, newest at the top — flip to oldest-first with the sort button. Each row shows:

-   **What happened** — "Edit event", "Mark as done", "Batch: 12 operations".
-   **When** — a relative time ("3 minutes ago"); hover for the exact timestamp.
-   **Applied** or **Undone** — whether the operation is currently in effect.

The list is virtualized, so a full 100-entry log scrolls as smoothly as an empty one.

### What you can do

-   **Undo / Redo one row** — reverse (or re-apply) *just that operation*, leaving everything else alone. You can undo the twentieth-last operation and keep the nineteen that came after it. This is more surgical than Ctrl+Z, and correspondingly sharper: undoing a "create event" while a later edit to that same event is still applied leaves the edit pointing at a file that's gone. Prisma detects the common cases and refuses rather than corrupting anything, but prefer **Revert to here** when the operations are related.
-   **Revert to here** — undo everything from the newest operation down to and including that row, newest first.
-   **Restore to here** — the mirror: re-apply every undone operation from the oldest up to and including that row.
-   **Clear history** — empty the log. This does not undo anything; it only forgets.

### The log survives a restart, replay doesn't

The history log is saved on your device, so reopening Obsidian shows you what you did yesterday, with timestamps intact. Those older rows are marked **Previous session** and their Undo/Redo buttons are disabled.

That limit is deliberate. Undoing an edit means restoring the snapshot taken when it happened — and a snapshot from a previous session describes a vault that has since changed, possibly by your own hand or by sync from another device. Replaying it would silently overwrite everything you did in between. So history from earlier sessions is a record you can read, not a button you can press. **Revert to here** and **Restore to here** still work across such a row; they simply skip the entries that can't be replayed.

The log lives on the device, not in the vault, so it doesn't sync between machines — each device keeps its own record of what it did.

## What You Can Undo and Redo

Virtually every operation in the calendar is tracked, giving you complete control.

### Single Event Actions
-   **Create Event**: Undoing removes the newly created event file.
-   **Edit Event**: Undoing reverts any changes made in the edit dialog.
-   **Delete Event**: Undoing brings the deleted event right back.
-   **Clone Event**: Undoing removes the cloned copy.
-   **Duplicate Current Event**: Undoing removes the duplicated copy.
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