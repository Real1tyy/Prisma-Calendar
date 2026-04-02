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

Check the **"Virtual event"** checkbox in the create or edit modal. The event appears on the calendar but no `.md` file is created.

### Storage

Manual virtual events are stored in a `Virtual Events.md` file inside your calendar folder. The file contains a `prisma-virtual-events` code fence with JSON data. Opening the file shows an interactive table of all virtual events.

Each virtual event stores: title, start/end datetime, all-day flag, and frontmatter properties.

### Converting Between Virtual and Physical

- **Right-click a physical event → "Make virtual"**: Deletes the backing file and stores the event metadata as a virtual entry. Title, dates, and properties are preserved.
- **Right-click a virtual event → "Make real"**: Creates a backing `.md` file from the stored metadata and removes the virtual entry.
- **Edit modal**: Toggle the "Virtual event" checkbox to convert in either direction.

:::note
Converting physical → virtual preserves frontmatter properties but not note body content.
:::

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
