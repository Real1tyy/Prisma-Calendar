# Configuration

![Settings Panel](/img/settings.png)

*Prisma Calendar settings with tabs for General, Properties, Calendar UI, Notifications, and Rules*

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

- Directory: folder to scan for events and create new notes in (supports nested folders)
- Template path: optional Templater template used when creating events

### Parsing

- Default duration (minutes): used when only `Start` is present
- Show duration field in event modal: display a duration in minutes field in the event creation/edit modal for quick editing. Changes to duration automatically update the end date, and vice versa (enabled by default)
- Mark past events as done: automatically mark past events as done during startup by updating their status property (configure the status property and done value in the Properties section)

### Timezone

- Default timezone: `system` or a specific IANA name (e.g., `America/New_York`)
- Timezone property: per-note override via frontmatter

## Properties Settings

Tell Prisma Calendar which frontmatter keys you use.

- Start property (required): default `Start`
- End property (optional): default `End`
- All-day property (optional): default `AllDay`
- Date property (optional): default `Date`
- Title property (optional): default to file name when missing
- Timezone property (optional): default `Timezone`
- ZettelID property (optional): when set, a timestamp-based ID is generated on creation/cloning (see [ZettelID Naming System](./features/zettelid-naming) for details)
- Status property: frontmatter property name for event status (default: `STATUS`), used when automatically marking past events as done
- Done value: value to set in the status property when marking an event as done (default: `Done`)
- Category property: frontmatter property name for event categories (default: `Category`), used for grouping in statistics views. Supports **multiple comma-separated categories** (e.g., `Category: Work, Learning`) — events are counted under each category separately in statistics.
- Break property: frontmatter property name for break time in minutes (default: `Break`), subtracted from duration in statistics

### Recurring (node-based)

- RRule property: e.g., `daily`, `weekly`, `bi-weekly`, `monthly`, `bi-monthly`, `yearly`
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

**For timed events:**
- The `Start` and `End` properties contain the full datetime (e.g., `2025-02-15T09:00:00`)
- The `Date` property is an empty string

**Benefits:**
- **Easy conversion**: Change an all-day event to timed by adding values to `Start`/`End` and clearing `Date`
- **Consistent structure**: All events have the same property structure, making templates and scripts easier to write
- **No missing properties**: You can always reference `Date`, `Start`, or `End` without checking if they exist

**Example - All-day event:**
```yaml
---
Title: Holiday
Date: 2025-12-25
Start:
End:
AllDay: true
---
```

**Example - Timed event:**
```yaml
---
Title: Meeting
Date:
Start: 2025-02-15T09:00:00
End: 2025-02-15T10:30:00
AllDay: false
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

- Default view: set initial calendar view
- Hide weekends: toggle Saturday/Sunday visibility
- Enable event preview: hover previews inside the calendar
- Show current time indicator: time line in day/week views
- First day of week: choose locale preference
- Day start / end hour: visible time range in grids
- Slot duration (minutes): grid slot height
- Snap duration (minutes): drag/resize snapping interval
- Zoom levels (minutes): comma-separated list for CTRL+scroll zoom (e.g., `1, 5, 10, 15, 30`)
- Display density: `comfortable` or `compact`
- Past event contrast: visual contrast of past events (0% = invisible, 100% = normal)

### Event Overlap

- Allow event overlap: whether events can visually overlap in all views (default: enabled)
- Allow slot event overlap: whether events can overlap within the same time slot in time grid views (default: enabled)
- Event stack limit: maximum events to stack before showing "+ more" link (1-10, default: 3)

## Rules Settings

### Event Colors

- Default event color: fallback color when no rule matches
- Color rules: evaluated top-to-bottom; first match wins

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

## Frontmatter Display

Show extra frontmatter properties inside event chips (scrollable when space is tight).

- Display properties: comma-separated list (e.g., `status, priority, project, tags`)

Rendered example inside a chip:

```
Meeting with Team
status: In Progress
priority: High
project: Q4 Planning
```

## Event Presets

Save reusable event templates with pre-filled values for quick event creation.

### Creating Presets

1. Open the Create or Edit Event modal
2. Fill in the fields you want to save (title, dates, categories, recurring settings, custom properties)
3. Click "Save as preset" button
4. Enter a name for the preset (e.g., "Weekly Team Meeting")
5. Choose to create a new preset or override an existing one

### Using Presets

- **Apply preset**: Select from the dropdown in the modal header to populate all fields
- **Clear button**: Reset all fields to empty state if the preset doesn't match your needs
- **Default preset**: Configure a default preset in General Settings that auto-applies when creating new events

### What Presets Save

| Field | Saved | Notes |
|-------|-------|-------|
| Title | ✅ | Pre-fill event name |
| All-day | ✅ | Timed vs all-day mode |
| Date/Start/End | ✅ | Date and time values |
| Categories | ✅ | Category assignment |
| Recurring settings | ✅ | RRule type, weekdays, future count |
| Custom properties | ✅ | Any additional frontmatter |

### Example Use Cases

- **"Gym Session"**: Title + 1 hour duration + "Health" category
- **"Weekly Standup"**: Title + recurring weekly on Mon/Wed/Fri + custom properties
- **"Client Meeting"**: Title + all-day + custom properties for project tracking

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

## Recurring Instances (Generation Horizon)

- Future instances count: how many future notes to pre-generate (1–52)
- Beyond that, events appear as read-only virtual items to keep your vault light
