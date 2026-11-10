# Virtual Events

import useBaseUrl from "@docusaurus/useBaseUrl";

Show recurring events beyond your generation horizon without creating physical files.

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video
    controls
    autoPlay
    loop
    muted
    playsInline
    style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}
  >
    <source src={useBaseUrl("/video/VirtualEvents.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

*Calendar view showing both physical events (solid) and virtual events (far future recurring instances)*

## How Virtual Events Work

Virtual events are **read-only calendar entries** that extend your recurring series beyond the physical notes you've generated. They appear in the calendar view but don't create actual files in your vault.

### Physical vs Virtual Events

**Physical Events** (up to "Future instances count" setting):
- Actual `.md` files created in your vault
- Inherit complete structure from configuration node (frontmatter + content)
- Editable and available for batch operations
- Searchable within Obsidian
- Take up storage space

**Virtual Events** (beyond generation horizon):
- Calendar-only display items showing recurring pattern
- Visual continuation of your recurring schedule into the future
- Read-only (cannot be edited or selected for batch operations)
- Don't create physical files, have no properties, or consume storage

## Benefits

### Vault Management
- **Keep your vault lean** - avoid cluttering with hundreds of future notes
- **Reduce search noise** - only current/near-future events appear in searches
- **Faster vault performance** - fewer files to index and sync

### Planning Visibility
- **See long-term patterns** - visualize your recurring schedule months/years ahead
- **Spot scheduling conflicts** - identify overlapping events even far in the future
- **Plan around recurring commitments** - understand your availability patterns

## Configuration

The physical/virtual boundary is controlled by the **"Future instances count"** setting. See [Recurring Events - Generation Control](./recurring-dsl.md#generation-control) for details on counting logic, ranges, and per-event overrides.

**Converting Virtual to Physical**: Increase "Future instances count" in settings to generate physical files for previously virtual events.

## Example

Weekly team meetings with "Future instances count" = 2 creates 6 physical files (2 weeks × 3 days). Beyond that, virtual events display the pattern indefinitely without creating files.

## Context Menu

Right-click any virtual event to access limited context menu actions. Since virtual events have no backing file, actions like edit, delete, preview, and file operations are unavailable. Available actions:

- **Go to source**: Navigate to the source event in the calendar (switches to week view and highlights for 5 seconds)
- **Edit source event**: Open the source recurring event's edit modal
- **Enlarge**: View the source event's properties in an enlarged modal

## Manual Virtual Events

Manual virtual events are calendar entries you create without a backing vault file. Use them for lightweight time blocking and planning — reserve calendar time without cluttering your vault with extra notes.

### Creating Manual Virtual Events

Toggle the **Virtual** pill in the modal header (next to the title). When active, the pill highlights in your accent color. The event appears on the calendar but no `.md` file is created.

### Storage: The Prisma.md data file {#storage}

Each planning folder has a `Prisma.md` file that serves as its dedicated data store. It contains two managed JSON code fences:

- `prisma-virtual-events`: Stores manual virtual events. When you open `Prisma.md` in Obsidian, Prisma renders an interactive table of all virtual events in that planning folder.
- `prisma-deleted-events`: Stores [integration deletion history](../advanced/integrations.md#removing-a-synced-event-locally) so deleted CalDAV and ICS events stay deleted across future syncs.

Each virtual event stores: title, start/end datetime, all-day flag, and frontmatter properties.

#### Shared planning folders

When multiple planning systems or calendars point to the same folder, they share `Prisma.md`. Prisma coordinates writes to the file so changes from different calendars do not overwrite each other.

#### Synchronization

Sync `Prisma.md` alongside your event notes with Obsidian Sync or your vault synchronization tool. Exclude neither the planning folder nor the `Prisma.md` file. Because `Prisma.md` is a standard Markdown note in your vault, you do not need any special plugin JSON-file sync setting or extra configuration. Keep the same integration configuration across devices.

#### Reader devices

Reader devices (configured with Read-only mode under **Settings → General**) receive `Prisma.md` through vault synchronization. They do not automatically create the file or run migration writes.

#### Automatic migration

On a writer device, an existing `Virtual Events.md` file migrates to `Prisma.md` on startup. If `Prisma.md` does not yet exist, the file is renamed directly, keeping all surrounding text. If `Prisma.md` already exists, virtual events merge into its code block.

#### Changing folders

When you change the calendar directory in settings, the plugin waits **3 seconds** after your last keystroke before creating `Prisma.md` at the new path. This prevents stray files from appearing at half-typed paths while you type.

#### Concurrent edits and conflict resolution

Let synchronization complete before editing from another device. If concurrent offline edits happen, resolve sync conflict copies through your synchronization tool without dropping either data section. Malformed JSON or duplicate managed blocks pause edits to that section until repaired.

### Converting Between Virtual and Physical

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/VirtualToRealConversions.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/VirtualToRealConversions.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

- **Right-click a physical event → "Make virtual"**: Deletes the backing file and stores the event metadata as a virtual entry. Title, dates, and properties are preserved.
- **Right-click a virtual event → "Make real"**: Creates a backing `.md` file from the stored metadata and removes the virtual entry.
- **Edit modal**: Toggle the **Virtual** pill in the modal header to convert in either direction.
- **Batch conversion**: Select multiple events in batch selection mode and use the "Make Virtual" or "Make Real" buttons to convert them all at once. See [Batch Operations](../management/batch-operations.md#make-virtual--make-real).

:::note
Converting physical → virtual preserves frontmatter properties but not note body content.
:::

### Undo / Redo

All virtual event operations are fully undoable:

- **Creating** a virtual event (from create modal)
- **Deleting** a virtual event (from context menu)
- **Converting physical → virtual** (from edit modal or context menu)
- **Converting virtual → physical** (from edit modal or context menu)

Use the standard undo/redo hotkeys or the plugin's undo command to reverse any of these operations. Undoing a conversion restores the original state — the backing file is recreated or the virtual entry is restored with its original data.

### Open Virtual Events File

Use the command palette command **"Open virtual events file"** to navigate directly to the `Prisma.md` file for a calendar. You can assign a hotkey to this command in Settings → Hotkeys.

### Context Menu

Manual virtual events support a subset of context menu actions:

- **Edit event**: Open the edit modal to change title, dates, or properties
- **Delete event**: Remove from the virtual events file
- **Make real**: Convert to a physical event with a backing file
- **Enlarge**: View event properties in an enlarged modal

Actions that require a backing file (preview, open file, stopwatch, duplicate, move, skip) are unavailable.

## Related

- [Recurring Events](./recurring-dsl.md) - Complete recurring event documentation
- [Configuration](../../configuration/event-groups#recurring-instances-generation-horizon) - Future instances count settings
