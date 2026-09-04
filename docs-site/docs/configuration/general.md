# General Settings

## Calendar Directory

- **Directory**: folder to scan for events and create new notes in
- **Index subdirectories**: when enabled (default), events stored at any depth under the configured folder are indexed — for example, `courses/CS101/assignments/HW1.md` appears on the calendar. Disable to restrict indexing to direct children of the folder only.
- **Template path**: optional Templater template used when creating events
- **Locale**: language and date format for calendar headings, day names, month names, toolbar labels, and date displays. Defaults to English. Supports ~20 languages including French, German, Spanish, Italian, Portuguese, Japanese, Korean, Chinese, Russian, Arabic, and more.
- **Show ribbon icon**: display calendar icon in the left sidebar to open calendar (enabled by default)
- **Enable keyboard navigation**: enable arrow key navigation for calendar intervals. Automatically disabled when search or expression filter inputs are focused (enabled by default)
- **Auto-assign Zettel ID**: automatically add a Zettel ID timestamp (`-YYYYMMDDHHmmss`) to filenames of events in the calendar directory that don't have one. Three modes: **Disabled** (default), **Calendar events only** (timed and all-day events), or **All events** (including untracked). When active, files are renamed as they are indexed — for example, `My Event.md` becomes `My Event-20260216120000.md`.
- **Device role**: choose Writer or Reader behavior for automatic file modifications (see [Device Role](#device-role) below)

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

## Check for Updates

Prisma Calendar can quietly check GitHub once a day for newer releases. When a newer version is available, an **Update available** pill appears in the settings header next to the current version — click it to open the release notes on GitHub and grab the update from inside Obsidian.

**Behavior:**
- The check runs at most once every 24 hours per device, started shortly after Obsidian finishes loading the plugin.
- Only the GitHub Releases API for `Real1tyy/Prisma-Calendar` is contacted — a single anonymous HTTPS request. No telemetry, no identifying headers, no per-vault data.
- The last-check timestamp is stored in browser `localStorage`, so it does not roam between devices.
- Drafts, prereleases, and equal-or-older releases are ignored. The badge only appears when the remote version is strictly newer than the one you are running.

**Toggle:**
- Settings → General → "Check for updates" — enabled by default.
- Turning it off skips the check entirely. The badge disappears immediately. Re-enabling triggers a fresh check on the next plugin load.

## Device Role

**Reader mode** prevents the plugin from automatically writing to files without user interaction.

**Storage Location:**
- The device role is stored in the browser's local storage, outside the vault
- It never syncs through Obsidian Sync, git, or another file-sync tool
- An unresolved role behaves as Reader, prompts again next startup, and shows a warning here

**Access:**
- Select **Settings → General → Device role → Configure device role** to reopen the same Writer/Reader chooser used during onboarding

**When Reader is selected**, the device performs none of Prisma's automatic writes:
- No recurring event instances are generated, and no duplicate instance or synced note is trashed
- Past events are not marked as done
- Notifications still appear, but the "Already Notified" property is not written
- **Sort Date** and **Calendar Title** are not normalised
- ZettelIDs are not auto-assigned
- CalDAV accounts and ICS subscriptions do not sync
- Series changes are not propagated
- The time tracker does not save its progress into the event

**When Writer is selected:**
- All automatic file modifications work normally

**Manual actions still work:**
- Propagating frontmatter from the context menu (user-triggered)
- Creating, editing, or deleting events through the UI
- Any other user-initiated file operations

**Use cases:**
- Nominating one writing device in a synced vault — every other device read-only — so external calendars are synced, ids assigned and instances generated in one place. See [Multiple devices and sync](../features/advanced/multi-device-sync#limiting-writes-to-one-device)
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

The same **Import settings** flow is available in first-launch setup. A successful import completes the directory/property step, then Prisma asks whether the device is a Writer or Reader before indexing begins.

## Help & Support

The **Help & support** section at the bottom of the General tab provides quick links to documentation, FAQ, troubleshooting, and GitHub issues.

### Help Center

Click **Open help center** to open an in-app modal — no need to leave Obsidian. It has three tabs:

- **FAQ** — this documentation's [FAQ](../faq.md) page, embedded and rendered in place.
- **Troubleshooting** — the [Troubleshooting](../troubleshooting.md) page, embedded the same way.
- **Get help** — one-click buttons to open the documentation, file a GitHub issue, or send feedback.

The FAQ and troubleshooting tabs render the **actual documentation pages, bundled into the plugin at build time** — so what you read in-app is always the current docs, never a stale copy. The same expandable sections you see on the docs site work inside the modal.

### Changelog viewer

Click **View changelog** to open the full changelog as a scrollable modal. Entries load in batches — click **Load more** to see older versions. The same modal appears automatically after each plugin update showing only the new changes.

## Rate & Review

Click **Review** to rate Prisma from inside Obsidian. Pick half a star to five stars in half-star steps, optionally add a few words, and hit **Submit** — the rating goes straight to me and shapes what gets built next.

**What gets sent:** your star rating, your written note if you left one, the plugin version, your Obsidian version, your platform (macOS, Windows, Linux, iOS, Android), and a random id stored in this vault so duplicate submissions can be collapsed. If this vault has an entered license key and a verified Pro entitlement, a default-on checkbox lets you include the key so the review can be linked to your Pro account; uncheck it to keep the key on your device. The checkbox is not shown and no key is sent otherwise. Nothing else is sent: no note or calendar content, vault name, name, or email.

If the submission cannot reach the server, the modal keeps your rating and note so you can select **Try again**.
