# The Prisma.md Data File

Each planning folder has a `Prisma.md` file that serves as its dedicated data store. It contains managed JSON code fences for data that does not require individual note files:

- `prisma-virtual-events`: Stores manual virtual events. When you open `Prisma.md` in Obsidian, Prisma renders an interactive table of all virtual events in that planning folder. See [Virtual Events](../events/virtual-events.md).
- `prisma-deleted-events`: Stores [integration deletion history](./integrations.md#removing-a-synced-event-locally) so deleted CalDAV and ICS events stay deleted across future syncs.

## Code Blocks

`Prisma.md` organizes plugin data into distinct code fences:

### `prisma-virtual-events`

Holds manual virtual events created for time blocking and planning without individual vault notes. Each record stores:
- `id`: Unique identifier
- `title`: Event title
- `start` / `end`: Datetime boundaries
- `allDay`: All-day event flag
- `properties`: Custom frontmatter properties preserved from event forms

When you open `Prisma.md` in Obsidian, Prisma renders an interactive table showing every virtual event in that folder, where you can view dates, edit details, or convert them into physical notes.

### `prisma-deleted-events`

Holds records of remote integration events (CalDAV or ICS subscriptions) that you deleted locally. Each record stores:
- `id`: Internal unique key
- `kind`: `"caldav"` or `"ics-subscription"`
- Source identifier: `accountId` and `calendarHref` for CalDAV; `subscriptionId` for ICS subscriptions
- `uid`: Remote event UID

When sync runs, it checks these records to ensure suppressed events are not recreated. Restoring an event with Undo removes its deletion record, making it eligible for sync again.

## Shared Planning Folders

When multiple planning systems or calendars point to the same folder, they share `Prisma.md`. Prisma coordinates writes to the file so changes from different calendars do not overwrite each other.

## Synchronization

Sync `Prisma.md` alongside your event notes with Obsidian Sync or your vault synchronization tool. Exclude neither the planning folder nor the `Prisma.md` file.

Because `Prisma.md` is a standard Markdown note in your vault:
- It requires no special plugin JSON-file sync setting or extra configuration.
- Any vault synchronization tool syncs it like any other note.
- Keep the same integration configuration across devices.

## Reader Devices

Reader devices (configured with Read-only mode under **Settings → General**) receive `Prisma.md` through vault synchronization. They do not automatically create the file or run migration writes.

## Automatic Migration

On a writer device, an existing `Virtual Events.md` file migrates to `Prisma.md` on startup:
- If `Prisma.md` does not yet exist, the file is renamed directly, keeping all surrounding text and notes.
- If `Prisma.md` already exists, virtual events merge into its code block, and the legacy file moves to trash.

## Changing Folders

When you change the calendar directory in settings, the plugin waits **3 seconds** after your last keystroke before creating `Prisma.md` at the new path. This prevents stray files from appearing at half-typed paths while you type.

## Concurrent Edits and Conflict Resolution

Let synchronization complete before editing from another device. If concurrent offline edits happen, resolve sync conflict copies through your synchronization tool without dropping either data section. Malformed JSON or duplicate managed blocks pause edits to that section until repaired.
