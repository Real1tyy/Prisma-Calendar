# Configuration

This page maps directly to the in-app settings. Most changes apply instantly.

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

### Timezone

- Default timezone: `system` or a specific IANA name (e.g., `America/New_York`)
- Timezone property: per-note override via frontmatter

## Properties Settings

Tell Prisma Calendar which frontmatter keys you use.

- Start property (required): default `Start`
- End property (optional): default `End`
- All-day property (optional): default `AllDay`
- Title property (optional): default to file name when missing
- Timezone property (optional): default `Timezone`
- ZettelID property (optional): when set, a timestamp-based ID is generated on creation/cloning

### Recurring (node-based)

- RRule property: e.g., `daily`, `weekly`, `bi-weekly`, `monthly`, `bi-monthly`, `yearly`
- RRule specification property: weekdays for weekly/bi-weekly (e.g., `monday, wednesday, friday`)
- RRule ID property: unique identifier for recurrence

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

## Rules Settings

### Event Colors

- Default event color: fallback color when no rule matches
- Color rules: evaluated top-to-bottom; first match wins

Examples:

```text
fm.Priority === 'High'         → red
fm.Status === 'Done'           → #22c55e
fm.Project === 'Work'          → hsl(210, 70%, 50%)
fm.Type === 'Meeting'          → #f59e0b
```

Tips:
- Use `fm` to reference frontmatter keys
- Colors support CSS names, hex, or HSL

### Event Filtering

All expressions must evaluate to true; events failing any filter are excluded.

```text
fm.Status !== 'Inbox'
fm.Priority === 'High'
fm.Status === 'Done' || fm.Status === 'In Progress'
!fm._Archived
Array.isArray(fm.Project) && fm.Project.length > 0
```

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

## Recurring Instances (Generation Horizon)

- Future instances count: how many future notes to pre-generate (1–52)
- Beyond that, events appear as read-only virtual items to keep your vault light
