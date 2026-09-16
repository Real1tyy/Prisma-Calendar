# File Menu Actions

Event actions aren't only reachable from the calendar. When a note in your vault
is an event Prisma has indexed, right-clicking it **in Obsidian's file explorer**
— or opening its tab's **More options** menu — adds a Prisma group to the native
menu, so you can act on the event from wherever you already are.

## What you get

Right-click `Events/Team Meeting.md` in the file explorer and the menu gains:

| Action | What it does |
| --- | --- |
| **Edit event** | Opens the event edit modal — the same one the calendar's right-click menu opens |
| **Trigger stopwatch** | Starts a time-tracking session for that event, without opening the calendar |
| **Mark as done** / **Mark as undone** | Toggles the event's status property; the label reflects the current state |
| **Skip event** / **Unskip event** | Hides the event from the calendar, or brings it back |

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

## Turning it off

**Settings → General → Interface → Show event actions in the file menu**

The toggle is per planning system and on by default. Switch it off and Prisma
adds nothing to the native menu for that calendar's events.

The **Trigger stopwatch** entry additionally follows
[Show time tracker in event modal](./time-tracker.md) — turn the time tracker off
and the entry disappears from the file menu too, matching the calendar's
right-click menu.
