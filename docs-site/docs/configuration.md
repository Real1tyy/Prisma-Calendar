# Configuration

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
    <source src={useBaseUrl("/video/SettingConfig.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>
*Prisma Calendar settings with tabs for General, Properties, Calendar, Event Groups, Configuration, Notifications, Rules, Categories, Bases, and Integrations*

## Settings Search

A search input sits to the right of the section tabs (General, Properties, Calendar, etc.). Type a keyword to filter settings across **all sections** at once — only matching settings and their headings are shown. This is useful when you know the name of a setting but not which tab it's under.

- **Debounced**: filters automatically after a short delay (300ms) while typing
- **Enter**: applies the filter immediately
- **Clear**: remove the search text or click any tab to return to normal tabbed navigation

## Calendar Management

- Add, clone, or delete calendars from Settings → Prisma Calendar
- Each calendar is isolated: its own directory, filters, colors, and UI options
- Maximum calendars: 10 (configurable limit in code, UI will disable buttons at the max)

### Active Calendar

Pick the calendar you want to configure. Actions like Clone Current and Delete Current affect the active calendar only.

### Create / Clone / Delete

- Create New: generates a unique ID and default name (e.g., “Calendar 2”) with sensible defaults
- Clone Current: duplicates the entire configuration to a new calendar (ID and name change)
- Delete Current: removes the calendar and re-selects the next available one (at least one calendar must remain)

## General Settings

### Calendar Directory

- **Directory**: folder to scan for events and create new notes in (supports nested folders)
- **Template path**: optional Templater template used when creating events

### Parsing

- **Default duration (minutes)**: used when only `Start` is present (default: 60 minutes)
- **Show duration field in event modal**: display a duration in minutes field in the event creation/edit modal for quick editing. Changes to duration automatically update the end date, and vice versa (enabled by default)
- **Show stopwatch**: enable stopwatch in event modal for precise time tracking (enabled by default)
- **Show 'continue' button**: display a continue button in the stopwatch that resumes time tracking from the existing start date. The timer calculates elapsed time based on the event's start time and continues from there, perfect for resuming work on existing events (disabled by default)
- **Mark past events as done**: automatically mark past events as done during startup by updating their status property (configure the status property and done value in the Properties section)
- **Show untracked events dropdown**: display the untracked events dropdown in the calendar toolbar, showing events without date properties (enabled by default)

### Display & Navigation

- **Show ribbon icon**: display calendar icon in the left sidebar to open calendar (enabled by default)
- **Enable keyboard navigation**: enable arrow key navigation for calendar intervals (enabled by default)
- **Auto-assign Zettel ID**: automatically add a Zettel ID timestamp (`-YYYYMMDDHHmmss`) to filenames of events in the calendar directory that don't have one. Three modes: **Disabled** (default), **Calendar events only** (timed and all-day events), or **All events** (including untracked). When active, files are renamed as they are indexed — for example, `My Event.md` becomes `My Event-20260216120000.md`.

### Read-only Mode

**Read-only mode** prevents the plugin from automatically writing to files without user interaction.

**Storage Location:**
- Read-only mode state is stored in `.obsidian/plugins/prisma-calendar/sync.json` (separate from main settings)
- This allows you to prevent the read-only state from syncing across devices
- **For Git users:** Add `.obsidian/plugins/prisma-calendar/sync.json` to your `.gitignore` to keep read-only mode device-specific

**Access:**
- Toggle in Settings → General → "Read-only mode"

**When enabled:**
- Notifications will still appear, but the "Already Notified" property will NOT be written to files
- Recurring event instances will NOT be automatically generated
- Past events will NOT be automatically marked as done on startup
- Events created in the past will NOT have "Already Notified" automatically set

**When disabled (default):**
- All automatic file modifications work normally
- Notifications mark events as notified
- Recurring events generate physical instances automatically
- Past events are marked as done if the setting is enabled

**Manual actions still work:**
- Propagating frontmatter from the context menu (user-triggered)
- Creating, editing, or deleting events through the UI
- Any other user-initiated file operations

**Use cases:**
- Preventing sync conflicts when using multiple devices with Git
- Full control over when files are modified
- Avoiding automatic writes during vault migrations or backups
- Testing or debugging without file modifications
- Device-specific read-only mode (e.g., read-only on mobile, writable on desktop)

### Event Presets

- **Default preset**: select a preset to auto-fill when creating new events (optional)

## Properties Settings

Tell Prisma Calendar which frontmatter keys you use.

### Core Event Properties

- **Start property** (required): default `Start Date`
- **End property** (optional): default `End Date`
- **All-day property** (optional): default `All Day`
- **Date property** (optional): default `Date` (for all-day events)
- **Title property** (optional): default `Title` (falls back to file name when missing)
- **Timezone property** (optional): default `Timezone` (per-note timezone override)
- **Skip property**: property name to skip/hide event from calendar (default: `Skip`)

### Identification & Tracking

- **Calendar title property**: auto-computed display title stored as a wiki link with ZettelID stripped (default: `Calendar Title`). Used for clean rendering in the calendar and Bases views. Always kept in sync automatically. See [Event Naming](./features/management/zettelid-naming#calendar-title-property) for details
- **ZettelID property** (optional): when set, a timestamp-based ID is generated on creation/cloning (see [ZettelID Naming System](./features/management/zettelid-naming) for details). Default: `ZettelID`
- **Status property**: frontmatter property name for event status (default: `Status`), used when marking events as done or undone
- **Done value**: value to set in the status property when marking an event as done (default: `Done`)
- **Not done value**: value to set in the status property when marking an event as undone (default: `Not Done`)
- **Custom done property**: overrides the default status property for manual mark-as-done actions. Uses the format `propertyName value` (e.g., `archived true`, `priority 0`). When configured, this is used instead of the status property for context menu, modal checkbox, and batch operations. It is also used to evaluate whether an event is done — the context menu shows "Mark as undone" when the property matches. Auto-mark past events is not affected and continues to use the standard status property. Values are auto-parsed: `true`/`false` become booleans, numeric strings become numbers, everything else stays as a string. Leave empty to use the default status property behavior (default: empty)
- **Custom undone property**: overrides what happens when marking an event as undone. Same `propertyName value` format (e.g., `archived false`). Requires "Custom done property" to be configured first. If left empty, the custom done property key is removed from frontmatter on undone instead. Default: empty
- **Category property**: frontmatter property name for event categories (default: `Category`), used for grouping in statistics views. Supports **multiple comma-separated categories** (e.g., `Category: Work, Learning`) — events are counted under each category separately in statistics.
- **Location property**: frontmatter property name for event location (default: `Location`), a single string (e.g., "Conference Room A", "Zoom"). Shown in the Create/Edit Event modal when configured. **ICS Integration**: Location is mapped to the standard `LOCATION` field when exporting to ICS format and automatically imported from `LOCATION` fields in ICS files from external calendars (Google Calendar, Outlook, Apple Calendar, etc.).
- **Participants property**: frontmatter property name for event participants (default: `Participants`), an array of strings. In the modal, enter comma-separated names (e.g., "Alice, Bob, Charlie"). Stored as a YAML list in frontmatter. **ICS Integration**: Participants are exported as multiple `ATTENDEE` fields with RFC 5545-compliant formatting (including `mailto:` URIs and CN parameters) and imported from `ATTENDEE` fields in ICS files. Full round-trip compatibility with external calendar applications.
- **Break property**: frontmatter property name for break time in minutes (default: `Break`), subtracted from duration in statistics
- **Icon property**: frontmatter property name for event icon override (default: `Icon`). Accepts any emoji or text string (e.g., `🎉`, `📅`, `★`). The icon appears in the top-right corner of the event chip on the calendar, taking highest precedence over CalDAV account icons, ICS subscription icons, and recurring event markers. Shown as an input field in the Create/Edit Event modal when configured. See [Event Icons](./features/events/event-icons) for details.
- **CalDAV property**: property name for CalDAV sync metadata (default: `CalDAV`)

### Recurring Event Properties

- **Future instances count property**: property name for per-event override of future instances count (default: `Future Instances Count`)
- **Generate past events property**: property name for generating past recurring instances from source event start date (default: `Generate Past Events`)

### Recurring (node-based)

- RRule property: e.g., `daily`, `weekly`, `bi-weekly`, `monthly`, `bi-monthly`, `quarterly`, `semi-annual`, `yearly`
- RRule specification property: weekdays for weekly/bi-weekly (e.g., `monday, wednesday, friday`)
- RRule ID property: unique identifier for recurrence
- Source property: link to the source recurring event
- Ignore recurring property: when set to `true`, excludes the event from future instance generation count (useful for duplicated recurring events)

Example:

```yaml
---
Start: 2025-01-15T09:00
End: 2025-01-15T10:30
RRule: weekly
RRuleSpec: monday, wednesday, friday
RRuleID: standup-2025
---
```

#### Ignored Recurring Instances

When you duplicate a recurring instance using the context menu, the duplicated event gets `Ignore Recurring: true`. This means:
- The event is still tracked as part of the recurring series
- It does NOT count towards the "Future instances count" limit
- The recurring event manager won't create new instances to replace it

```yaml
---
Start: 2025-01-22T09:00
End: 2025-01-22T10:30
RRuleID: standup-2025
Source: "[[Weekly Meeting Source]]"
Ignore Recurring: true
---
```

⚠️ **WARNING: Do Not Manually Modify This Property**

The `Ignore Recurring` property is automatically managed by the system when you use the "Duplicate recurring instance" feature. Never manually add, change, or remove this property—doing so may break the recurring event generation logic.

### Always Include Date and Time Properties

Prisma Calendar automatically ensures that both date and time properties are always present in event frontmatter, regardless of whether the event is all-day or timed. This makes it easy to convert between all-day and timed events by manually editing the frontmatter.

**For all-day events:**
- The `Date` property contains the date (e.g., `2025-02-15`)
- The `Start` and `End` properties are empty strings
- The `All Day` property is `true`

**For timed events:**
- The `Start` and `End` properties contain the full datetime (e.g., `2025-02-15T09:00:00`)
- The `Date` property is an empty string by default
- The `All Day` property is `false` (or unset)

**Benefits:**
- **Easy conversion**: Change an all-day event to timed by adding values to `Start`/`End` and setting `All Day: false`
- **Consistent structure**: All events have the same property structure, making templates and scripts easier to write
- **No missing properties**: You can always reference `Date`, `Start`, or `End` without checking if they exist

**Example - All-day event:**
```yaml
---
Title: Holiday
Date: 2025-12-25
Start:
End:
All Day: true
---
```

**Example - Timed event:**
```yaml
---
Title: Meeting
Date:
Start: 2025-02-15T09:00:00
End: 2025-02-15T10:30:00
All Day: false
---
```

### Sorting Normalization for External Tools

**⚠️ Important**: The `All Day` property is the **source of truth** for event type. Prisma uses this property to determine how to parse the event:
- `All Day: true` → Uses `Date` property, ignores `Start`/`End`
- `All Day: false` (or unset) → Uses `Start`/`End` properties

**Sorting normalization strategy:**

When a sorting normalization strategy is enabled in Properties Settings, Prisma writes a normalized datetime to a dedicated `Sort Date` property. This allows external tools (Bases, Dataview, Obsidian search) to sort all event types — both timed and all-day — by a single field.

The `Sort Date` property is separate from the `Date` property used by all-day events. This avoids conflicts between the all-day event date and the normalized sorting value.

**Normalization modes:**

| Mode | Timed events | All-day events |
|------|-------------|----------------|
| **None** (default) | — | — |
| **Timed only — start** | Start datetime → Sort Date | — |
| **Timed only — end** | End datetime → Sort Date | — |
| **All-day only** | — | Date + `T00:00:00` → Sort Date |
| **All events — start** (recommended) | Start datetime → Sort Date | Date + `T00:00:00` → Sort Date |
| **All events — end** | End datetime → Sort Date | Date + `T00:00:00` → Sort Date |

All datetime values are written without the `.000Z` suffix. All-day events get `T00:00:00` appended so they sort consistently alongside timed events.

**Sort date property:**

The property name defaults to `Sort Date`. Change it in the "Sort date property" setting if you prefer a different name.

**Important**: For Bases views to sort events correctly by this property, the `Sort Date` property must be configured as a **Date & time** property type in Obsidian's property settings. If it is set to "Text" or another type, Bases will sort alphabetically instead of chronologically. To fix this, open Obsidian Settings → Properties and change the type of `Sort Date` to "Date & time", or add `"Sort Date": "datetime"` to your `.obsidian/types.json` file.

**Migration from previous versions:**

In earlier versions, date normalization wrote directly to the `Date` property, which conflicted with the all-day event date. If you previously used the `Date` property for sorting timed events in Bases or Dataview queries, enable the sorting normalization strategy (recommended: "All events — start datetime") and update your queries to sort by `Sort Date` instead of `Date`.

---
```

### Auto-mark Past Events

When enabled in General settings, Prisma Calendar will automatically update the status property of past events during startup:

- **For all-day events**: Checks if the date is in the past
- **For timed events**: Checks if the end date/time is in the past
- **Runs asynchronously**: Doesn't block the calendar from loading
- **Smart updates**: Only writes to files when the status needs to be changed

Example behavior:

```yaml
---
Start: 2025-01-10T14:00
End: 2025-01-10T15:00
STATUS: In Progress
---
```

After the end time passes, Prisma Calendar will automatically update it to:

```yaml
---
Start: 2025-01-10T14:00
End: 2025-01-10T15:00
STATUS: Done
---
```

## Calendar Settings (UI)

These settings control the calendar's view modes, time display, visual appearance, event interaction, and overlap behavior. For a thorough walkthrough of every calendar UI element — including toolbar buttons, view modes, event text coloring, sticky headers, and more — see the dedicated [Calendar View](./features/calendar/calendar-view) page.

### View Configuration

- **Default view**: set initial calendar view (dayGridMonth, timeGridWeek, timeGridDay, listWeek)
- **Default mobile view**: set initial calendar view for mobile devices (screen width ≤ 768px). Independent from desktop default view (dayGridMonth, timeGridWeek, timeGridDay, listWeek)
- **Hide weekends**: toggle Saturday/Sunday visibility
- **First day of week**: choose locale preference (0 = Sunday, 1 = Monday, etc.)
- **Show decimal hours**: show durations as decimal hours (e.g., 2.5h) instead of formatted (e.g., 2h 30m)

### Time Display

- **Day start / end hour**: visible time range in grids (default: 7-22)
- **Slot duration (minutes)**: grid slot height (default: 10 minutes, range: 1-60)
- **Snap duration (minutes)**: drag/resize snapping interval (default: 10 minutes, range: 1-60)
- **Zoom levels (minutes)**: comma-separated list for CTRL+scroll zoom (default: `1, 2, 3, 5, 10, 15, 20, 30, 45, 60`)

### Visual Appearance

- **Display density**: `comfortable` or `compact` (default: `comfortable`)
- **All-day event height**: maximum height for all-day events before scrolling (30-500px, default: 75px)
- **Past event contrast**: visual contrast of past events (0%-100%, default: 70%)
- **Show color dots**: color indicator dots in monthly view (enabled by default)
- **Thicker hour lines**: bolder full-hour lines in day/week views (enabled by default)
- **Show duration in event title**: appends duration after event title (enabled by default)
- **Default event text color**: text color for events with dark backgrounds (default: white)
- **Alternative event text color**: text color for events with light backgrounds (default: black). See [Calendar View → Event Text Coloring](./features/calendar/calendar-view#event-text-coloring) for details.
- **Sticky day headers**: pin day/date headers when scrolling in day/week views
- **Sticky all-day events**: pin all-day section when scrolling in day/week views (disabled by default)

### Event Interaction

- **Enable event preview**: hover previews inside the calendar (enabled by default)
- **Event hover tooltips**: displays event name, time/duration, file path, frontmatter properties, and first three lines of note content
- **Show current time indicator**: time line in day/week views (enabled by default)
- **Highlight upcoming event**: highlight the next upcoming event (enabled by default)
- **Skip underscore properties**: hide properties starting with `_` from event chips (enabled by default)

### Event Overlap

- **Allow event overlap**: whether events can visually overlap in all views (default: enabled)
- **Allow slot event overlap**: whether events can overlap within the same time slot in time grid views (default: enabled)
- **Event stack limit**: maximum events to stack before "+more" link (1-10, default: 1)
- **Desktop max events per day**: maximum events per day on desktop before "+more" (0-10, 0 = unlimited, default: 0)
- **Mobile max events per day**: maximum events per day on mobile before "+more" (0-10, default: 4)

## Configuration Settings

### Toolbar Buttons

Customize which buttons appear in the calendar's top toolbar. All buttons are enabled by default. Uncheck items to hide them. Reopen the calendar view for changes to take effect.

Available buttons: Left, Today, Now, Create Event, Right, Zoom Level, Filter Presets, Search Input, Expression Filter, Untracked Events, Timeline.

For a detailed description of each toolbar button and what it does, see [Calendar View → Toolbar](./features/calendar/calendar-view#toolbar).

### Batch Selection

- **Batch action buttons**: customize which action buttons appear in the batch selection mode toolbar. You can enable or disable individual buttons to streamline your workflow:
  - **Select All**: Select all visible events on the current calendar view
  - **Clear**: Deselect all currently selected events
  - **Duplicate**: Create duplicate copies of selected events
  - **Move By**: Move selected events by a specified number of days/weeks
  - **Mark as Done**: Mark selected events as done using the configured status property
  - **Clone Next**: Clone selected events to the next week
  - **Clone Prev**: Clone selected events to the previous week
  - **Move Next**: Move selected events to the next week
  - **Move Prev**: Move selected events to the previous week
  - **Open All**: Open all selected event notes in separate tabs
  - **Skip**: Mark selected events as skipped (hidden from calendar)
  - **Delete**: Delete selected event notes

  All buttons are enabled by default. The Counter (showing selection count) and Exit buttons are always shown and cannot be disabled.

### Context Menu

- **Context menu items**: customize which actions appear when right-clicking events. You can enable or disable individual context menu items to declutter the menu and keep only relevant actions:
  - **Enlarge**: Open event preview in a modal
  - **Preview**: Show hover preview for the event
  - **Go to source**: Navigate to the source recurring event
  - **Edit source event**: Open edit modal with source recurring event data (only appears on physical/virtual recurring instances)
  - **Duplicate recurring instance**: Create a duplicate of a physical recurring instance
  - **View recurring events**: Open modal showing all instances of a recurring event
  - **Edit event**: Open event edit modal
  - **Assign categories**: Open category assignment modal
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
  - **Duplicate remaining week days**: Duplicate event to all remaining days of the current week (disabled by default)

  All items are enabled by default unless noted otherwise. Menu items that don't apply to a specific event (e.g., recurring-specific actions on non-recurring events) are automatically hidden.

## Notifications Settings

Configure desktop notifications and alerts for upcoming events.

### General

- **Enable notifications**: turn on desktop notifications for events (enabled by default)
- **Notification sound**: play sound when notifications appear (disabled by default)

### Timing

- **Default minutes before** (timed events): minutes before timed events to notify (optional, undefined = no default notification)
- **Default days before** (all-day events): days before all-day events to notify (optional, undefined = no default notification)
- **Snooze minutes**: how many minutes to snooze notifications (default: 15 minutes)

### Property Names

- **Minutes before property**: frontmatter property to read per-event notification times (default: `Minutes Before`)
- **Days before property**: frontmatter property to read per-event notification days for all-day events (default: `Days Before`)
- **Already notified property**: frontmatter property to mark events as already notified (default: `Already Notified`)

### Per-Event Overrides

Each event can specify its own notification timing via frontmatter:

```yaml
---
Title: Important Meeting
Start Date: 2025-01-15T14:00
Minutes Before: 30  # Notify 30 minutes before this event
---
```

For all-day events:

```yaml
---
Title: Birthday
Date: 2025-01-15
Days Before: 1  # Notify 1 day before this all-day event
---
```

## Rules Settings

### Event Colors

Configure event colors based on frontmatter properties with a clean, modern interface:

- **Default event color**: Fallback color when no rule matches (uses standalone color picker)
- **Color rules**: Evaluated top-to-bottom; first match wins
- **Clean design**: Color pickers appear as standalone elements without bulky setting wrappers
- **Inline layout**: Expression input, color picker, and controls all in a single compact row
- **Easy reordering**: Move rules up/down with arrow buttons
- **Toggle rules**: Enable/disable rules with checkbox without deleting them

**UI Features:**
- Compact single-row layout for each rule
- Native color input for cleaner appearance
- Order indicator (#1, #2, etc.) shows evaluation priority
- Enable/disable checkbox for quick rule toggling
- Expression input with inline editing
- Move up/down arrows for reordering
- Delete button (×) for removing rules

Examples:

```text
Priority === 'High'         → red
Status === 'Done'           → #22c55e
Project === 'Work'          → hsl(210, 70%, 50%)
Type === 'Meeting'          → #f59e0b
```

Tips:
- Use property names directly (no prefix needed)
- Colors support CSS names, hex, or HSL
- Rules are evaluated in order - put more specific rules first
- Disabled rules are skipped during evaluation

### Event Filtering

All expressions must evaluate to true; events failing any filter are excluded.

```text
Status !== 'Inbox'
Priority === 'High'
Status === 'Done' || Status === 'In Progress'
!_Archived
Array.isArray(Project) && Project.length > 0
```

### Filter Presets

Create named filter expressions for quick access via the calendar toolbar dropdown:

1. Go to Settings → Rules → Filter Presets
2. Click "Add Preset"
3. Enter a name (e.g., "High Priority Only")
4. Enter the filter expression (e.g., `Priority === 'High'`)

**Using Presets:**
- Click the ▼ dropdown button in the calendar toolbar (next to the zoom button)
- Select a preset to apply its filter instantly
- Select "Clear" to remove the active filter

**Notes:**
- Filter presets use the same expression syntax as event filtering
- Presets are per-calendar configuration
- Active preset filters are temporary and reset when the calendar is reloaded

### Categories Settings

Manage category colors visually with the Categories Settings section:

![Categories Settings](/img/categories_settings.png)

![Categories Settings Pie Chart](/img/categories_settings_pie_chart.png)

1. Go to Settings → Categories
2. View all categories automatically detected from your events
3. See event counts and percentages for each category (e.g., "Work (15 events - 45.5%)")
4. Configure colors using the color picker for each category
5. View a pie chart showing category distribution with percentages
6. Rename or delete categories using the edit (pencil) and delete (trash) buttons

**Features:**
- **Automatic Detection**: Categories are automatically collected from all events using the category property configured in Settings → Properties
- **Read-Only Categories**: Categories cannot be edited directly - they're detected from event usage
- **Color Management**: Each category color is stored as a color rule (e.g., `Category.includes('Work')`) and updates in real-time
- **Visual Distribution**: Pie chart shows percentage breakdown of events across categories
- **Sorted by Usage**: Categories are sorted by event count (most used first)
- **Category Management**: Rename and delete categories with confirmation modals showing affected event counts

:::note Important
After renaming or deleting categories, restart Obsidian for changes to fully propagate across all calendar views and settings.
:::

**How Category Colors Work:**
- When you set a color for a category, it creates or updates a color rule behind the scenes
- The expression format is: `{CategoryProperty}.includes('{CategoryName}')`
- Colors apply immediately to all events with that category
- If no color is set for a category, it uses the default event color

**Example:**
If your category property is `Category` and you set a color for "Work", it creates a color rule:
```
Category.includes('Work') → #3b82f6
```

All events with `Category: Work` will now use that color.

### Auto-Assign Categories

Configure automatic category assignment for events based on event names. When you finish typing the event title in either the create or edit modal, the system checks for matches and assigns categories accordingly.

#### Auto-assign when name matches category

Automatically assigns a category when the event name matches a category name (case-insensitive, ignoring ZettelID and instance dates).

**Behavior:**
- **Create modal**: Categories are auto-assigned when you blur the title field (click away or tab out)
- **Edit modal**: Categories are auto-assigned when you change the title and blur the title field
- **Applies to both**: Name matching and custom presets work consistently in both create and edit workflows

#### Detect event name typos

When enabled, the plugin uses fuzzy matching to detect likely typos in event names after the title field loses focus. If the entered name is close to a known category, preset event name, or existing event series, a "Did you mean?" modal appears with up to 3 suggestions. Navigate with arrow keys, accept with Enter, or dismiss with Escape. Enabled by default. Located in **Settings → General → Parsing**.

📖 See [Categories - Typo Detection](/features/organization/categories#event-name-typo-detection) for details.

#### Custom category assignment presets

Define custom rules to map specific event names to multiple categories. Each preset can now include **multiple comma-separated event names** that will all receive the same category assignments.

**Features:**
- **Multiple event names per preset**: Use commas to define multiple event names in a single preset (e.g., "Coding, Work, Dev" → Software, Business)
- **Flexible matching**: Any of the comma-separated names will trigger the category assignment
- **Colorful visual design**: Selected categories display in their configured colors for easy identification
- **Compact layout**: Single-row design with inline elements for better space efficiency
- **Easy management**: Add categories with "+" button, remove with "×" button on each tag

**Example Presets:**
- Event names: `Coding, Work, Dev` → Categories: Software, Business
- Event names: `Gym, Exercise, Workout` → Categories: Health, Fitness
- Event names: `Reading, Study` → Categories: Learning, Personal Development

📖 See [Categories - Auto-Assignment](/features/organization/categories#1-auto-assignment-new-event-creation) for detailed usage and examples.

## Frontmatter Display

Show extra frontmatter properties inside event chips (scrollable when space is tight).

- **Display properties (timed events)**: comma-separated list of properties to show in timed event chips (e.g., `status, priority, project, tags`)
- **Display properties (all-day events)**: comma-separated list of properties to show in all-day event chips (can differ from timed events)
- **Display properties (untracked events)**: comma-separated list of properties to show in the untracked events dropdown (e.g., `status, priority, category`)

Rendered example inside a chip:

```
Meeting with Team
status: In Progress
priority: High
project: Q4 Planning
```

**See Also**: [Untracked Events documentation](./features/events/untracked-events.md) for details on the untracked events dropdown

## Bases

Configure the appearance and content of Bases views throughout Prisma Calendar.

- **View type**: Choose the default view layout for all Bases views. Options:
  - **Cards** (Recommended): Displays events as visual cards in a grid layout
  - **Table**: Displays events in a sortable table with columns
  - **List**: Displays events in a simple list format

- **Additional properties**: Comma-separated list of property names to include as additional columns in Bases views (e.g., `priority, project, tags`)

### Where Bases Views Are Used

These configured settings apply to all Bases views:

1. **Event Series Modal**: When clicking Table/List/Cards buttons in the Bases footer of the Event Series Modal (filters by recurring event, name series, or category)
2. **Category Events View**: When clicking on a category in Settings → Categories
3. **Current Interval View**: When using the "Show current interval in Bases" command (daily, weekly, or monthly views)

### Default Columns

All Bases views include these columns by default:
- **File name**: Link to the event note
- **Date property**: The configured date/time property (sorted by this column)
- **Status**: Current event status

### Custom Columns

Properties you add to "Additional properties" appear after the default columns. Common examples:

- **priority**: Show event importance (e.g., High, Medium, Low)
- **project**: Group events by project
- **tags**: Display event tags or categories
- **duration**: Show event length
- **location**: Display event location
- **attendees**: List event participants

**See Also**:
- [Event Series Bases Integration](./features/events/event-series.md#bases-view-integration) for viewing event series in Bases
- [Hotkeys documentation](./features/advanced/hotkeys.md#show-current-interval-in-bases) for using the "Show current interval in Bases" command
- [Categories documentation](./features/organization/categories.md) for category-based Bases views

## Event Presets

Save reusable event templates with pre-filled values for quick event creation. Create presets from the Create/Edit Event modal, apply them from the modal header dropdown, and optionally set a default preset that auto-fills new events.

Presets save title, dates, categories, location, icon, participants, recurring settings, and custom properties.

📖 See [Event Presets](./features/events/event-presets) for full documentation on creating, using, and managing presets.

## Break Time for Statistics

Track accurate productive time by excluding breaks from event duration.

### Configuration

- **Break property**: Configure the property name in Settings → Properties (default: `Break`)
- **Event modal**: When break property is configured, a "Break (minutes)" field appears in the Create/Edit Event modal

### Usage

Add the `Break` property to your event frontmatter:

```yaml
---
Title: Work Session
Start Date: 2025-01-15T09:00
End Date: 2025-01-15T17:00
Break: 60  # 1 hour lunch break
---
```

### How It Works

- **Statistics calculation**: Break time is subtracted from total duration
- **Example**: An 8-hour event with `Break: 60` shows as 7 hours in statistics
- **Decimal support**: Enter partial minutes (e.g., `45.5` for 45.5 minutes)
- **Per-event**: Each event can have its own break time

### Use Cases

- Exclude lunch breaks from work sessions
- Track actual meeting time excluding breaks
- Accurate time tracking for billing purposes

## Event Groups Settings

### Recurring Instances (Generation Horizon)

- **Future instances count**: how many future notes to pre-generate (1–52, default: 2)
- Beyond that, events appear as read-only virtual items to keep your vault light
- **Per-event override**: Set `Future Instances Count` property in a recurring event's frontmatter to override the global setting for that specific recurring series

### Event Markers

Visual indicators appear in the top-right corner of recurring events to distinguish between source events and physical instances (shown by default):

- **Show source recurring marker**: Toggle visibility of markers on source recurring events (default: enabled)
- **Source recurring marker**: Symbol/emoji displayed on source recurring events (default: ⦿). Use any Unicode character or emoji.
- **Show physical recurring marker**: Toggle visibility of markers on physical recurring instances (default: enabled)
- **Physical recurring marker**: Symbol/emoji displayed on physical recurring instance events (default: 🔄). Use any Unicode character or emoji.

Customize markers in Settings → Event Groups → Event markers to use your preferred symbols (e.g., ⚙️, 🔁, 📍, ⭐, 📌) or disable them if you prefer a cleaner look.

### Frontmatter Propagation

Frontmatter propagation keeps custom properties in sync across related events. When you change a property on one event, the change can automatically apply to all related events. Three propagation scopes are available — recurring instances, name series, and category series — each with independent toggles.

#### Recurring Instance Propagation

Control how frontmatter changes in source recurring events propagate to physical instances:

- **Propagate frontmatter to instances**: When enabled, changes to custom frontmatter properties automatically propagate to all existing physical instances without confirmation.
- **Ask before propagating**: When enabled, a confirmation modal appears showing all accumulated changes before applying them.

#### Name Series Propagation

Propagate frontmatter changes across events that share the same title (with ZettelID stripped). When you update a custom property on one event, all other events with the same cleaned name are updated.

- **Propagate frontmatter to name series**: Auto-propagate changes across name-based series members without confirmation.
- **Ask before propagating to name series**: Show a confirmation modal before propagating to name series members.

Name series require at least 2 events with the same cleaned title to trigger propagation.

#### Category Series Propagation

Propagate frontmatter changes across events that share the same category value. When you update a custom property on one event, all other events with the same category are updated.

- **Propagate frontmatter to category series**: Auto-propagate changes across category-based series members without confirmation.
- **Ask before propagating to category series**: Show a confirmation modal before propagating to category series members.

Category series require at least 2 events with the same category value to trigger propagation.

#### Shared Propagation Settings

These settings apply to all three propagation types (recurring, name series, category series):

- **Excluded properties**: Comma-separated list of additional frontmatter property names to exclude from propagation. These properties, along with all Prisma-managed properties (Start, End, Date, RRule, RRuleID, Source, etc.), are never propagated to preserve instance-specific timing and system integrity.
- **Propagation debounce delay**: Delay in milliseconds before propagating changes (100ms - 10,000ms, default: 3000ms). Multiple rapid changes within this window are accumulated and merged together. Lower values propagate faster; higher values accumulate more changes before propagating.

#### How Propagation Works

For each scope, the "propagate" and "ask before" toggles are mutually exclusive — enabling one disables the other. If both are disabled for a scope, changes are not propagated for that scope.

The system intelligently detects three types of changes:

- **Added**: New properties added to the source event
- **Modified**: Existing properties changed in the source event
- **Deleted**: Properties removed from the source event

Only the specific changes detected are propagated, preserving any instance-specific properties that weren't changed in the source. Loop prevention ensures that propagated changes don't trigger further cascading propagation.

## Integrations Settings

Integration settings for connecting with external calendar services and importing/exporting events. Access via Settings → Integrations.

### ICS Export/Import

- **Export folder**: folder where exported .ics files are saved (default: `Prisma-Exports`)
- **Export calendar**: export all events to an .ics file
- **Import .ics**: import events from an .ics file

See the [Integrations](./features/advanced/integrations) documentation for full details.

### CalDAV

Configure CalDAV accounts for two-way sync with external calendar servers. See the [CalDAV](./features/advanced/integrations#caldav) documentation.

### ICS URL Subscriptions

Subscribe to external calendars via public ICS URLs for automatic periodic syncing. See the [ICS Subscriptions](./features/advanced/integrations#ics-url-subscriptions) documentation.

### Holidays

- **Enable holidays**: display public holidays on the calendar as virtual read-only events
- **Country**: ISO country code (e.g., US, GB, DE, CA)
- **State/Province**: optional state or province code
- **Region**: optional region code for more specific holidays
- **Holiday types**: select which types of holidays to display (public, bank, school, observance, optional)
- **Timezone**: optional timezone for holiday calculations

See the [Holidays](./features/calendar/holidays) documentation for full details.
