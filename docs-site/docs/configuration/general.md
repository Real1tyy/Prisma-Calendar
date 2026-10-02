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

Prisma Calendar can quietly check GitHub once a day for newer releases. When a newer version is available, an **Update available** pill appears in the settings header next to the current version — click it to open that version on the [changelog](../changelog.md) page, with its notes and release video, then grab the update from inside Obsidian.

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

## Logging

Prisma keeps a structured log of its own work — indexing, date parsing, recurring instances, CalDAV/ICS sync, settings migrations, license checks — in memory while Obsidian runs. The **Logging** section controls how much is kept and where else it goes. The defaults cost nothing: nothing is written to disk, and only warnings and errors reach the developer console.

- **Minimum level**: the lowest level kept in the in-app log — **Debug**, **Info** (default), **Warnings**, or **Errors only**. Lower it to Debug while reproducing a problem, then raise it back; Debug is chatty.
- **Mirror to developer console**: also print entries to Obsidian's developer console (`Ctrl/Cmd+Shift+I`). Enabled by default.
- **Console level**: the lowest level mirrored to the console (default: Warnings), independent of the minimum level above.
- **Write log files**: write entries as one JSON object per line into `.obsidian/plugins/prisma-calendar/logs/` inside your vault, so they survive a restart and can be attached to a bug report. Off by default — the files can contain note paths and property values, and if your sync tool syncs the `.obsidian` folder they travel with it.
- **Show advanced options** reveals the file limits:
  - **Rotate after (KB)**: when the current file grows past this size (default 512 KB) it is renamed to a dated file and a fresh current file starts.
  - **Keep rotated files**: how many dated files to keep (default 5). The oldest are deleted automatically.
  - **Delete rotated files after (days)**: dated files older than this (default 30 days; up to 365 days) are deleted automatically, even when under the count limit.

Changes take effect immediately — no reload. Rotation and cleanup run when a file rotates and each time the plugin loads; the current file is never deleted by cleanup. If the log file cannot be written (a read-only vault, for example), file logging switches itself off and records why in the in-app log.

### Log file names

Every log file is named after the device that wrote it, so the folder looks like this:

```
current-a1b2c3d4.jsonl              ← the file this device is writing now
20260610-120000-123-a1b2c3d4.jsonl  ← rotated: 2026-06-10, 12:00:00.123 UTC
```

The trailing `a1b2c3d4` is a short random id, generated the first time this device writes a log and stored on the device itself — never in the vault, so it does not travel with your notes and identifies nothing about you or your machine. Each device therefore gets its own id and its own set of files.

That is what keeps file logging safe on a vault whose `.obsidian` folder is synced: two devices with file logging on write to two different files, so the sync tool has nothing to merge and produces no conflict copies. Cleanup is scoped the same way — a device deletes only files it wrote, so the logs your laptop collected are still there when you open the vault on it next week, whatever your desktop has been doing in the meantime.

### Reading the logs

**Open logs** in the Logging section — or the **Prisma Calendar: Open logs** command, which you can bind to a hotkey — opens the Logs view: a developer's view of what Prisma is doing, newest first. It reads the in-memory log of this session, or a log file from an earlier one. The view stays open while you work, so you can reproduce a problem and watch what the plugin does about it.

Each line shows the local time (hover it for the date), a colored severity badge — **DEBUG**, **INFO**, **WARN**, **ERROR** — the scope, and the message. When the entry carries structured data, it follows the message as one line of JSON, cut off where the row runs out of space; the message itself always gets room first. Click a line to open the full record: timestamp, severity, scope, the whole message, and each piece of data as its own key and value. Warnings and errors are tinted so they stand out while you scroll.

New entries appear as they happen. Scroll down to read something and the view holds back whatever arrives in the meantime, counting it in a **N new entries** button; press it (or scroll back up) to catch up.

**Narrowing the table.** The controls above the table combine, so each one you add narrows what is left:

- **Levels** — click **debug**, **info**, **warn** or **error** to keep only those. With none picked, every level shows. Each level keeps its color on the chip and on every line.
- **Scope** — on the same row, the part of the plugin an entry came from (`indexing`, `recurring`, `sync`, …). Only scopes actually present get a chip. Pick one to keep only its entries, or several to keep entries from any of them.
- **Search** — matches the message, the scope and the structured data, so a note name, an error code or a property name all find their entries. Matches are highlighted.
- **From** / **To** — start filled in with the oldest and newest entry's time, in your local clock. Type a narrower time, or drag the two handles of the slider beside them.

The counter reads `247 entries · 12 shown`, so you always know how much the filters are hiding. **Reset filters** clears them all.

**Keyboard.** The search box has focus as soon as the view opens, so you can start typing. `Ctrl/Cmd+F` jumps back to it from anywhere in the view. `Ctrl/Cmd+A` selects every shown line, and pressing it again clears the selection.

**Earlier sessions.** When log files exist on this device, a **Source** dropdown lists them next to the search, newest first. Pick one to read history from before Obsidian was last restarted; **Load older entries** fetches the next page.

**Sending logs to me.** The quickest way is **Report a bug** in the view's header: it opens the bug report with your recent logs and health checks already attached, so you only describe what went wrong. Nothing reaches me until you submit it.

The other header buttons act on the table: **Copy filtered** puts exactly the rows you narrowed to on the clipboard, **Copy selected** takes only the lines you ticked, **Copy all** takes the whole table, **Save to file** writes the shown rows into a `Prisma Logs` folder in your vault as a `.json` file you can attach to a GitHub issue — tick some rows first and it saves only those — and **Clear buffer** empties this session's log. With lines ticked, **Copy selected** and **Clear selection** also sit next to the counter. Each line has its own copy button. Like every Prisma header, the gear button lets you reorder, rename or hide these buttons, and your arrangement is remembered.

**Redacted or full detail.** Every copy and save first asks how the logs should leave the view. The prompt explains what redaction does, with a before-and-after example and a link to the [privacy page](../privacy.md). **Copy redacted** / **Save redacted** turns folder and note names into stable tokens and property values into their type — the safe choice for a public GitHub issue. **With full detail** keeps real paths, note names and property values for someone you trust. Secrets are removed either way, and closing the prompt copies or saves nothing.

## Doctor

**Open Doctor** runs Prisma's diagnostics — a set of health checks over indexing, settings and your license — and is the fastest way to tell whether something is actually wrong. Each check reports **healthy**, a **warning**, or a **problem** with a one-line explanation, and offers a fix button where one applies (a failing or incomplete index offers **Reindex**).

The same page is available from the command palette as **Prisma Calendar: Open doctor**.

Below the checks, a collapsed **Logs** section holds the evidence behind them. Expand it to read the same log as the [Logs view](#reading-the-logs) — same colors, filters, search and keyboard shortcuts — without leaving the Doctor. Expanding it does not re-run the checks.

**Create bug report** carries the findings straight into the report form. **Copy debug** puts a redacted summary of your versions, the health checks, and recent plugin activity on the clipboard instead; **Save debug to file** writes it into your export folder. Nothing is sent anywhere until you submit a report yourself. See [Troubleshooting → Start with the Doctor](../troubleshooting#start-with-the-doctor) for what each check means and [Privacy & diagnostics](../privacy) for what a report contains.

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

Click **View changelog** to read the changelog one version at a time, starting with the newest release. The version sits in the middle of the modal between two arrows: **‹** moves to the newer version and **›** to the older one — or press the **←** and **→** keys. To jump straight to a version, click the version box, type part of its number (`2.1`, say) and pick it from the list, or press **Enter** to take the highlighted match. The **↑** and **↓** buttons at the right of the version bar jump to the top or bottom of a long version.

When a version has a release walkthrough video, a **Release video** heading at the top of that version shows its thumbnail. Click the thumbnail to play it in the modal, or **Watch on YouTube** to open it in your browser. Click the heading to collapse the video; it stays collapsed as you move between versions until you open it again or close the modal. Videos are looked up online as you navigate, so a video published after a release still appears. Offline, versions simply show without one.

The same modal opens automatically after each plugin update. It covers only the versions you haven't seen, and it starts at the oldest of them: if you update from 2.11 to 2.14, it opens on 2.12 and you step forward to 2.13 and 2.14.

### Unreleased changes

Click **View unreleased** (under **View changelog**) to see the features and fixes that have landed and will ship in the next release. It reads the **Unreleased** section of the [online changelog](../changelog.md) each time you open it, so it's always current. If nothing is waiting, it says so. It needs an internet connection; offline, it shows a message with a **Try again** button.

## Rate & Review

Click **Review** to rate Prisma from inside Obsidian. Pick half a star to five stars in half-star steps, optionally add a few words, and hit **Submit** — the rating goes straight to me and shapes what gets built next.

**What gets sent:** your star rating, your written note if you left one, the plugin version, your Obsidian version, your platform (macOS, Windows, Linux, iOS, Android), and a random id stored in this vault so duplicate submissions can be collapsed. If this vault has an entered license key and a verified Pro entitlement, a default-on checkbox lets you include the key so the review can be linked to your Pro account; uncheck it to keep the key on your device. The checkbox is not shown and no key is sent otherwise. Nothing else is sent: no note or calendar content, vault name, name, or email.

If the submission cannot reach the server, the modal keeps your rating and note so you can select **Try again**.
