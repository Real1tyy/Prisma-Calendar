# General Settings

## Calendar Directory

- **Directory**: folder to scan for events and create new notes in (supports nested folders)
- **Template path**: optional Templater template used when creating events
- **Locale**: language and date format for calendar headings, day names, month names, toolbar labels, and date displays. Defaults to English. Supports ~20 languages including French, German, Spanish, Italian, Portuguese, Japanese, Korean, Chinese, Russian, Arabic, and more.
- **Show ribbon icon**: display calendar icon in the left sidebar to open calendar (enabled by default)
- **Enable keyboard navigation**: enable arrow key navigation for calendar intervals. Automatically disabled when search or expression filter inputs are focused (enabled by default)
- **Auto-assign Zettel ID**: automatically add a Zettel ID timestamp (`-YYYYMMDDHHmmss`) to filenames of events in the calendar directory that don't have one. Three modes: **Disabled** (default), **Calendar events only** (timed and all-day events), or **All events** (including untracked). When active, files are renamed as they are indexed — for example, `My Event.md` becomes `My Event-20260216120000.md`.
- **Read-only mode**: prevent automatic file modifications (see [Read-only Mode](#read-only-mode) below)

## Parsing

- **Default duration (minutes)**: default event duration when only start time is provided (default: 60 minutes, range: 1–240)
- **Show duration field in event modal**: display a duration in minutes field in the event creation/edit modal for quick editing. Changes to duration automatically update the end date, and vice versa (enabled by default)
- **Mark past events as done**: automatically mark past events as done during startup by updating their status property (configure the status property and done value in the [Properties](./properties) section)
- **Detect event name typos**: show a "Did you mean?" modal when an event name is close to a known category, preset name, or existing event series. Uses fuzzy matching to detect likely typos (enabled by default). See [Categories - Typo Detection](../features/organization/categories#event-name-typo-detection) for details.

## Time Tracker

- **Show time tracker in event modal**: display a stopwatch in the event creation/edit modal for precise time tracking. Start fills the start date, stop fills the end date, and break time is tracked automatically (enabled by default)
- **Show 'continue' button**: display a continue button that resumes time tracking from the existing start date. The timer calculates elapsed time based on the event's start time and continues from there, perfect for resuming work on existing events (disabled by default)

## Statistics

- **Show decimal hours**: display durations as decimal hours (e.g., 2.5h) instead of formatted (e.g., 2h 30m) in statistics modals. Can be temporarily toggled by clicking the duration in the statistics header (disabled by default)
- **Default grouping mode**: default grouping mode for statistics modals — group by **Event Name** or by **Category** (default: Event Name)

## Read-only Mode

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

## Event Presets

- **Default preset**: select a preset to auto-fill when creating new events (optional)

Save reusable event templates with pre-filled values for quick event creation. Create presets from the Create/Edit Event modal, apply them from the modal header dropdown, and optionally set a default preset that auto-fills new events.

Presets save title, dates, categories, location, icon, participants, recurring settings, and custom properties.

See [Event Presets](../features/events/event-presets) for full documentation on creating, using, and managing presets.

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
