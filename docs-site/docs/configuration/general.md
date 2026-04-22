# General Settings

## Calendar Directory

- **Directory**: folder to scan for events and create new notes in
- **Index subdirectories**: when enabled (default), events stored at any depth under the configured folder are indexed — for example, `courses/CS101/assignments/HW1.md` appears on the calendar. Disable to restrict indexing to direct children of the folder only.
- **Template path**: optional Templater template used when creating events
- **Locale**: language and date format for calendar headings, day names, month names, toolbar labels, and date displays. Defaults to English. Supports ~20 languages including French, German, Spanish, Italian, Portuguese, Japanese, Korean, Chinese, Russian, Arabic, and more.
- **Show ribbon icon**: display calendar icon in the left sidebar to open calendar (enabled by default)
- **Enable keyboard navigation**: enable arrow key navigation for calendar intervals. Automatically disabled when search or expression filter inputs are focused (enabled by default)
- **Auto-assign Zettel ID**: automatically add a Zettel ID timestamp (`-YYYYMMDDHHmmss`) to filenames of events in the calendar directory that don't have one. Three modes: **Disabled** (default), **Calendar events only** (timed and all-day events), or **All events** (including untracked). When active, files are renamed as they are indexed — for example, `My Event.md` becomes `My Event-20260216120000.md`.
- **Read-only mode**: prevent automatic file modifications (see [Read-only Mode](#read-only-mode) below)

## License

Enter your Pro license key to activate advanced features.

- **License key**: enter your key in **Obsidian Secrets → License key** (inside General settings) and click **Verify now** to activate. Pro features unlock immediately — no restart required.

Once verified, the license section shows:

- **License status** — whether your license is active
- **Device activations** — how many of your allowed devices are active (e.g., 2/5)
- **Offline expiry** — how long the license remains valid without an internet connection (7 days from last verification)
- **Verify now** button — manually refresh your license status at any time
- **Manage Subscription** button — open your account page to manage billing, update payment, or cancel. If you don't have an active subscription, the button shows **Subscribe** and links to the Prisma Calendar product page instead.

See [Free vs Pro](../features/free-vs-pro.md) for details on what Pro includes and how to get a license.

## Parsing

- **Default duration (minutes)**: default event duration when only start time is provided (default: 60 minutes, range: 1–240)
- **Show duration field in event modal**: display a duration in minutes field in the event creation/edit modal for quick editing. Changes to duration automatically update the end date, and vice versa (enabled by default)
- **Mark past events as done**: automatically mark past events as done by updating their status property. Runs on startup and periodically every 5 minutes while enabled, so events that end while Obsidian is open are marked promptly (configure the status property and done value in the [Properties](./properties) section)
- **Title autocomplete**: show inline type-ahead suggestions when typing event titles in the create/edit modal. Suggests categories, event presets, and frequently used event names (enabled by default). See [Title Autocomplete](../features/events/title-autocomplete.md) for details.

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

## Settings Transfer

At the bottom of the General tab, the **Settings transfer** row provides three buttons:

- **Export** opens a modal pre-filled with your plugin settings as JSON. Only fields you changed from defaults are included. **Download** saves a `prisma-calendar-settings.json` file; **Copy to clipboard** is also available. You can edit the JSON before downloading.
- **Import** opens a modal where you can upload a previously exported JSON file or paste one directly. Clicking **Import** replaces all transferable settings at once. Anything missing from the payload is reset to its default — import is a full state restore, not a patch.
- **Reset to defaults** asks for confirmation and then restores every transferable setting to its default value. Use it as a quick "start over" when you've experimented yourself into a corner.

The **license key secret name** is local to each vault and is never exported, overwritten on import, or cleared on reset. The exported JSON has no version field: forward- and backward-compatibility is handled by a type-coercing merge on import plus the plugin's own schema fallbacks.
