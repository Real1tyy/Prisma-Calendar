# Changelog

All notable changes to this project will be documented here.

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
