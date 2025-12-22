# Changelog

All notable changes to this project will be documented here.

## 1.18.1

### Bug Fixes

- **Fixed Color Rules Not Applying Correctly**: Fixed an issue where color rules would sometimes fail to apply to events, causing them to display with incorrect or default colors. Color evaluation now works consistently across all calendar views.

---

## 1.18.0

### New Features

- **Mark as Not Done in Batch Selection**: Added a new "Mark as Not Done" button in batch selection mode that allows you to mark multiple selected events as not done at once. This complements the existing "Mark as Done" functionality and uses the status property and not done value configured in Settings → Properties. The operation is fully undoable.

- **Highlight Events With Category**: Added a new command that opens a modal to select a category and temporarily highlights all events assigned to that category. The modal displays all available categories from your events in a dropdown, and events are highlighted for 10 seconds. This complements the existing "Highlight events without categories" command, making it easy to visually identify events by category across your calendar.

- **Configurable Default Statistics Grouping**: Added a new setting "Default statistics grouping" in Settings → Parsing that allows you to configure whether statistics modals start grouped by event name or by category. The default is "Event Name", but you can change it to "Category" if you prefer to see category-based statistics by default. You can still toggle between modes within each statistics modal using the "Group by" button.

- **Categories Settings**: Added a new "Categories" section in Settings that provides a convenient interface for managing category colors. The section displays all categories automatically detected from your events, shows the event count for each category, and allows you to configure colors for each category with a color picker. Behind the scenes, category colors are managed as color rules using expressions like `Category.includes('Work')`. The section also includes a pie chart visualization showing the distribution of events across categories with percentages. Categories are read-only (automatically detected from event usage) and sorted by event count. This makes it easy to visually organize and understand your category usage at a glance.

  📖 See [Color Rules Documentation](/features/color-rules#category-color-management) and [Configuration Settings](/configuration#categories-settings) for detailed information.

### Improvements

- **Optimized Default Batch Action Buttons**: To reduce toolbar clutter and keep the batch selection toolbar on a single row, the following buttons are now disabled by default: "Move By", "Open All", "Move Prev", and "Clone Prev". All batch action buttons remain fully configurable in Settings → Calendar → Batch Selection, so you can enable any combination of buttons to match your workflow. Enabling all buttons would cause the toolbar to span two rows, so we've optimized the defaults to show the most commonly used actions while keeping the interface compact. **Note:** All batch operations available via buttons can also be performed using Obsidian commands, which can be assigned custom hotkeys for even faster access. See the [Hotkeys documentation](/features/hotkeys) for details.

### Bug Fixes

- **Fixed Event Presets Not Preserving Date/Time Values**: Fixed an issue where applying an event preset would incorrectly override the start and end date/time values in the form. Event presets now correctly preserve your existing date/time values and only apply template settings (title, categories, recurring settings, etc.). This ensures that presets work as intended - as reusable templates that don't lock you into specific dates or times.

---

## 1.17.0

### New Features

- **Enhanced Stopwatch with Mid Timers**: Improved time tracking with additional timer displays:
  - **Mid Session Timer**: Shows the current session time (time since last start/resume) when the stopwatch is running. Displays in `HH:MM:SS` format at the bottom of the stopwatch component.
  - **Mid Break Timer**: Shows the current break duration (time since break started) when the stopwatch is paused. Displays in `HH:MM:SS` format at the bottom of the stopwatch component.
  - **Unified Break Time Format**: Both "Total Break" and "Current Break" timers now display in `HH:MM:SS` format (previously "Total Break" used `MM:SS` format) for consistency.
  - **Improved Layout**: Mid timers are now displayed at the bottom of the stopwatch component, below the control buttons, with a visual separator for better organization.

- **Enhanced Frontmatter Propagation for Recurring Events**: Completely redesigned frontmatter propagation system with advanced diff detection, debouncing, and user control:
  - **Automatic Propagation Mode**: Automatically propagate frontmatter changes from source recurring events to all physical instances without confirmation. Enabled via Settings → Calendar → Recurring Events → "Propagate frontmatter to instances".
  - **Ask Before Propagating Mode**: Show a confirmation modal before propagating changes, allowing you to review all accumulated changes before applying them. Enabled via Settings → Calendar → Recurring Events → "Ask before propagating".
  - **Intelligent Diff Detection**: The system now detects three types of changes:
    - **Added**: New properties added to the source event
    - **Modified**: Existing properties changed in the source event
    - **Deleted**: Properties removed from the source event
  - **Accumulated Changes**: Multiple rapid changes within the debounce window are automatically accumulated and merged together, so you see all changes in a single propagation operation.
  - **Configurable Debounce Delay**: Control how long the system waits before propagating changes (Settings → Calendar → Recurring Events → "Propagation debounce delay"). Range: 100ms to 10,000ms (default: 3000ms). Lower values propagate faster but may trigger more operations; higher values accumulate more changes before propagating.
  - **Excluded Properties**: Specify additional frontmatter properties to exclude from propagation (Settings → Calendar → Recurring Events → "Excluded properties"). Enter a comma-separated list of property names. These properties, along with all Prisma-managed properties (time, date, RRule, etc.), will never be propagated to instances.
  - **Change Preview Modal**: When using "Ask before propagating" mode, a modal shows all accumulated changes (added, modified, deleted properties) with their old and new values, allowing you to review before confirming.

  📖 See [Recurring Events Documentation](/features/recurring-dsl#propagation-modes) and [Configuration Settings](/configuration#frontmatter-propagation) for detailed information.

## 1.16.0

### New Features

- **Mark as Undone**: Added the ability to mark completed events as "not done" through the context menu. When you right-click on an event that has already been marked as done, you'll now see a "Mark as undone" option instead of "Mark as done". The value used for marking events as undone can be customized in Settings → Properties → "Not done value" (defaults to "Not Done"). This feature works alongside the existing "Mark as done" functionality and is fully undoable.

- **Skip Notifications for Newly Created Events**: Added a new setting "Skip newly created events" (enabled by default) that automatically marks events as notified if they were created within the last minute. This prevents unwanted notifications when creating events via Create Event modal, Stopwatch, or other creation methods. The feature uses the ZettelID timestamp embedded in the filename to detect newly created events. Can be toggled in Settings → Notifications → General.

### Bug Fixes

- **Fixed Expression Filter with Missing Properties**: Fixed expression filters failing when events don't have properties referenced in the filter. Now handles missing properties intelligently: equality checks (`===`) return `false` when the property is missing, while inequality checks (`!==`) return `true`. For example, `Category === 'Reading'` now correctly filters out events without a `Category` property, and `Category !== 'Work'` correctly includes them.

---

## 1.15.1

### Bug Fixes

- **Fixed Events Disappearing on Last Day of Week**: Fixed a timezone conversion bug where events after a certain time (e.g., 3 PM) on the last day of the week would disappear from weekly, daily, and list views. Events now display correctly on the last day of the week regardless of timezone.

---

## 1.15.0

### New Features

- **Mark Events as Done**: Added support for manually marking events as done using the status property configured in settings. This feature is available in multiple places:
  - **Event Edit Modal**: A "Mark as done" checkbox allows you to mark events as done when editing them
  - **Event Context Menu**: Right-click on any event and select "Mark as done" to quickly mark it as complete
  - **Batch Operations**: Select multiple events in batch selection mode and use the "Mark Done" button to mark them all as done at once
  - **Undoable Command**: All mark as done operations are undoable through the standard undo/redo system
  - This complements the existing "Mark past events as done" setting which automatically marks past events as done on startup

- **Frontmatter Propagation for Recurring Events**: Changes to non-Prisma frontmatter properties in source recurring events now automatically propagate to all physical instances. When you update custom properties (like Category, Priority, Status, or any user-defined fields) in a recurring event source, all existing physical instances are updated immediately. Time-related and system-managed properties (Start, End, RRule, etc.) are never propagated to preserve instance-specific timing. This feature is enabled by default and can be toggled in Settings → Calendar → Recurring Events → "Propagate frontmatter to instances".

### Improvements

- **Customizable Batch Action Buttons**: Added a new setting in Settings → Calendar → Batch Selection to customize which action buttons appear in the batch selection mode toolbar. You can now enable or disable individual buttons (Select All, Clear, Duplicate, Move By, Mark as Done, Clone Next, Clone Prev, Move Next, Move Prev, Open All, Skip, Delete) to streamline your batch operations workflow. The Counter and Exit buttons are always shown. All buttons are enabled by default.
- **Sticky Calendar Header**: The calendar header (navigation buttons, filters, and view controls) now stays visible when scrolling down the calendar, making it easier to navigate and filter events without scrolling back to the top.
- **Configurable Drag Edge Scroll Delay**: Added a new setting "Drag edge scroll delay" in Settings → Calendar → User Interface to control the delay (in milliseconds) before the calendar scrolls when dragging events near the edge. The default is 600ms, and it can be adjusted from 50ms to 2000ms in 50ms increments. Lower values make the calendar scroll more quickly when dragging events to the edge, while higher values require holding the event at the edge longer before scrolling occurs.

### Bug Fixes

- **Fixed Batch Selection for Timed Events in Monthly View**: Timed events (dot events) in monthly view can now be properly selected in batch selection mode. The selection checkbox is now visible.

---

## 1.14.2

### Bug Fixes

- **Fixed Stopwatch Break Time Accumulation**: The stopwatch in the event modal now correctly adds break time to any existing break value instead of overriding it. Previously, if an event had 10 minutes of break time and you took a 5-minute break using the stopwatch, it would override the value to 5 minutes instead of accumulating to 15 minutes.

---

## 1.14.1

### Bug Fixes

- **Fixed Generate Past Events Logic**: Corrected the "Generate Past Events" feature to work as intended. The system now properly generates future instances from today (as normal) and additionally backfills all missing past instances from the source event date when the feature is enabled. Previously, it incorrectly shifted all generation to start from the past, which didn't match the expected behavior of maintaining both historical records and future planning.

---

## 1.14.0

### New Features

- **Thicker Hour Lines**: Added a new setting "Thicker hour lines" in Settings → Calendar → User Interface to make full-hour lines (12:00, 13:00, 14:00, etc.) thicker in day and week views for better visual contrast and easier time identification. This setting is enabled by default and helps distinguish major time divisions from minor slot intervals.
- **ICS Import Progress Modal**: When importing ICS files, a progress modal now displays the import status in real-time, showing the number of events being processed and the current event being imported. This prevents users from accidentally triggering multiple imports and provides clear feedback on the import progress. The modal automatically closes when the import completes and shows a summary of imported, skipped, and failed events.
- **Create Event Command**: Added a new "Create new event" command that opens the event creation modal when a calendar view is focused. This command can be triggered via keyboard shortcuts, allowing quick event creation without clicking on the calendar. The event is created at the current time rounded to the nearest hour with the default duration from settings.
- **Generate Past Recurring Events**: Added a new frontmatter property "Generate Past Events" (configurable in Settings → Properties) that allows recurring events to generate instances from the source event's start date instead of from today. When enabled on a recurring event, physical instances are created starting from the source event date onwards, making it possible to track historical recurring events.

### Improvements

- **Recurring Event Type Display**: The "View Recurring Events" modal now displays the recurrence pattern (Daily, Weekly, Bi-weekly, Monthly, Bi-monthly, Yearly) at the top of the modal. For weekly and bi-weekly events, it also shows which days of the week the event occurs on (e.g., "Recurrence: Weekly • Days: Monday, Wednesday, Friday"), making it easier to understand the recurring event pattern at a glance.

---

## 1.13.0

### New Features

- **Open File in New Window**: Added "Open file in new window" option to the event context menu (right-click). This opens the event file in a detached popout window, making it easier to edit complex properties like checkboxes and list properties directly in the markdown editor without leaving the calendar view.

### Bug Fixes

- **Fixed Double Timestamps on Manual Events**: Events created manually with Prisma's ZettelID format (`-YYYYMMDDHHmmss`) no longer get double-timestamped when cloned or moved. The calendar now detects existing Prisma ZettelIDs and preserves them instead of adding a new one, preventing filenames like `Meeting-20250106120000-20250112153045.md`.

---

## 1.12.0

### Improvements

- **Separate Display Properties for All-Day Events**: Added a new setting "Display properties (all-day events)" in Settings → Properties → Frontmatter display, allowing you to configure different frontmatter properties to display for all-day events versus timed events. The existing "Display properties (timed events)" setting now explicitly applies only to timed events. Both settings work independently, giving you full control over which properties appear in each event type.

### Bug Fixes

- **Fixed All-Day Event Drag Offset**: Fixed an issue where all-day events appeared offset from the cursor (approximately 10 pixels below) when dragging, making the drag operation feel misaligned. The event box now follows the cursor correctly for both all-day and timed events.
- **Fixed Highlight Upcoming Event**: The upcoming event highlight now correctly ignores all-day events and only highlights all currently active timed events. Previously, it would highlight all events including all-day events, but now it prioritizes timed events and ignores all-day events completely.

---

## 1.11.0

### New Features

- **Edge Scrolling During Drag**: When dragging events, moving the cursor to the left or right edge of the calendar automatically navigates to the previous or next week, allowing easy cross-week event movement. Works in week and day views with a 500ms throttle to prevent excessive scrolling.
- **Highlight Events Without Categories**: New command "Highlight events without categories" temporarily highlights all events missing category assignments for 10 seconds, making it easy to identify which events need category assignment.
- **Keyboard Navigation**: Use left/right arrow keys to navigate calendar intervals, with automatic disabling when filter inputs are focused and a configurable toggle in Settings → General.

### Improvements

- **Improved Overlapping Event Appearance**: Overlapping events now look much better—the date/time and title are both clearly readable even when events are stacked or space is tight. The event header layout has been redesigned so the date always appears first, followed by the title, both wrapping inline as needed to fully utilize available space and prevent important details from being cut off.
- Color indicator dots now appear inline with the day number on the same row, preventing layout shifts and ensuring the day number always remains visible.
- **Confirmation Modal for Deleting Physical Events**: When disabling a recurring event or deleting a source recurring event that has physical instances, a confirmation modal now appears asking whether to delete all associated physical events. This helps clean up history by removing past and present physical instances when disabling or deleting recurring events.
- **CalDAV Integration Deletion Confirmation**: When removing a calendar from a CalDAV account or deleting a CalDAV account, a confirmation modal appears if there are associated synced events. You can choose to delete both the account/calendar and all associated events, or just remove the account/calendar while keeping the events in your vault.
- **Fixed Undo/Redo for Renamed Events**: File renames that occur when moving physical recurring events are now properly tracked in the undo/redo system. Undoing a move operation now correctly restores both the event date and the original filename.
- **Fixed Past Event Contrast for All-Day Events**: All-day events on the current day are no longer dimmed by the past event contrast setting. Only all-day events from previous days are affected by the contrast setting, while timed events continue to use time-based comparison.
- **Always Include Date and Time Properties**: Both date and time properties are now always present in event frontmatter, regardless of whether the event is all-day or timed. This makes it easy to convert between all-day and timed events by manually editing the frontmatter. For all-day events, the date property contains the date while start/end properties are empty strings. For timed events, start/end properties contain the full datetime while the date property is an empty string.
- **Consistent Frontmatter Display**: Frontmatter properties are now displayed for all-day events in weekly and daily views, matching the behavior of timed events. Properties remain hidden in the monthly view to save space.

### Bug Fixes

- **Fixed Preset Synchronization**: Event presets are now properly synchronized between the event modal and settings. Presets created or deleted in the modal immediately appear in settings, and presets deleted in settings are automatically removed from the modal dropdown.

---

## 1.10.0

### New Features

#### CalDAV Integration

:::danger SECURITY WARNING
**CalDAV credentials are stored in PLAINTEXT in your vault's `data.json` file.**

- ⚠️ **NEVER use your main account password**
- ✅ **ALWAYS use app-specific passwords** (iCloud, Google, Fastmail all support them)
- 🔒 See [Security Considerations](https://real1tyy.github.io/Prisma-Calendar/features/integrations#security-considerations) for detailed information

Anyone with access to your vault can read your credentials. Use with caution.
:::

- **Read-Only Calendar Sync**: Connect to external CalDAV servers (Fastmail, Nextcloud, iCloud, etc.) to automatically import events into your Obsidian calendar
- **Account Management**: Add multiple CalDAV accounts with separate configurations. Each account can sync multiple calendars to different Prisma calendars
- **Calendar Selection**: Browse and select which calendars to sync from each account. Support for syncing multiple remote calendars to a single Prisma calendar
- **Intelligent Sync System**:
  - **Auto-sync**: Configurable sync intervals (1-1440 minutes, default: 15 minutes)
  - **Sync on startup**: Automatically sync when Obsidian starts
  - **Manual sync**: "Sync now" button in settings for on-demand synchronization
  - **Incremental sync**: Uses ETags for efficient updates - only changed events are processed
  - **Conflict detection**: Tracks event modifications using lastModified timestamps
- **Event Management**:
  - **Create notes automatically**: Synced events are created as Obsidian notes in the calendar's folder
  - **Update detection**: Changed events are automatically updated in your vault
  - **Title change handling**: File is automatically renamed when event title changes on the server while preserving Zettel ID
  - **Zettel ID integration**: CalDAV events get Zettel IDs (format: `Event Name - YYYYMMDDHHmmss`) for conflict-free filenames
  - **Metadata tracking**: Sync state stored in frontmatter (accountId, calendarHref, objectHref, etag, uid, lastModified, lastSyncedAt)
- **Timezone Handling**: Configure timezone per CalDAV account to ensure correct time conversion between server events and your local calendar
- **Visual Integration**:
  - **Integration event color**: Set a custom color for all CalDAV-synced events (default: purple `#8b5cf6`)
- **Notification Control**: "Show sync notifications" toggle to display/hide sync status messages (enabled by default)
- **Use Cases**:
  - Sync work calendar from corporate CalDAV server to track alongside personal Obsidian tasks
  - Import external meeting schedules without manual ICS import/export
  - Keep Obsidian calendar in sync with family/shared calendars
  - Maintain single source of truth for events across multiple calendar applications
  - Automatically create notes for external events for journaling and note-taking

#### Fill Time from Adjacent Events
- **Context Menu Options**: Two new options in the event context menu for timed events:
  - **Fill end time from next event**: Sets the current event's end time to match the start time of the next chronological event
  - **Fill start time from previous event**: Sets the current event's start time to match the end time of the previous chronological event
- **Event Modal Buttons**: Fill buttons added next to "Now" buttons in the event modal:
  - **"Fill prev"** button for start time input
  - **"Fill next"** button for end time input
- **Undo/Redo Support**: Fill operations in the context menu are fully integrated with the undo/redo system (Ctrl+Z / Ctrl+Shift+Z)
- **Use Cases**:
  - Quickly schedule back-to-back meetings without gaps
  - Fill calendar gaps by connecting event times
  - Plan consecutive tasks efficiently
  - Ensure accurate time tracking by eliminating overlaps

---

## 1.9.0

### New Features

#### Daily Statistics View
- **New Daily Stats Command**: "Show daily statistics" command displays event statistics for a single day
- **Smart Date Selection**: When opening daily stats, automatically shows today if it's within the current calendar view interval, otherwise shows the first day of that interval
- **Fast Navigation on All Stats Modals**: All statistics modals (daily, weekly, monthly) now include fast navigation buttons:
  - **Daily**: `«`/`»` jumps ±10 days, `‹`/`›` jumps ±1 day
  - **Weekly**: `«`/`»` jumps ±4 weeks, `‹`/`›` jumps ±1 week
  - **Monthly**: `«`/`»` jumps ±1 year, `‹`/`›` jumps ±1 month
- **Keyboard Shortcuts**: `Shift+←` and `Shift+→` for fast navigation in all stats modals
- **Full Feature Parity**: Daily stats supports all existing features - group by name/category, include skipped events toggle, break time subtraction, and decimal hours display

#### Mobile Responsiveness Improvements
- **Calendar View on Mobile**:
  - **Configurable Event Limit**: New setting "Mobile events per day" controls how many events show before "+more" link (default: 4, range: 0-10)
  - **Title-Only Events**: Monthly view shows only event title (no time) for cleaner display
  - **Compact Weekly View**: Weekly events show title, time, and compact frontmatter properties (7px font)
  - **Larger Daily View**: Daily view uses larger fonts (13px title, 11px time, 10px properties) since more space is available
  - **All-Day Events**: All-day events in daily view also use larger fonts for consistency
  - **No Event Gaps**: Monthly view events fit tightly with no unnecessary min-height gaps
  - **Title Word-Break**: Long event titles wrap properly instead of being cut off
  - **Responsive Toolbar**: Calendar toolbar buttons wrap intelligently on narrow screens with compact sizing
  - **Touch-Friendly Controls**: Filter inputs and preset selectors adapt to full-width on mobile

- **Calendar View Improvements (Desktop & Mobile)**:
  - **Configurable Color Dots**: New setting "Show color dots" to toggle color indicator dots in monthly view (default: enabled)
  - **Clean Recurring Titles**: Instance dates removed from recurring event titles to save space
  - **Color Indicator Dots**: Each day cell displays colored dots representing unique event colors at a glance
  - **Clean Event Dots**: Removed FullCalendar's default event dots for cleaner appearance
  - **"+more" Popover**: Shows event time alongside title for better context

- **Statistics Modals on Mobile**:
  - **Compact Modal Width**: Statistics modal fits properly on mobile screens
  - **Optimized Header Layout**: Header controls condensed into 2 rows instead of 6, using CSS Grid for efficient space usage
  - **Larger Pie Chart**: Chart takes full advantage of available width with legend positioned below
  - **Readable Table**: Larger font size (13px) with optimized column widths (40% name, 20% each for count/duration/percentage)
  - **Compact Controls**: Navigation buttons, toggles, and pagination all sized appropriately for touch

- **Notification Modal on Mobile**:
  - **Responsive Layout**: Modal width constrained for proper mobile display
  - **Inline Action Buttons**: "Open event", "Snooze", and "Dismiss" buttons displayed in a row for easier access
  - **Compact Spacing**: Reduced padding and font sizes while maintaining readability

- **Event Modal on Mobile**:
  - **Full-Width Inputs**: Form inputs and preset selectors expand to full width
  - **Wrapped Controls**: Header controls wrap gracefully on narrow screens

---

## 1.8.0

### New Features

#### ICS Calendar Export & Import
- **Export to ICS**: New command "Export calendar as .ics" exports all calendar events to a standard `.ics` file
- **Import from ICS**: New command "Import .ics file" imports events from external calendar applications
- **Calendar Selection**: Choose which calendar to export from or import to
- **Timezone Selection**: Select target timezone for export - events stored in UTC are converted to your chosen timezone
- **Skip Filtering**: Option to exclude skipped events from exports (enabled by default)
- **Notification Export**: VALARM reminders included based on "Minutes Before" / "Days Before" settings
- **Universal Compatibility**: Generated ICS files work with Google Calendar, Apple Calendar, Outlook, Nextcloud, and any other iCalendar-compatible application
- **Event Preview**: Preview imported events before confirming the import
- **Full Event Support**: Both export and import handle timed events and all-day events correctly
- **Automatic Note Creation**: Imported events are created as new Obsidian notes with proper frontmatter
- **Description Handling**: Export includes note content as description; Import preserves event descriptions in note body
- **Categories Support**: Event categories are exported and imported correctly
- **Custom Metadata**: Exported ICS includes `X-PRISMA-FILE`, `X-PRISMA-VAULT`, and Obsidian URI for linking back
- **Use Cases**:
  - Share your Obsidian calendar with colleagues using different calendar apps
  - Import schedules from Google Calendar, Apple Calendar, or Outlook
  - Migrate events from other calendar applications to Prisma Calendar
  - Create backups of your calendar events in a universal format
  - Sync events between external calendar services and Obsidian

### Bug Fixes

#### Notification System
- **Skip Notifications for Skipped Events**: Notifications are no longer triggered for events marked as skipped, ensuring you only receive alerts for active events.

#### Time Tracker Auto-Save
- **Background Timer Tracking**: When the stopwatch is running and you close the event modal (via ESC, clicking outside, or Cancel button), the timer state is automatically saved and continues tracking in the background. This allows you to close the modal naturally without losing your tracked time or needing to explicitly click the minimize button.
- **Preserved State**: All form data, elapsed time, break time, and stopwatch state are preserved when auto-saved and can be restored later using the "Restore minimized event modal" command.

---

## 1.7.0

### New Features

#### Event Presets with Title Support
- **Save Event Templates**: Create reusable presets that save all form values including title, dates, categories, recurring settings, and custom properties
- **Title Field in Presets**: Presets now store and apply the event title, perfect for recurring task types like "Go to Gym" or "Weekly Meeting"
- **Quick Apply**: Select a preset from the dropdown in the Create/Edit Event modal header to instantly populate all fields
- **Default Preset**: Configure a default preset that auto-applies when opening the Create Event modal
- **Override Existing**: Update existing presets with current form values or create new ones
- **Use Cases**:
  - Create a "Gym Session" preset with title, duration, and category pre-filled
  - Save a "Client Meeting" template with custom properties and recurring settings
  - Standardize event creation across your team with shared preset configurations

#### Clear Button in Event Modal
- **Quick Reset**: New "Clear" button in the event modal header that resets all form fields to empty state
- **Full Form Reset**: Clears title, dates, all-day checkbox, recurring settings, categories, and all custom properties
- **Preset Reset**: Also resets the preset selector back to "None"
- **Use Cases**:
  - Start fresh after applying a preset that doesn't match your needs
  - Quickly clear a complex form without manually emptying each field
  - Reset the modal when creating multiple different events

#### Break Time Property for Statistics
- **Break Time Tracking**: New `Break` property to subtract break time from event duration in statistics
- **Accurate Time Tracking**: Track actual productive time by excluding lunch breaks, coffee breaks, etc.
- **Decimal Support**: Enter break time in minutes with decimal precision (e.g., `30` for 30 minutes, `45.5` for 45.5 minutes)
- **Statistics Integration**: Break time is automatically subtracted from event duration when calculating weekly/monthly/all-time statistics
- **Per-Event Configuration**: Set break time for individual events directly in the Create/Edit Event modal
- **Property Name**: Configurable via settings (default: `Break`)
- **Example Usage**:
  ```yaml
  ---
  Title: Work Session
  Start Date: 2025-01-15T09:00
  End Date: 2025-01-15T17:00
  Break: 60  # 1 hour lunch break
  ---
  ```
  This 8-hour event will show as 7 hours in statistics (8h - 1h break)

#### Unified Recurring Events Modal
- **View All Recurring Events**: New "Show recurring events" command that displays all your recurring events in one place
- **Type Filter Dropdown**: Filter recurring events by recurrence type (Daily, Weekly, Bi-weekly, Monthly, Bi-monthly, Yearly) or show all types at once
- **Colored Type Badges**: Each recurring event displays a vibrant, color-coded badge indicating its recurrence type for quick visual identification:
  - 🔵 **Daily** - Blue badge
  - 🟢 **Weekly** - Green badge
  - 🟣 **Bi-weekly** - Purple badge
  - 🟠 **Monthly** - Orange badge
  - 🩷 **Bi-monthly** - Pink badge
  - 🩵 **Yearly** - Teal badge
- **Toggle Between Enabled/Disabled**: Checkbox to switch between viewing enabled recurring events (default) or disabled ones. Search filter is preserved when toggling.
- **Quick Enable/Disable**: Primary action button dynamically changes:
  - When viewing enabled events: "Disable" button to quickly disable recurring events
  - When viewing disabled events: "Enable" button to re-enable them
- **Navigate to Source**: "Navigate" button that jumps to the source recurring event in the calendar (week view), highlighting it for easy identification
- **Search and Filter**: Search through recurring events by title, just like other event list modals.
- **Smart Button Display**: Calendar toolbar button shows count of enabled recurring events and is only visible when enabled recurring events exist
- **Replaces Old Modal**: The "Show disabled recurring events" command has been removed in favor of this more comprehensive modal
- **Use Cases**:
  - Get an overview of all your recurring events
  - Filter by recurrence frequency to find specific event types
  - Quickly identify event patterns with color-coded type badges
  - Quickly enable or disable recurring events without opening files
  - Navigate to source recurring events for editing or context
  - Manage recurring events from a single interface

#### Navigate to Source Event Instead of Opening File
- **Go to Source Navigation**: The "Go to Source" button for physical and virtual recurring events now navigates to the source event in the calendar instead of opening the file
- **Week View Navigation**: Automatically switches to week view and centers the calendar on the source event's date
- **Event Highlighting**: The source event is highlighted for 5 seconds after navigation for easy identification
- **Improved Workflow**: Better for quickly jumping between recurring event instances and their source without leaving the calendar view

#### Category Autocomplete in Event Modal
- **Category Input Field**: New category input field in the Create/Edit Event modal, located right above the custom properties section
- **Multiple Categories Support**: Enter multiple categories separated by commas (e.g., "Work, Meeting, Important"). Single categories are stored as strings, multiple as arrays.
- **Searchable Category Dropdown**: Click "+ Add" to open a searchable dropdown with all existing categories. Type to filter through categories, press Enter to select the first match, or click any category to add it.
- **Smart Category Tracking**: Categories are automatically collected from all indexed events during startup, building a comprehensive set of existing categories
- **Mixed Input Support**: Type new categories directly or select from existing ones - perfect for maintaining consistent category naming across events
- **Use Cases**:
  - Quickly categorize events with consistent naming
  - Assign multiple categories to a single event for flexible filtering
  - Discover existing categories you've used before
  - Reduce typos by selecting from predefined options
  - Build a coherent category taxonomy over time

#### Multi-Category Statistics Support
- **Comma-Separated Categories**: Events with multiple comma-separated categories (e.g., `Category: Work, Learning`) are now counted under EACH category separately in statistics
- **Accurate Time Tracking**: If an event belongs to "Work" and "Learning", its full duration is counted toward both categories
- **Flexible Categorization**: Assign multiple categories to events and see accurate breakdowns for each category
- **Example**:
  ```yaml
  ---
  Title: Team Workshop
  Start Date: 2025-02-15T09:00
  End Date: 2025-02-15T12:00
  Category: Work, Learning, Team Building
  ---
  ```
  This 3-hour event contributes 3 hours to each of: Work, Learning, and Team Building categories in statistics

#### Clickable Duration Display in Statistics
- **Toggle Duration Format**: The duration display in all statistics modals (Weekly, Monthly, All-Time) is now clickable, allowing you to toggle between formatted duration (e.g., "3d 8h 45m") and decimal hours (e.g., "80.8h")
- **Visual Feedback**: Button has hover effects and smooth transitions to indicate it's interactive
- **Persistent Toggle**: The format preference persists while navigating between different time periods
- **Use Cases**:
  - Quick conversion for time tracking reports that require hours
  - Easier calculation of billable hours or project time
  - Compare durations more easily in decimal format
  - Switch back to human-readable format for quick understanding

#### Refresh Calendar Command
- **Manual Resync**: New "Refresh calendar" command available in the command palette to manually trigger a full resync of the indexer and refresh all calendar events
- **Use Cases**:
  - Force refresh when you suspect events are out of sync
  - Immediately update calendar after bulk file operations outside Obsidian
  - Refresh after modifying event files through external scripts or sync tools
- **How to Use**: Open command palette (Ctrl/Cmd+P) and search for "Refresh calendar" to trigger a full resync
- **Automatic Refresh**: Calendar automatically refreshes once indexing completes, showing a loading indicator during the resync process

#### "Now" Button in Event Modal
- **Quick Time Setting**: Added a "Now" button next to the Start Date and End Date inputs in the Create/Edit Event modal
- **Minute Precision**: Clicking "Now" sets the datetime field to the current moment with minute-level precision (not just rounded to the hour)
- **Location**: Button appears between the datetime input field and the right edge of the modal

#### Time Tracker / Stopwatch in Event Modal
- **Precise Time Tracking**: New stopwatch feature in the Create/Edit Event modal for tracking work sessions with precision
- **Start Button**: Click "start" to begin tracking - automatically fills the Start Date field with the current time
- **Break Tracking**: Click "break" to start tracking break time. The stopwatch continues running, but time is counted towards the break value instead of work time
- **Resume Button**: Click "resume" to end the break and continue tracking work time
- **Stop Button**: Click "stop" to finish tracking - automatically fills the End Date field with the current time and calculates total break time
- **Break Time Integration**: Break time is automatically calculated and saved to the Break property in minutes (with decimal precision)
- **Start New**: After stopping, click "start new" to reset and begin tracking a new session
- **Minimize Modal**: Click the "−" button in the modal header to save the modal state and close it. Works for any modal state, not just when stopwatch is active.
- **Restore Minimized Modal**: Use the command "Restore minimized event modal" (Ctrl/Cmd+P) to reopen the modal with all form data, stopwatch state, and file path preserved
- **Collapsible UI**: The time tracker can be collapsed/expanded by clicking the "Time tracker" header
- **Display**: Shows elapsed time (HH:MM:SS) and break time (MM:SS) in real-time
- **Timed Events Only**: Stopwatch is only shown for timed events (hidden for all-day events)
- **Configurable**: Toggle the time tracker on/off in Settings → General → Parsing → "Show time tracker in event modal" (enabled by default)
- **Use Cases**:
  - Track work sessions with precise start/end times
  - Account for lunch breaks, coffee breaks, or interruptions during work
  - Create events with accurate duration for time tracking
  - Pomodoro-style work sessions with break tracking
  - Minimize the modal to continue working in Obsidian while tracking time in the background

#### Preview Button in Context Menu
- **Quick Event Preview**: New "Preview" button in the event context menu (right-click) that triggers Obsidian's hover preview for the event note
- **Same as Ctrl+Hover**: Provides the same preview functionality as holding Ctrl while hovering over an event, but accessible via right-click menu
- **Use Cases**:
  - Preview event details without holding modifier keys
  - Quick access to note preview on touchscreen or trackpad devices
  - More accessible alternative to keyboard-based hover preview

#### Duplicate Recurring Instance
- **Duplicate Without Affecting Future Generation**: New "Duplicate recurring instance" option in the context menu for physical recurring events
- **Ignore Recurring Property**: Duplicated events get an `Ignore Recurring` property set to `true`, excluding them from future instance count calculations
- **Preserved Tracking**: Duplicated events retain their `RRuleID`, `Source`, and `Recurring Instance Date` properties, allowing them to be tracked as part of the recurring series
- **Property Name**: Configurable via settings (default: `Ignore Recurring`)
- **Use Cases**:
  - Create a one-off variation of a recurring event without disrupting the regular schedule
  - Archive past recurring events while keeping them linked to their source
- ⚠️ **Important**: The `Ignore Recurring` property is automatically managed by the system. Always use the "Duplicate recurring instance" context menu option.

#### Smart Recurring Event Renaming on Drop
- **Automatic Filename Update**: When you drag and drop a physical recurring event to a new date, the filename is automatically updated to reflect the new date
- **Smart Instance Date Handling**:
  - **Normal physical instances**: Only the filename is updated; `Recurring Instance Date` stays the same to preserve the original scheduled date
  - **Duplicated/ignored instances** (`Ignore Recurring: true`): Both the filename AND `Recurring Instance Date` are updated to the new date
- **Format Preserved**: Filename format remains consistent: `Title YYYY-MM-DD-ZettelID.md`
- **Configurable Property**: The instance date property name (`Recurring Instance Date` by default) can be customized in Settings → Properties

### Improvements
- **Calendar Integration**: Context menu actions now provide better integration with calendar navigation, allowing you to stay in calendar view when working with recurring events.

## 1.6.0

### Bug Fixes
- **Fixed scroll jumping during event edits**: Prevented race conditions in event refresh logic that caused the calendar to jump to highlighted events when editing/moving events in different parts of the view.
- **Fixed input field focus loss**: Search and expression filter input fields now maintain focus when clicked, allowing users to type in them without the focus being immediately stolen by the calendar container.

### New Features

#### Flexible Snooze Duration in Notifications
- **Customizable Snooze Time**: The notification modal now features an editable snooze duration input that's prefilled with your default snooze minutes setting but can be adjusted on-the-fly.
- **Quick Adjustments**: Change the snooze duration to any value (1-1440 minutes) directly in the notification modal without visiting settings.
- **Use Case**: Need 45 minutes instead of your default 15? Just change the number before hitting snooze—perfect for adapting to different situations without changing your default preference.

#### Selected Events Modal in Batch Mode
- **Interactive Selection Counter**: The batch selection counter button (showing "X selected") is now clickable and opens a modal displaying all currently selected events
- **Event Management**:
  - View all selected events with their titles and time information
  - Search and filter through selected events
  - **Unselect** individual events directly from the modal
  - **Open** event files in Obsidian with one click
- **Use Case**: Quickly review and manage your batch selection before performing bulk operations, or selectively remove events from the selection without manually clicking through the calendar

#### Per-Event Future Instances Count Override
- **Flexible Recurring Event Control**: Configure the number of future instances to generate on a per-event basis
  - **UI Configuration**: Edit the "Future instances count" field directly in the event edit modal when creating or editing recurring events
  - **Manual Configuration**: Add the `Future Instances Count` property to any recurring event's frontmatter
  - **Dynamic Updates**: Changing the count for existing events and reloading Obsidian automatically generates additional instances as needed
- **Overrides Global Setting**: If not specified, uses the global "Future instances count" setting. When specified, overrides the default for that specific recurring event.
- **Configurable Property Name**: Customize the property name in Settings → Properties → "Future instances count property" (defaults to "Future Instances Count").
- **Use Cases**:
  - Generate more instances for critical recurring events (e.g., 10 instances for weekly standup meetings)
  - Generate fewer instances for infrequent events (e.g., 1 instance for yearly reviews)
  - Minimize vault clutter by customizing instance generation per event type

#### Duration Field in Event Modal
- **Quick Duration Editing**: New optional duration in minutes field in the event creation/edit modal for rapid event timing adjustments. Enabled by default.
- **Bidirectional Sync**: Changes to duration automatically update the end date (keeping start date fixed). Changes to start or end dates automatically update the displayed duration.
- **Configurable**: Toggle the duration field on/off in Settings → General → Parsing → "Show duration field in event modal".
- **Use Case**: Instead of clicking through the date picker to change an event's end time, simply type the desired duration in minutes for instant adjustment.

#### Enhanced Statistics System
- **Category-Based Aggregation**: Toggle between two aggregation modes in all statistics views (weekly, monthly, and all-time):
  - **Event Name Mode** (default): Groups events by their cleaned title names (strips IDs and timestamps)
  - **Category Mode**: Groups events by their frontmatter category property value. Events without a category are grouped under "No Category"
  - Single toggle button displays current mode and cycles between modes on click
  - Configurable category property name in Settings → Properties
- **Monthly Statistics**: New statistics modal for analyzing entire calendar months. Navigate between months with previous/next arrows and "Today" button to return to the current month. Access via command palette (`Show monthly statistics`) or custom hotkey.
- **All-Time Statistics**: View lifetime statistics across all events in your vault. No navigation controls—shows cumulative totals for your entire event history. Perfect for annual reviews and long-term pattern identification. Access via command palette (`Show all-time statistics`) or custom hotkey.

#### Statistics UI/UX Improvements
- **Compact Header Layout**: Moved the aggregation mode toggle from a dedicated top section to inline with the navigation controls (next to the "Today" button), saving significant vertical space and creating better visual hierarchy
- **Skip Events Filtering**: Added "Include skipped events" checkbox in all stats modals (Weekly, Monthly, All-Time). Skipped events are now excluded by default, providing more accurate insights into actual time usage. Toggle on to include skipped events when needed for comprehensive reporting.
- **Enhanced Pagination System**:
  - **First/Last Navigation**: Added "⟪ First" and "Last ⟫" buttons for quick jumps to the beginning or end of large tables
  - **Direct Page Input**: The page indicator is now an editable input field—type any page number and press Enter to jump directly to that page
- **Visual Refinements**:
  - Replaced the "Breakdown" header with an elegant gradient divider line that fades at the edges
  - Fixed the "Distribution" chart header to be perfectly centered, unaffected by the "Hide Chart" button position
  - Minimized unnecessary gaps between sections for a more compact, efficient layout
- **Consistent Experience**: All three statistics modals (Weekly, Monthly, and All-Time) now share the same controls, pagination system, and visual styling

#### Command Additions
- **`Show monthly statistics`**: Open monthly statistics modal for the current month
- **`Show all-time statistics`**: Open all-time statistics modal showing lifetime totals

## 1.5.0

### New Features

#### Weekly Statistics
- **Time Tracking Visualization**: New weekly statistics modal that shows how you spend your time across different event categories. View a pie chart and detailed breakdown table for any week.
- **Smart Event Grouping**:
  - Recurring events are automatically grouped together under "Recurring Events"
  - Non-recurring events are grouped by name (automatically strips Zettel IDs and timestamps)
  - Example: "Gym 20250203140530" and "Gym 20250205140530" are grouped as "Gym"
- **Timed Events Only**: Statistics focus on timed events only (all-day events are excluded as they don't have meaningful durations for time tracking)
- **Week Navigation**: Easy navigation between weeks with previous/next week arrows
- **Visual Insights**:
  - Pie chart showing duration distribution with color-coded categories
  - Sortable statistics table showing event count, total duration, and percentage for each category
  - Interactive tooltips with detailed information
- **Access via Command**: Open weekly statistics for the current week via command palette (`Show weekly statistics`)

#### Global Event Search
- **Search All Events**: New global search modal that searches across all events in the current calendar. Access via command palette or hotkey.
- **Quick Filtering**: Three cycle-filter buttons for recurring, all-day, and skipped events. Each button cycles through: show all → only this type → skip this type.
- **Event Details**: See event type (timed/all-day/recurring), date/time ranges, and recurring indicators at a glance.
- **Quick Actions**: Open event files or navigate the calendar to the event's week directly from search results.

## 1.4.0

### New Features

#### Event Notifications System
- **Smart Notifications**: Comprehensive notification system that alerts you before events start. Notifications are enabled by default and work seamlessly with your vault indexing.
- **System Notifications**: Desktop notifications appear at the configured time with event details and quick actions.
- **Notification Modal**: Rich modal interface showing event details, properties, and action buttons when a notification triggers.
- **Flexible Configuration**:
  - **Timed Events**: Configure default notification time in minutes before event start (e.g., 15 minutes before). Override per event with custom frontmatter properties.
  - **All-Day Events**: Separate configuration for all-day events using days before notification (e.g., 1 day before). Override per event as needed.
  - **Per-Event Overrides**: Each event can specify its own notification timing via frontmatter properties, overriding calendar defaults.
- **Snooze Functionality**: Snooze button on timed event notifications (not available for all-day events). Configurable snooze duration (default: 15 minutes). Smart calculation ensures snoozed notifications appear exactly X minutes from now, even for events that have already started.
- **Notification Sound**: Optional system sound when notifications appear (configurable in settings).
- **Already Notified Tracking**: Automatic tracking prevents duplicate notifications. Reset manually by changing the frontmatter property.

#### Visual Enhancements
- **Highlight Upcoming Events**: New setting (enabled by default) that highlights current or upcoming events with higher contrast. Automatically highlights all currently active events, or if none are active, highlights the closest upcoming event for better visibility.

#### Filtering & Search System
- **Search Bar**: New search input in the calendar toolbar to filter events by title. Search updates in real-time as you type, with debouncing for smooth performance.
- **Expression Filter**: Advanced property-based filtering using JavaScript expressions (e.g., `Status === 'Done' || Priority === 'High'`). Supports all frontmatter properties and complex boolean logic.
- **Filter Presets**: Save frequently-used filter expressions as named presets in settings. Access them instantly via a dropdown selector in the calendar toolbar. Includes "Clear" option to reset filters.
- **Filtered Event List Modal**: New modal showing all events currently hidden by active search and filter expressions. Helps you understand what's being filtered out and provides quick access to filtered events.
- **Search in List Modals**: Search functionality added to Disabled Recurring Events and Skipped Events list modals. Find specific events by name quickly.
- **Filter Commands**: New hotkey-bindable commands:
  - `Focus search`: Jump to the search input
  - `Focus expression filter`: Jump to the expression filter input
  - `Open filter preset selector`: Open the filter presets dropdown

#### Navigation & Commands
- **Open Current Note in Calendar**: New command that opens the calendar view and navigates to the date of the currently active note. Automatically detects which calendar the note belongs to, opens the calendar in week view, and highlights the event for 5 seconds.

#### Recurring Events Improvements
- **Enhanced Generation Logic**: Improved recurring event instance generation with better edge case handling and duplicate prevention. Instances are now created more reliably and consistently.
- **Disable Recurring Events**: Temporarily pause recurring events to stop generating new instances while keeping existing ones. Right-click any recurring event (source, physical instance, or virtual preview) and select "Disable recurring event" to pause the series. Re-enable anytime with "Enable recurring event".
- **Disabled Recurring Events Counter**: New button in the calendar header shows how many recurring events are currently disabled. Click to open a modal listing all disabled events with quick "Enable" and "Open" actions.
- **Context Menu on Virtual Events**: Right-click on virtual (preview) recurring event instances to access the full context menu with disable, navigation, and other management options.

### Bug Fixes
- **Prevent Source Events from Auto-completion**: Source recurring events are no longer automatically marked as done, even when "mark past events as done" is enabled. Only actual event instances are affected.
- **Duplicate Instance Prevention**: Fixed edge cases where recurring event instances could be created multiple times for the same date.
- **RRule ID Synchronization**: Improved synchronization of recurring event IDs between source files and generated instances.

## 1.3.0

### New Features
- **Move By Command**: New hotkey command to move selected events by a custom number of days. Allows precise event repositioning with positive or negative day offsets.
- **Auto-mark Past Events**: Automatically mark past events as done during startup. Configure the status property and done value in settings. Runs asynchronously without blocking the main thread.

## 1.2.0

### Recurring Events Enhancements
- **Interlinked Recurring Events**: Recurring event instances are now properly interlinked, allowing seamless navigation between occurrences.
- **Source Navigation**: Right-click on any recurring event instance to quickly navigate to the source note that defines the recurrence rule.
- **View All Recurring Events**: New context menu option to view all instances of a recurring event series in a dedicated modal.

## 1.1.0
- Initial release of Prisma Calendar
