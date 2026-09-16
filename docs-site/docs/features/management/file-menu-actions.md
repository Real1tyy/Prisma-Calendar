# File Menu Actions

Event actions aren't only reachable from the calendar. When a note in your vault
is an event Prisma has indexed, right-clicking it **in Obsidian's file explorer**
— or opening its tab's **More options** menu — adds a Prisma group to the native
menu, so you can act on the event from wherever you already are.

## What you get

Right-click `Events/Team Meeting.md` in the file explorer and the menu gains:

The two entry points start with different sets, because they are different
moments: in the file explorer you are picking a note out of many and may want to
act on it; from a note's own header you are already reading it, so the useful
moves are navigational.

| Action | What it does | File explorer | Note header |
| --- | --- | --- | --- |
| **Open in calendar** | Opens the calendar, moves it to the event's week and flashes the event | Yes | Yes |
| **Edit event** | Opens the event edit modal — the same one the calendar's right-click menu opens | Yes | Yes |
| **Trigger stopwatch** | Starts a time-tracking session for that event, without opening the calendar | Yes | Yes |
| **View event groups** | Opens the event-groups modal for everything sharing this event's name, category or recurrence | Yes | Yes |
| **Mark as done** / **Mark as undone** | Toggles the event's status property; the label reflects the current state | Yes | No |
| **Skip event** / **Unskip event** | Hides the event from the calendar, or brings it back | Yes | No |
| **Assign categories** | Opens the category picker and writes your selection to the note | No | No |
| **Assign prerequisites** | Starts prerequisite selection in the calendar, with this note as the target | No | No |

Every action is a toggle on both surfaces — the columns are only where each one
starts.

**Assign prerequisites** needs that planning system's calendar open somewhere —
it starts a selection you make *in* the calendar, so it only appears when there
is one to select in.

Every action runs exactly as it does from the calendar's right-click menu,
including undo support — see [Undo & Redo](./undo-redo.md).

## When the actions appear

The group only shows for notes Prisma actually tracks:

- The note must sit inside a planning system's configured folder, **and**
- Prisma must have indexed it as an event (it has the start/date properties an
  event needs).

A plain note — inside the folder or anywhere else in the vault — gets the normal
Obsidian menu with nothing added. Notes outside every planning system's folder
are never touched.

If two planning systems' folders overlap or nest, the note is attributed to the
**first** calendar in your settings list whose folder contains it.

## Choosing which actions appear

The two places this menu opens from are configured separately, under
**Settings → Configuration**:

| Section | Covers |
| --- | --- |
| **File explorer menu** | Right-clicking the note in the file explorer or a sidebar tree |
| **Note header menu** | The note's tab, and the **⋮ More options** menu in its header |

Each section lists every action with a toggle apiece. Uncheck the ones you don't
want on that surface — so the file explorer can keep the full set while a note's
header offers only **Mark as done**, or vice versa. Clearing every toggle in a
section means Prisma adds nothing there.

**Assign categories** and **Assign prerequisites** start switched off on both
surfaces: they open a picker or start a selection rather than acting on the event
directly, so they stay out of the way until you turn them on — commonly just for
the file explorer.

**Mark as done** and **Skip event** start switched off on the note header, where
the menu leans navigational; turn either on if you want to change an event's
state without leaving the note.

Changes apply immediately; there is no need to reopen anything.

## Turning it off

**Settings → General → Interface → Show event actions in the file menu**

This is the master switch, per planning system and on by default. Switch it off
and Prisma adds nothing to either surface for that calendar's events, whatever
the per-surface sections say.

The **Trigger stopwatch** entry additionally follows
[Show time tracker in event modal](./time-tracker.md) — turn the time tracker off
and the entry disappears from the file menu too, matching the calendar's
right-click menu.
