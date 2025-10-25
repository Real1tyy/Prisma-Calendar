# Changelog

All notable changes to this project will be documented here.

## 1.4.0

### New Features

#### Filtering & Search System
- **Search Bar**: New search input in the calendar toolbar to filter events by title. Search updates in real-time as you type, with debouncing for smooth performance.
- **Expression Filter**: Advanced property-based filtering using JavaScript expressions (e.g., `Status === 'Done' || Priority === 'High'`). Supports all frontmatter properties and complex boolean logic.
- **Filter Presets**: Save frequently-used filter expressions as named presets in settings. Access them instantly via a dropdown selector in the calendar toolbar. Includes "Clear" option to reset filters.
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
