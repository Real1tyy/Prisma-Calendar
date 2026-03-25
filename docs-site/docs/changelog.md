# Changelog

All notable changes to this project will be documented here.

---

## 2.10.0 - 3/25/2026

### Improved

- **Heatmap cell keyboard navigation**: Click any heatmap cell to select it, then use arrow keys to move between cells. Navigation wraps across columns when reaching grid edges. Click the same cell again to deselect. See [Heatmap](./features/views/heatmap.md).
- **Integration event deletion progress**: Deleting a CalDAV account or ICS subscription with synced events now shows a progress modal with a progress bar, per-file status updates, and a completion summary. See [Integrations](./features/advanced/integrations.md).
- **Sync notification clarity**: Sync notifications now show "Sync complete — Account: 3 created, 1 updated" instead of the ambiguous "Account: 3 created" format. See [Integrations](./features/advanced/integrations.md).
- **CalDAV edit modal shows calendar names**: The calendar selector in the CalDAV edit modal now shows human-readable calendar names instead of raw URLs. See [Integrations](./features/advanced/integrations.md).

- **Locale setting rendered as dropdown**: The locale setting now displays as a dropdown selector instead of a free-text field, making it easier to pick from supported languages. See [Calendar UI](./configuration/calendar-ui.md).
- **Category rename/delete progress modal**: Renaming or deleting a category now shows a progress modal with a progress bar instead of just disabling the button. See [Categories](./features/events/categories.md).
- **Gantt bar label wrapping**: Long event titles in the Gantt view now word-wrap inside the bar instead of overflowing to the right, keeping the layout compact. See [Gantt View](./features/views/gantt.md).

### Fixed
- **Sort Date propagating from source recurring event to all instances**: Sort Date is now excluded from frontmatter propagation and computed individually per instance. See [Recurring Events](./features/events/recurring-events.md).
- **ICS export shifting event times by the local UTC offset**: Exported events were shifted by the user's timezone offset (e.g., 1 hour earlier in UTC+1) because internal ISO strings without a Z suffix were interpreted as local time by `new Date()`. A UTC round-trip (export + import with UTC) now preserves exact times. See [Import & Export](./features/advanced/import-export.md).
- **Filter expressions rejecting events when referenced properties are missing**: Filter expressions like `_Archived !== true` or `Status !== 'Inbox'` incorrectly rejected events that didn't have the referenced property in their frontmatter. Missing properties now evaluate as `undefined` instead of failing, so `_Archived !== true` correctly passes for events without an `_Archived` property. See [Rules & Filters](./features/advanced/rules-filters.md).
- **Highlight upcoming event not updating after changes**: The upcoming event highlight stopped applying after dragging, resizing, or editing events — it only worked on initial load. The highlight now correctly reapplies whenever events are re-rendered. See [Calendar View](./features/calendar/calendar-view.md).
- **Changing "max events per day" breaking event rendering**: Changing the desktop or mobile max events per day setting applied the FullCalendar option but did not trigger a full event refresh, leaving the calendar in a stale state where new events stopped appearing. The setting change now forces a complete re-render. See [Calendar UI](./configuration/calendar-ui.md).
- **Batch frontmatter edit not applying new properties**: Adding a new frontmatter property via batch edit showed a success notice but did not actually write the property. The submit hotkey also discarded all input. Both issues are now fixed. See [Batch Operations](./features/management/batch-operations.md).
- **Timeline all-day events overlapping**: All-day and timed events in the timeline view were rendered as points with no width, causing them to overlap instead of stacking vertically. Events now render as compact 4-hour range blocks with proper start/end times. See [Timeline](./features/views/timeline.md).
- **Timeline event text color ignoring settings**: Timeline events always used the default text color regardless of background color contrast. They now use the same primary/alternative text color logic as the calendar view. See [Timeline](./features/views/timeline.md).

### Removed

- **Duplicate Recurring Instance command and Ignore Recurring property**: The "Duplicate recurring instance" context menu option and the `Ignore Recurring` frontmatter property have been removed. The feature was redundant — users can simply clone the event instead, which creates a standalone copy tracked by name. See [Recurring Events](./features/events/recurring-dsl.md).
- **"Generate past events" skipping today's instance**: When a recurring event had "Generate Past Events" enabled, instances were generated for past days and future days, but today's occurrence was skipped. Today's instance is now correctly included. See [Recurring Events](./features/events/recurring-dsl.md).
- **Preview button shown for virtual events**: The hover preview context menu option was visible on virtual events, which have no backing file to preview. It is now hidden for virtual events. See [Virtual Events](./features/events/virtual-events.md).
- **Changing desktop/mobile events per day broke calendar rendering**: Changing the "Desktop events per day" or "Mobile events per day" setting caused the calendar to stop rendering newly created events until a full plugin reload. The setting now applies immediately and triggers a proper event re-render. See [Calendar View](./features/calendar/calendar-view.md).
- **Max events per day off by one**: Setting "max events per day" to 3 showed only 2 events plus a "+2 more" link instead of 3 events plus "+1 more". The "+more" link was incorrectly counted as one of the event rows. See [Calendar View](./features/calendar/calendar-view.md).
- **Name series and category series propagation not detecting property changes**: Editing frontmatter through Obsidian's Properties view did not trigger propagation to name series or category series members. See [Event Groups](./features/events/event-groups.md).
- **Event groups settings scroll position lost on toggle**: Toggling a mutually exclusive setting (e.g., "Propagate frontmatter to name series") in the Event Groups settings tab caused the page to jump, losing the current scroll position. The scroll position is now preserved across re-renders. See [Event Groups](./features/events/event-groups.md).

---

## 2.9.0 - 3/23/2026

### Added

- **Multi-color event mode**: New "Color mode" dropdown in Settings → Rules → Event colors lets you apply up to four color rule matches per event, splitting the event width into equal segments. Options: Don't color events, Color events (default, single color), or 2/3/4 colors. See [Color Rules](./features/organization/color-rules.md).
- **Overflow color dots**: New "Show overflow color dots" toggle in Settings → Rules → Event colors. When enabled, displays color dots for matched color rules that exceed the color mode limit, so you can see all matching rules at a glance. See [Color Rules](./features/organization/color-rules.md).
- **Trigger current event stopwatch**: New hotkey command that converts the active note into a calendar event with start time set to now, starts the time tracker, and auto-minimizes — all in one action. See [Hotkeys — Trigger Current Event Stopwatch](./features/advanced/hotkeys.md#trigger-current-event-stopwatch).
- **Gantt event colors**: Gantt chart bars now use the same color rules as the calendar view. See [Gantt View](./features/views/gantt.md).

### Improved

- **Participants display**: Participants are now displayed individually with remove buttons instead of a plain comma-separated text field, matching how categories and prerequisites look. Supports both plain names and Obsidian `[[links]]`. See [Participants](./features/events/participants.md).
- **Substring matching now applies to category presets**: The "Substring matching" toggle (Settings → Categories) now also applies to category assignment presets — when enabled, preset event names match as substrings instead of requiring exact matches. See [Categories — Substring Matching](./features/organization/categories.md#substring-matching-for-categories-and-presets).
- **Heatmap day labels**: All seven day-of-week labels (Mon–Sun) now display on the heatmap's left axis, and label alignment has been adjusted to sit centered with their corresponding rows. See [Heatmap](./features/views/heatmap.md).
- **Heatmap first day of week**: Both yearly and monthly heatmap views now correctly respect the "First day of week" setting — previously the day labels and cell positions were offset by one when set to Monday. See [Heatmap](./features/views/heatmap.md).

### Fixed

- **Gantt "No prerequisite connections found" shown incorrectly**: The empty-state message was visible even when prerequisite events existed, due to a CSS specificity issue preventing the message from hiding. See [Gantt View](./features/views/gantt.md).
- **Gantt chart not filling the view height**: The chart only sized to its content instead of filling the available tab area. The Gantt container now fills the full view height. See [Gantt View](./features/views/gantt.md).
- **Gantt chart stacking every event on a separate row**: Independent prerequisite chains were rendered as a single waterfall, wasting vertical space. Events from unrelated chains that don't overlap in time now share rows, producing a compact layout. See [Gantt View](./features/views/gantt.md).
- **Gantt drag-to-pan navigation**: Left-click and drag anywhere on the Gantt chart canvas to pan horizontally and vertically. See [Gantt View](./features/views/gantt.md).
- **Color rules matching categories by substring instead of exact name**: Color rules using `.includes()` (e.g., `Category.includes('Work')`) would incorrectly match categories containing that text as a substring (e.g., "Remote Work Planning"). Category values are now normalized to arrays before evaluation, ensuring exact element matching. See [Color Rules](./features/organization/color-rules.md).
- **Edit modal using stale event data**: Editing an event could silently overwrite correct dates with outdated values if the file had been modified since the calendar last refreshed (e.g., after using "Fill end time from next event"). The edit modal now always reads the latest data from the file.
- **Minimized modal losing date fields on restore and stopwatch trigger**: When restoring a minimized modal or triggering a new stopwatch while one was already running, date/time values were not carried through correctly — the previous event's end time could be lost and the restored modal showed empty Start Date and End Date fields. All form state (dates, duration, "generate past events" checkbox) is now fully preserved across minimize/restore cycles and stopwatch transitions. See [Time Tracker](./features/management/time-tracker.md).
- **Keyboard navigation affecting calendar while on other tabs**: Arrow key navigation continued to move the calendar's date interval even when another tab (e.g., Daily Stats, Dual Daily) was active, causing the calendar to silently drift to an unintended date. Keyboard shortcuts are now disabled when the calendar tab is not visible.
- **Daily Stats and Dual Daily calendars not rendering on tab switch**: Switching to Daily + Stats or Dual Daily tabs sometimes showed empty calendars with no events. The calendars were initialized while their container was still hidden, causing incorrect dimension calculations. Calendars also now automatically resize when their container dimensions change (e.g., opening developer tools).

---

## 2.8.0 - 3/21/2026

### Added

- **Context menu customization**: Right-click any event and select "Manage menu items..." at the bottom of the context menu to fully customize it. Items are grouped by section (Navigation, Edit, Move, Danger, Recurring) — reorder within sections via drag-and-drop or arrow buttons, drag items between sections to reassign them, rename labels, change icons, pick custom colors, and show/hide individual actions. All changes persist across sessions. No more digging through settings — configuration lives right where you use it. Existing show/hide preferences from previous versions are automatically migrated. See [Configuration — Context Menu](./configuration/toolbar-and-menus.md#context-menu).

### Improved

- **Timeline performance**: The timeline now loads events on demand as you pan and zoom, fetching only the visible time range instead of the entire event history. Previously, opening the timeline loaded every event in your vault at once. This applies to both the Timeline tab and series/category timeline modals. See [Timeline](./features/views/timeline.md).
- **Gantt performance**: The Gantt tab now uses an incremental prerequisite tracker that updates in real time as events change, instead of rebuilding the entire dependency graph from scratch on every update. Prerequisite lookups are now instant regardless of vault size. See [Gantt View](./features/views/gantt.md).

### Fixed

- **Timezone conversion bugs**: Fixed a systemic UTC conversion issue that affected the entire plugin — most noticeably "Fill start time from previous event" and "Fill end time from next event" which could write incorrect times or clear values entirely. The same bug also affected event store queries, Gantt chart dates, AI context gathering, AI validation, batch selection, capacity indicators, statistics, timeline, and search. All datetime operations now use local time consistently.
- **AI Manipulation modifying unrelated events**: In Manipulation mode, the AI would modify existing events that weren't mentioned by the user in order to resolve pre-existing overlaps. The no-overlap constraint now only applies to newly created events in Manipulation mode; existing events are only modified when the user explicitly requests it. See [AI Chat — Validation](./features/advanced/ai-chat.md#validation--auto-correction).
- **Prerequisite connection arrows not updating on scroll**: Connection arrows were not reactive to scrolling or zoom changes — they stayed frozen in their initial positions. Arrows now update in real time as you scroll or change zoom levels, and render behind sticky headers (toolbar, day headers, all-day section) so they never obscure fixed UI elements. See [Prerequisite Connections](./features/advanced/prerequisite-connections.md).

---

## 2.7.0 - 3/18/2026

### Added

- **Dashboard Tab** (Pro): A group tab with three subtabs — By Name, By Category, and Recurring — accessible via a dropdown chevron or hover on the tab button. Each subtab uses a resizable 2x2 grid layout: pie chart (top-left), summary stat cards with a Top 10 ranking bar chart (top-right), and a full-width sortable, searchable, paginated table with colored rows (bottom). Subtabs can be reordered, renamed, and hidden via the tab manager. Reactive updates keep the dashboard in sync as events change. See [Dashboard](./features/views/dashboard.md).
- **Group tabs (subtabs)**: Tabs can now contain nested subtabs, shown as a dropdown on the tab button. Click or hover the button to pick a subtab. Group tab children can be reordered, renamed, and hidden independently via the tab manager. See [Tabbed Views](./features/views/tabbed-views.md).
- **Header Actions**: Customizable shortcut buttons in the view header that give one-click access to any calendar command. 19 actions shown by default (event creation, search, statistics, category highlighting, undo/redo, AI chat, and more), with 55+ total actions available. Fully customizable — reorder, rename, change icons and colors, show/hide actions via the gear button. Includes a search bar for quick access to any action by name. State persists per calendar. See [Header Actions](./features/views/header-actions.md).
- **Bases Calendar View** (Pro): Render Prisma Calendar events directly inside any Obsidian Base as a fully interactive calendar. Events matching the Base query are displayed in month, week, or day view with the same styling and interactions as the main calendar — including batch selection, untracked events dropdown, context menus, hover previews, drag-and-drop rescheduling, and category/frontmatter batch editing. Configure which calendar to use, the view type, and an optional initial date from the Bases toolbar options. See [Bases Calendar View](./features/views/bases-calendar-view.md).
- **Prerequisite property**: New "Prerequisite" frontmatter property for declaring chronological dependencies between events. Assign prerequisites via a searchable modal (same pattern as category assignment) — available in the create/edit modal and the right-click context menu. Events are displayed with clean names, colored rows, date/time labels, and lazy-loaded pagination (20 per page). Stored as wiki-links in frontmatter. Configurable property name in Settings → Properties. See [Properties](./configuration/properties.md).
- **Tabbed views**: The calendar view now features a tab bar with five tabs — Calendar (original view), Timeline, Heat Map, Daily + Stats, and Dual Daily. Timeline and Heat Map are now persistent embedded views instead of modal overlays. Daily + Stats shows a daily calendar alongside synced statistics with pie chart. Dual Daily shows two independent daily calendars side-by-side. Toolbar buttons for Timeline and Heatmap now switch to the corresponding tab. Tab state (active tab, visibility, order) persists across sessions. Tabs can be reordered, renamed, and hidden via right-click or the settings gear. See [Tabbed Views](./features/views/tabbed-views.md).
- **Auto-assign category by substring match**: New "Auto-assign when name contains category" toggle in Settings → Categories → Auto-assign categories. When enabled, creating an event named "Youtube Analysis" will auto-assign the "Youtube" category — matching by substring instead of requiring an exact name match. See [Categories — Auto-Assignment](./features/organization/categories.md#1-auto-assignment-event-creation-and-editing).
- **Timeline date navigation**: The timeline view now has a date navigation bar at the top with year, month, and day inputs. Enter a date and press Enter or click Go to center the timeline on that date while keeping the current zoom level. A Today button jumps to the current date. See [Event Groups — Timeline View](./features/events/event-groups.md#timeline-view).
- **Heatmap View** (Pro): A GitHub-style contribution heatmap showing event density over time, available as a tab and from the Event Series Modal footer. The "Show all events heatmap" command navigates to the Heat Map tab. The heatmap is centered in the view for both yearly and monthly modes. Supports arrow-key navigation, a "Now" button to jump to the current period, category-colored gradients, click-to-inspect day details, and hover tooltips. See [Event Groups — Heatmap View](./features/events/event-groups.md#heatmap-view-pro).
- **Programmatic AI API** (Pro): All three AI modes — Query, Manipulate, and Plan — are now callable programmatically via `window.PrismaCalendar.aiQuery()` and the `obsidian://prisma-calendar?call=aiQuery` URL protocol. Send a natural-language message with a mode, and receive a structured JSON response containing the AI's answer (for queries) or parsed operations (for manipulation/planning). Operations can optionally be auto-executed by passing `execute: true`. Uses the same context gathering, validation, and retry logic as the AI Chat sidebar — including pattern detection, semantic validation, and automatic reprompting. Requires an open calendar view for context. See [Programmatic AI API](./features/advanced/programmatic-api/ai.md).
- **Periodic mark-past-as-done scan**: "Mark past events as done" now runs a background scan every 5 minutes in addition to startup, so events that end while Obsidian is open are marked promptly. The scan starts and stops automatically when the setting is toggled. See [Configuration — General](./configuration/general.md).
- **Capacity Tracking**: See at a glance how full your calendar is. A compact indicator in the page header shows today's used vs total hours (e.g., "⏱ 7h 30m / 11h (68%)") — hover to see remaining hours and inferred time boundaries. Capacity labels in the Daily + Stats tab and all statistics modals show used vs total, remaining time, and the inferred boundaries inline (e.g., `7:00–21:00`). Boundaries are inferred automatically from your earliest and latest events — no configuration needed. Enabled by default; toggle in Settings → Capacity Tracking. See [Capacity Tracking](./features/views/capacity-tracking.md).
- **Prerequisite Connection Arrows** (Pro): Toggle SVG arrows on the Calendar tab showing directed connections between prerequisite events. Arrows draw from the prerequisite event to the dependent event; dashed stub arrows appear at the calendar edge when a connected event is outside the current view. Toggled via the "Toggle prerequisite connection arrows" command (bindable hotkey) or the header action button. Arrows update automatically on date navigation and event changes. See [Prerequisite Connections](./features/advanced/prerequisite-connections.md).
- **Gantt Tab** (Pro): A new Gantt tab in the Prisma Calendar view renders all events as horizontal bars on a date timeline with native dependency arrows between prerequisite pairs. Independent navigation with Day/Week/Month/Year view modes. "Connected only" filter shows exclusively events participating in prerequisite relationships. Click any bar to open the event preview. See [Gantt View](./features/views/gantt.md).

### Improved

- **Global Search pagination**: The Global Search modal now renders events in pages of 50, with a "Load more" button for the remaining results. Previously all events were rendered at once, causing lag with large calendars.
- **Timeline performance**: The timeline view now opens zoomed in to a one-week window centered on today, so only nearby events are rendered initially. Previously it opened showing the entire date range (potentially years of data), rendering all events at once and causing significant lag with large calendars. The timeline tab also now fills the available height dynamically. Data updates now reuse the existing timeline instance instead of destroying and recreating it, and multiple rapid data changes are coalesced into a single refresh. See [Event Groups — Timeline View](./features/events/event-groups.md#timeline-view).
- **Global Search performance**: The Global Search modal now loads significantly faster. Event data is fetched once instead of twice on open, color computation is deferred to render time (only computed for visible items), date formatting uses cached formatters, and navigation to an event uses the cached data instead of re-querying the full event store.
- **Statistics pie chart category colors**: Pie charts in Daily + Stats, weekly, monthly, and all-time statistics now use the configured category colors when grouped by category, matching the behavior of the Dashboard tab. Previously, auto-generated colors were used regardless of grouping mode. See [Categories](./features/organization/categories.md).

### Fixed

- **Timeline toolbar button always visible**: The Timeline button in the calendar toolbar was always rendered regardless of toolbar button settings. It now correctly respects the toolbar configuration and is hidden when disabled.
- **Time tracker break input NaN**: Starting or continuing the stopwatch with an empty break field caused `NaN` to propagate into the break input, triggering a browser warning. The break field now defaults to `0` when empty. See [Time Tracker](./features/management/time-tracker.md).
- **Already Notified set when notifications disabled**: Creating or editing past/present events wrote `Already Notified: true` into frontmatter even when notifications were disabled. The property is now only set when notifications are enabled. See [Notifications](./features/management/notifications.md).
- **Zoom button text duplication on monthly view**: Switching to month view caused the zoom button to display garbled duplicated text (e.g. "Zoom: 30minZoom: 30min"). The button text is now always kept in sync regardless of the active view.
- **Physical recurring instance date stripped on save**: Editing a physical recurring instance via the edit modal and saving would strip the instance date from the filename (e.g., `Meeting 2025-02-03-00001125853328.md` → `Meeting-00001125853328.md`), triggering an unwanted rename. The instance date is now correctly preserved across all save paths. See [Recurring Events — Moving Physical Recurring Events](./features/events/recurring-dsl.md#moving-physical-recurring-events).

---

## 2.6.1 - 3/11/2026

### Fixed

- **Integrations tab incorrectly gated behind Pro**: The entire Integrations settings tab was blocked for free users, preventing access to holidays and ICS import/export — both of which are free features. Only CalDAV sync and ICS URL subscriptions are Pro features; the tab is now always accessible with Pro upgrade banners shown only for those two sections. See [Integrations](./features/advanced/integrations.md).

---

## 2.6.0 - 3/7/2026

### Added

- **Free vs Pro tiers**: Prisma Calendar now offers a Pro tier for power users. Free users get the full core experience — 4 views, up to 3 calendars, 2 event presets, recurring events, 50-action undo/redo, batch operations, time tracker, statistics, color rules, filtering, notifications, holidays, ICS import/export, and 30+ hotkeys. Pro unlocks AI chat, CalDAV & ICS URL sync, programmatic API, unlimited calendars & presets, custom category assignment presets, and priority support. Visit the [product page](https://matejvavroproductivity.com/tools/prisma-calendar/?utm_source=docs-site&utm_medium=content&utm_content=changelog-product-page) to start a 30-day free trial. See [Free vs Pro](./features/free-vs-pro.md).
- **License verification**: Enter your Pro license key in Settings → General → Obsidian Secrets → License key to activate advanced features. The license section shows your activation status, device count (e.g., 2/5), and offline expiry date. Licenses are cached locally for 7 days of offline use. A "Verify now" button lets you manually refresh your license status at any time. Device IDs are stored locally and never synced across devices. See [Free vs Pro](./features/free-vs-pro.md).

  **A note on feature gating:** Some features that were previously available for free — the programmatic API, CalDAV & ICS URL sync, auto-assign category presets — are now part of the Pro tier. Calendars are now limited to 3 and event presets to 2 in the free tier. I understand this is a big change, and I don't make it lightly. The free tier still gives you an enormous amount of functionality — 4 calendar views, recurring events with 9+ recurrence types, full undo/redo, 10+ batch operations, time tracker, statistics, color rules, advanced filtering, notifications, holidays, title autocomplete, ICS import/export, and 30+ hotkeys — far more than what most calendar plugins offer. Gating the advanced features is what allows me to sustain full-time development of this plugin: maintaining it, fixing bugs, shipping new features, and providing support. If you prefer the previous model, you can stay on the last version before this release and stop updating — but this is the direction of the project going forward. Purchasing the Pro license directly supports development and gets you priority support alongside the advanced capabilities.
- **Title autocomplete**: Inline type-ahead suggestions when typing event titles in the create/edit modal. Suggestions are drawn from categories, event presets, and frequently used event names — prioritized in that order. Press Tab to accept ghost text or use arrow keys to browse the dropdown. Configurable via Settings > General > Parsing > Title autocomplete (enabled by default). See [Title Autocomplete](./features/events/title-autocomplete.md).
- **Time propagation for recurring instances**: Changing the start or end time of a source recurring event now automatically propagates the new time to all future physical instances that still have the original time. Instances where the time was manually changed are left untouched. Always runs automatically regardless of frontmatter propagation settings. See [Recurring Events — Time Propagation](./features/events/recurring-dsl.md#time-propagation).

- **Locale setting**: Choose a display language for calendar headings, day names, month names, toolbar labels, event date suffixes, and statistics date ranges. Supports ~20 languages including French, German, Spanish, Japanese, and more. Defaults to English. See [General Settings](./configuration/general.md#calendar-directory).
- **Custom recurring intervals**: Define arbitrary recurrence patterns beyond the 9 built-in presets — every 5 days, every 3 weeks, every 4 months, etc. Select "Custom interval..." in the recurrence dropdown or use the `FREQ;INTERVAL=N` format directly in frontmatter (e.g., `DAILY;INTERVAL=5`). ICS imports now map all recurrence rules to the custom interval format. See [Recurring Events — Custom Intervals](./features/events/recurring-dsl.md#custom-intervals).
- **Programmatic API** (Pro): Full scripting API on `window.PrismaCalendar` for automating calendar workflows from Templater, Dataview, QuickAdd, or external plugins. Covers the complete event lifecycle — create, edit, delete, clone, move events; mark done/undone and toggle skip; batch operations (mark done, mark undone, delete, toggle skip) that execute as a single undoable command; query events by date range, file path, or category; read calendar metadata and statistics with time breakdowns by name or category; read and update settings programmatically; and navigate to any date and view. All write operations support full undo/redo. Also accessible via `obsidian://prisma-calendar?call=actionName&param=value` URLs for cross-app automation, browser bookmarks, and iOS Shortcuts. See [Programmatic API](./features/advanced/programmatic-api/overview.md).
- **AI Chat** (Pro): A built-in AI chat panel in the right sidebar with three modes — **Query** (ask data-driven questions about your calendar), **Manipulate** (describe changes in natural language and preview structured create/edit/delete operations before executing), and **Plan** (describe how you want to allocate your time and the AI fills your calendar with non-overlapping events, learning your patterns from previous intervals). Supports Anthropic (Claude) and OpenAI (GPT) models with configurable API keys, model selection, and custom system prompts. Calendar context (events and statistics from your active view) is automatically included, and the AI receives your full category list and presets for accurate naming. Conversations persist across panel closes and restarts with a searchable thread list. AI responses are validated with strict schema and semantic checks — detecting overlaps, missing days, gaps, and boundary violations — with automatic reprompting (up to 2 retries). Planning validation toggles for gap detection and day coverage are configurable in Settings > AI > Planning. See [AI Chat](./features/advanced/ai-chat.md).
- **Day cell coloring**: New dropdown in Visual Appearance with three modes — "Off" (default, no change), "Uniform" (single gradient color on all day cells), or "Month boundary" (alternating even/odd month colors to distinguish month transitions). Color pickers appear based on the selected mode. Changes apply immediately. See [Calendar View](./features/calendar/calendar-view.md#day-cell-coloring).
- **Optional integration event color**: CalDAV and ICS subscription event colors can now be cleared, allowing synced events to use your [color rules](./features/organization/color-rules.md) instead of a forced integration color. See [Integrations](./features/advanced/integrations.md).

### Removed

- **Fuzzy event name typo detection**: The "Detect event name typos" setting and "Did you mean?" modal have been removed. Title autocomplete now serves as the primary mechanism for consistent event naming, making fuzzy matching redundant. The `fuzzyset.js` dependency has been removed. See [Title Autocomplete](./features/events/title-autocomplete.md).

### Changed

- **Time tracker initial end time**: Starting the stopwatch now sets the end time to start + 5 minutes (matching the periodic sync interval) instead of using the configured default duration, since the end time is continuously updated while tracking. See [Time Tracker](./features/management/time-tracker.md).
- **`createUntrackedEvent` API signature**: Now takes a single object `{ title, calendarId? }` instead of two arguments `(title, options?)`, consistent with all other API methods. See [Programmatic API](./features/advanced/programmatic-api/overview.md).

### Fixed

- **Time tracker scheduler not cleaned up**: The background scheduler that periodically saves the end date every 5 minutes while an event is minimized was not stopped when the plugin unloaded or when calendar bundles were refreshed. This caused the interval to keep running with stale references, writing to files even after the modal was closed or the calendar was destroyed. See [Time Tracker](./features/management/time-tracker.md).
- **All-day event rendered twice after drag-to-edge navigation**: Dragging an all-day event to the calendar edge to navigate to a new interval, then dropping it, caused the event to appear twice visually. See [Calendar View](./features/calendar/calendar-view.md).
- **Sticky header detached after resize or navigation**: The toolbar and all-day section could lose their sticky positioning after resizing the panel or navigating between dates, causing them to scroll away with the content. See [Calendar View](./features/calendar/calendar-view.md).
- **Custom icon, location, and participants not propagated to physical recurring events**: The custom icon, location, and participants properties were excluded when creating physical recurring instances from a source event. Physical instances now inherit these properties from the source event. The custom icon also takes priority over the recurring marker as intended. See [Event Icons](./features/events/event-icons.md).
- **New calendar with empty folder indexed entire vault**: Creating a new calendar without setting a folder caused the indexer to treat every note in the vault as belonging to that calendar, assigning calendar titles and processing all files. An empty folder now correctly means "no events" until a specific folder is configured. See [Multiple Calendars](./features/calendar/multiple-calendars.md).

---

## 2.5.1 - 2/21/2026

### Fixed

- **Event title not saving in edit modal**: Changing the title of an existing event in the edit modal had no effect — the title remained unchanged after saving in certain scenarios.
- **Time tracker writing end date in wrong format**: The time tracker's periodic end-time sync wrote dates in a truncated format (e.g., `2026-02-21T14:35` instead of `2026-02-21T14:35:00.000Z`), which could cause the end date to not display when reopening the edit modal.

---

## 2.5.0 - 2/19/2026

### Added

- **File operation concurrency limit**: New slider in Configuration > Performance to control the maximum number of files modified in parallel during batch operations (recurring event propagation, name/category series propagation, and file deletions). Lower values reduce the risk of Obsidian freezing on large vaults with many recurring instances. Default: 10, range: 1–50. See [Configuration — Performance](./configuration/toolbar-and-menus#performance).

### Improved

- **Full undo/redo for all global commands**: All global event operations (both manual commands and API methods — `convertFileToEvent`, `addZettelIdToActiveNote`, `openEditActiveNoteModal`) now go through the command system, making them fully undoable and redoable. See [Programmatic API](./features/advanced/programmatic-api/overview.md).
- **Edit current note as event — single undoable operation**: The "Edit current note as event" command no longer adds a ZettelID before opening the modal. Instead, the ZettelID is added together with the edit on save, so both changes are a single undo entry — one Ctrl+Z reverts the edit and the ZettelID addition at once. See [Programmatic API](./features/advanced/programmatic-api/overview.md).
- **Global undo/redo commands**: Undo and Redo are no longer limited to when the calendar view is focused — they now work from anywhere via the command palette, resolving the last used calendar automatically. See [Hotkeys](./features/advanced/hotkeys.md).

### Fixed

- **Duplicate events on plugin hot-reload**: In-flight CalDAV/ICS sync operations from a previous plugin instance could continue running after unload, creating duplicate events alongside the new instance's sync. Sync services now abort all pending file operations immediately on destroy, preventing duplicates at the source rather than relying on reactive self-healing.
- **Imported recurring events disabled by default**: Events imported via CalDAV, ICS subscriptions, or manual ICS import that contain RRULE data (e.g., recurring habits from Reclaim.ai) are now imported with generation disabled (`Skip: true`). Integration sources already provide individual occurrences, so auto-generating instances from the RRULE would create duplicates. The RRULE metadata is preserved — set Skip to `false` to enable generation if needed. See [Integrations — Recurring Event Support](./features/advanced/integrations.md#recurring-event-support).
- **Deleting CalDAV/ICS subscriptions crashes Obsidian**: Deleting an integration account or subscription with many synced events could freeze or crash Obsidian. File deletions are now batched with main-thread yields between batches. Additionally, any recurring instances generated from imported events are now cleaned up when deleting the subscription or account. See [Integrations](./features/advanced/integrations.md).

---

## 2.4.0 - 2/18/2026

### Improved

- **Faster view switching and month navigation**: Switching between monthly and weekly views (and navigating months) is now significantly faster on larger vaults. When most rendered events change at once (e.g., month→week), the calendar now performs a single bulk reload instead of hundreds of individual event removals, eliminating the lag spike during view transitions.
- **Faster event rendering and past-event styling**: Past-event classification no longer allocates Date objects per event — timestamps are cached once per navigation cycle, reducing GC pressure on large calendars.
- **Faster incremental refreshes**: Frontmatter hashing is now cached per object reference across refreshes, and color dot indicators skip DOM rebuilds when nothing changed.

---

## 2.3.0 - 2/18/2026

### Added

- **Detailed documentation with videos**: Added comprehensive video walkthroughs for every major feature, embedded directly into the documentation pages. Browse the full [documentation site](https://real1tyy.github.io/Prisma-Calendar/) or visit the [Gallery](https://real1tyy.github.io/Prisma-Calendar/gallery) for a visual overview of all features.
- **Templater support for recurring event instances**: Recurring event instances now use your configured Templater template when one is set. The template renders first, and any body content from the source recurring event is appended after the template body. Falls back gracefully if Templater is unavailable. See [Templater Integration — Recurring Event Instances](./features/advanced/templater.md#recurring-event-instances).

### Fixed

- **API datetime timezone normalization**: The programmatic API (`createEvent`, `convertFileToEvent`) now automatically normalizes datetime strings to the expected `.000Z` suffix format. Passing `"2025-02-18T09:00:00"` or `"2025-02-18T09:00"` is now equivalent to `"2025-02-18T09:00:00.000Z"` — the suffix is appended automatically when missing, preventing timezone interpretation conflicts. See [Programmatic API](./features/advanced/programmatic-api/overview.md).
- **Undo frontmatter changes preserves property order**: Undoing batch frontmatter deletions now restores properties to their original position in the YAML frontmatter instead of appending them at the end. See [Batch Operations](./features/management/batch-operations.md#batch-frontmatter-management).

### Improved

- **Batch frontmatter modal redesign**: The batch frontmatter modal now shows all unique properties across selected events (union) instead of only properties common to all. Existing properties are visually distinguished with an accent border. The delete checkbox has been replaced with a toggle-based X button — clicking X on an existing property marks it for deletion (strikethrough), clicking again restores it. New properties are removed immediately on X. Non-core properties like location, participants, and icon are now visible. See [Batch Operations](./features/management/batch-operations.md#batch-frontmatter-management).

---

## 2.2.0 - 2/17/2026

### Added

- **Create untracked event from dropdown**: A "+ Create untracked event" button is now shown at the top of the untracked events dropdown. Clicking it opens the same modal as the "Create new untracked event" command. See [Untracked Events](./features/events/untracked-events.md#create-from-dropdown).

### Fixed

- **Templater template properties overwritten on event creation**: When creating an event with a Templater template configured, the plugin's own frontmatter properties could be dropped or overwritten by a race condition between Prisma, Templater's folder-template handler, and the metadata indexer. The Templater integration now renders templates in memory and writes the final merged content in a single vault operation, fully eliminating the race. Prisma Calendar now uses **exclusively** the template path configured in its own settings — Templater's folder-template assignment for the same directory is bypassed for Prisma-created events. Notes created manually in the same folder still follow Templater's normal folder-template rules. See [Templater Integration](./features/advanced/templater.md).

- **Self-healing for duplicate events**: The indexer now automatically detects and trashes duplicate recurring event instances and duplicate integration events (ICS/CalDAV) caused by race conditions during concurrent syncs. Duplicates are moved to trash as they are indexed, keeping the first-seen file. The recurring event manager also enforces uniqueness per `(rruleId, instanceDate)` — if a second file claims the same slot (from vault copies, sync conflicts, or race conditions), the newcomer is trashed immediately without being registered.

- **Date format corruption on drag-drop**: Fixed `shiftISO()` corrupting date-only values (e.g. `2026-01-25`) into full timestamps (e.g. `2026-01-25T00:00:00.000Z`) when all-day events were drag-dropped or shifted. The function now preserves the original date-only format.

- **Physical instances not correctly renamed when source recurring event is renamed**: When renaming a recurring source event, physical instance files were not correctly renamed — the old event name would persist in their filenames (e.g. `Old Name 2026-01-15-…` instead of `New Name 2026-01-15-…`).

---

## 2.1.0 - 2/16/2026

### Added

- **Sorting normalization strategy**: A new sorting normalization system writes a consistent datetime to a dedicated `Sort Date` property, enabling external tools (Bases, Dataview) to sort all event types by a single field. Six modes are available: none (default), timed-only (start or end), all-day only, and all events (start or end). All-day events get `T00:00:00` appended for consistent cross-type sorting. See the [Configuration](./configuration/properties#sorting-normalization-for-external-tools) documentation.
- **Auto-assign Zettel ID**: New setting to automatically add a Zettel ID timestamp to filenames of events in the calendar directory that don't have one. Three modes: disabled (default), calendar events only (timed and all-day), or all events (including untracked). When active, files like `My Event.md` are renamed to `My Event-20260216120000.md` as they are indexed. See the [Configuration](./configuration/general) documentation.
- **Note preview in event tooltips**: Hovering over an event now shows the first three lines of the note's body content appended to the tooltip. The content is loaded lazily on first hover to avoid unnecessary file reads.
- **Event name typo detection**: When creating or editing an event, the plugin now uses fuzzy matching to detect likely typos in event names. If the entered name closely matches a known category, preset event name, or existing event series, a "Did you mean?" modal appears with up to 3 ranked suggestions. Navigate with arrow keys, accept with Enter, or dismiss with Escape. This feature can be toggled in **Settings → General → Parsing**. See the [Categories](./features/organization/categories.md#event-name-typo-detection) documentation.
- **Duplicate remaining week days**: New context menu option to duplicate an event to all remaining days of the current week (Monday through Sunday). Hidden by default — enable it in Settings → Configuration → Context Menu Items. See the [Batch Operations](./features/management/batch-operations.md#duplicate-remaining-week-days) documentation.

### Fixed

- **CalDAV sync rename format**: Fixed CalDAV sync to use the standard `Title-ZETTELID` filename format when renaming events, instead of the inconsistent `Title - ZETTELID` (space-dash-space) format. Existing files using the legacy format are still recognized and parsed correctly.
- **Recurring event duplicate detection**: Fixed a race condition where duplicate recurring event instances could be created when the in-memory map was updated between the initial check and file creation. The creation lock now re-checks the in-memory instance map before writing a new file.

### Changed

- **Date normalization now uses a dedicated Sort Date property**: Previously, date normalization wrote to the `Date` property, which conflicted with the all-day event date. Normalization now writes to a separate `Sort Date` property by default, and the default strategy is "None". We acknowledge this is a breaking change for users who relied on the old `Date`-based sorting — we apologize for the inconvenience. However, the old approach was fundamentally flawed (overwriting the all-day date property) and this dedicated sort property is the correct long-term solution for the plugin. If you previously relied on the `Date` property for sorting timed events in Bases or Dataview, enable the sorting normalization strategy (recommended: "All events — start datetime") and update your queries to sort by `Sort Date` instead. If events are not sorting correctly in Bases, make sure the `Sort Date` property is configured as a **Date & time** property type in Obsidian's property settings. See the [Configuration](./configuration/properties#sorting-normalization-for-external-tools) documentation and the [FAQ](./faq.md#events-are-not-sorting-correctly-by-sort-date-in-bases) for troubleshooting.

---

## 2.0.1 - 2/15/2026

### Fixed

- **Recurring events and ICS import**: Internal and integration metadata (CalDAV sync metadata, ICS subscription metadata) are no longer copied when creating recurring event instances from a source event or when importing events from ICS files. Previously, these properties could be propagated to generated instances, causing incorrect sync behavior and unnecessary duplication of integration metadata.
- **Recurring source ID replacement no longer duplicates series**: Changing a source event's `RRuleID` now migrates existing physical instances to the new ID instead of treating it as a separate series. This prevents duplicate recurring instance generation caused by old/new ID split state during live updates and startup indexing.
- **Recurring modal instance counts now match series statistics**: The main Events browser now counts recurring instances using the same resolved series events as the recurring details modal. This fixes inflated instance numbers and mismatched totals between the list card and the series statistics panel.

---

## 2.0.0 - 2/15/2026

### Added

- **Name series tracking toggle**: New "Enable name series tracking" setting under Configuration → Performance. Disabling it stops the name series tracker from indexing events by title, reducing memory usage in large vaults. The "By Name" tab in the Events modal is hidden when disabled.

### Changed

- **License changed from MIT to AGPL-3.0**: Starting with v2.0.0, Prisma Calendar is licensed under the [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html). Prisma Calendar remains fully open source. The AGPL-3.0 ensures all derivative works also remain open source, preventing closed-source commercial forks. Versions prior to v2.0.0 remain available under the MIT License.

- **Secure credential storage**: ICS subscription URLs and CalDAV passwords are now stored in Obsidian's [SecretStorage](https://docs.obsidian.md/Reference/TypeScript+API/SecretStorage) instead of plaintext in `data.json`. The Add/Edit modals for CalDAV accounts and ICS subscriptions use Obsidian's SecretComponent picker to select secrets. Existing subscriptions and accounts will need to be re-configured to use SecretStorage. See the updated [Integrations](./features/advanced/integrations) documentation.

- **ICS/CalDAV sync stability**: ICS subscription and CalDAV sync no longer rewrite event notes on every sync cycle when no actual event data has changed. The `DTSTAMP` field (which changes on every ICS export) is no longer used as a change indicator — only `LAST-MODIFIED` is considered. A content-based dirty check compares event frontmatter before writing, skipping no-op updates that previously caused unnecessary git changes and Obsidian sync noise. Events with the same UID are now deduplicated across subscriptions and CalDAV accounts — if one subscription already tracks an event, other subscriptions containing the same event will skip it instead of creating a duplicate note.

- **Performance improvements**: Live event processing is now significantly faster. Event color computation is cached and reused instead of recalculated on every render. Frontmatter property extraction results are cached to avoid repeated parsing. Skipped events are tracked in a dedicated index, eliminating full-list scans. Frontmatter change detection uses hashing to short-circuit unchanged files during resyncs. Frontmatter writes are serialized per file to prevent interleaving and redundant reprocessing. Startup may be slightly slower in large vaults — the plugin now waits for Obsidian's metadata cache to fully resolve before indexing, which provides stronger guarantees against duplicate events and stale data during sync. If startup feels unusually slow, please [report an issue](https://github.com/real1tyy/obsidian-prisma-calendar/issues).

---

## 1.33.0 - 2/14/2026

### Added

- **ICS RRULE Recurring Event Import**: Importing ICS files (manual import, ICS subscription sync, or CalDAV sync) now preserves recurring event rules. RRULE properties are parsed and mapped to Prisma's internal recurrence types — daily, bi-daily, weekly, bi-weekly, monthly, bi-monthly, quarterly, semi-annual, and yearly — with BYDAY weekday support for weekly/bi-weekly patterns. Imported recurring events automatically generate instances via the existing recurring event system. Unsupported RRULE patterns fall back to single-event import.

- **Bi-daily recurrence type**: A new "Bi-daily (every 2 days)" recurrence option is available when creating or editing recurring events. It also maps from `FREQ=DAILY;INTERVAL=2` during ICS import.

- **Event Icon Property**: Events can now have a custom icon (emoji or text) displayed on the calendar via a configurable frontmatter property (default: `Icon`). The icon takes highest precedence — it overrides CalDAV account icons, ICS subscription icons, and recurring event markers. Set it directly in frontmatter (e.g., `Icon: 🎉`) or use the new **Icon** field in the Create/Edit Event modal. Icons are also saved in event presets and restored from minimized modals. Configure the property name in Settings → Properties → "Icon property". See the [Event Icons](./features/events/event-icons) documentation for full details.

- **Global event creation commands**: `Create new event` and `Create new event with stopwatch` now work from anywhere in Obsidian (not only when a calendar view is focused). They use the last opened Prisma calendar, with fallback to the first enabled calendar.

- **Untracked event creation command**: New `Create new untracked event` command opens a minimal modal (name only) and creates a Prisma note with ZettelID while keeping `Start Date`, `End Date`, `Date`, and `All Day` empty.

- **Current note event tooling**: Two new commands for manual conversion workflows:
  - `Edit current note as event` opens Prisma's full edit modal for the active note (outside calendar view), ensuring ZettelID first.
  - `Add ZettelID to current note` quickly converts the active note into a Prisma-compatible event skeleton.

- **Programmatic API on `window.PrismaCalendar`**: Initial scripting API with event creation, untracked event creation, file-to-event conversion, modal controls, and ZettelID enforcement. Expanded significantly in v2.6.0. See [Programmatic API](./features/advanced/programmatic-api/overview.md).

- **Event text colors**: Two new settings in Calendar → Event text colors let you configure text colors for calendar events:
  - **Default event text color**: Used for events with dark backgrounds (default: white). This is the standard text color you see on most events.
  - **Alternative event text color**: Used automatically when an event's background is light or white (e.g., pastel colors, shades of white). Default: black. The calendar detects light backgrounds and switches to this color for better readability.

- **Settings Reorganization**: The settings panel now has 10 tabs (up from 7) for better organization. Three new tabs have been added:
  - **Event Groups**: Recurring event settings, propagation toggles (recurring, name series, category series), shared propagation settings, and event markers — all extracted from the Calendar tab.
  - **Configuration**: Desktop/mobile toolbar button toggles, batch selection button toggles, and context menu item toggles — extracted from the Calendar tab.
  - **Integrations**: ICS export/import, CalDAV settings, ICS URL subscriptions, and holiday settings — extracted from the General tab.

  The **General** tab now focuses on directory, parsing, stopwatch, statistics, and event presets. The **Calendar** tab now focuses purely on display options (views, density, overlap, time grid, etc.). Tab order: General, Properties, Calendar, Event Groups, Configuration, Notifications, Rules, Categories, Bases, Integrations.

- **All Events Timeline**: A new **Timeline** toolbar button and command ("Show all events timeline") that opens an interactive vis-timeline visualization of every event in your calendar. Unlike the Event Series timeline which shows events from a single series, this displays all events at once for a complete overview. Zoomable, pannable, with category colors, click-to-preview, and current time indicator. Toggle the button visibility in Settings → Configuration → Desktop/Mobile toolbar buttons.

- **Settings Search**: A search input to the right of the section tabs (General, Properties, Calendar, etc.) lets you instantly filter settings across all sections. Matching settings are shown with their section headings, while non-matching items are hidden. Supports debounced input (300ms), immediate filtering on Enter or blur, and preserves focus while filtering. Clear the search or click any tab to return to normal tabbed navigation.

- **Holiday calendar integration**: Display public holidays on your calendar with automatic detection based on country, state, and region. Support for multiple holiday types (public, bank, school, observance, optional), intelligent caching per year, customizable timezone, and works completely offline. Configure in Settings → Calendar Name → General (scroll to bottom). See the [Holidays](./features/calendar/holidays) documentation for full details.

- **Calendar Title Property**: Prisma Calendar now automatically assigns a **Calendar Title** property (default: `Calendar Title`) to event files. The property stores a wiki link with the ZettelID and recurring instance dates stripped from the filename (e.g., `[[Events/Meeting-20250106143022|Meeting]]`). This pre-computed clean title is used everywhere — calendar view, Bases views, modals, notifications, and context menus — eliminating the need for runtime stripping. The property is always kept in sync automatically. See the [Event Naming](./features/management/zettelid-naming#calendar-title-property) docs for details.

- **Events Browser**: The toolbar now features a permanent **"Events"** button that opens a unified modal with three tabs — **Recurring**, **By Category**, and **By Name** — each showing a count in its label. Browse all recurring event sources (with instance counts, type badges, and category/navigate/disable actions), all category-based groups, and all name-based groups from a single modal. Clicking any item opens the Event Series Modal for drill-down. The Recurring tab retains its type filter dropdown and disabled-events toggle. A shared search input filters items across all tabs, and a sort dropdown lets you order by count (descending by default) or name (ascending/descending). See the [Events Browser](./features/events/event-groups#events-browser) docs for details.

- **Series Frontmatter Propagation**: Frontmatter propagation now works for name-based series and category-based series, not just recurring events. When you change a custom property on one event, the change can automatically propagate to all other events sharing the same name or category value. Four new toggles are available in Settings: "Propagate frontmatter to name series", "Ask before propagating to name series", "Propagate frontmatter to category series", and "Ask before propagating to category series". The existing excluded properties and debounce delay settings now apply to all propagation types. Loop prevention ensures propagated changes don't cascade infinitely. See the [Event Series](./features/events/event-groups#frontmatter-propagation) and [Frontmatter Propagation](./configuration/event-groups#frontmatter-propagation) docs for details.

- **Event Groups**: A new system for tracking and managing groups of related events. Events are automatically grouped in three ways — by recurring event rules, by shared category, and by shared name (with ZettelID stripped). Right-click any event and select **"View event groups"** to open the Event Series Modal, which shows all related events across up to three tabs: **Recurring**, **By Category**, and **By Name**. Each tab provides completion statistics (past events, skipped count, completion percentage), filter toggles to hide past or skipped events, debounced search, smart sorting (ascending for future events, descending when showing all), and color-coded rows matching your calendar color rules. Events with multiple categories show a category chooser before drilling into a specific category's event list. See the new [Event Groups](./features/events/event-groups) documentation for full details.

- **Category Modal Arrow Key Navigation**: Navigate through category items in the assignment modal using Arrow Up/Down keys. Press Enter to toggle the highlighted category, or press Enter with no highlight to submit the form. The highlight wraps around and auto-scrolls into view.

- **ICS URL Subscriptions**: Subscribe to external calendars (Outlook, Google, etc.) via public ICS URLs for automatic, periodic syncing. Events are synced one-way into your calendar — new events are created, changed events are updated, and removed events are deleted locally. Configure sync interval, timezone, and auto-sync in Settings → Integrations → ICS URL Subscriptions. Use the "Sync ICS subscriptions" command for manual sync.

- **Periodic End Time Sync for Minimized Stopwatch**: While a stopwatch is running in a minimized modal, the event's end time is now automatically persisted to the file every 5 minutes. This keeps the end time in sync with reality and protects against data loss if the app crashes.

- **Custom Done/Undone Properties**: Two new settings in **Settings → Properties** that let you override what "mark as done" does for manual actions. Both use a simple `propertyName value` format (e.g., `archived true` / `archived false`). When **Custom done property** is configured, it replaces the default status property behavior for manual mark-as-done actions (context menu, event modal checkbox, batch operations). **Custom undone property** is applied when marking as undone — it requires the done property to be configured first. If the undone property is left empty, the done property key is removed instead. The custom done property is also used to evaluate whether an event is currently done (the context menu shows "Mark as undone" when the custom property matches). Auto-mark past events continues to use the standard status property. Values are auto-parsed (`true`/`false` → boolean, numbers → number, rest → string). Fully supports undo/redo. Both default to empty (disabled — standard status property is used).

- **Location and Participants properties with full ICS support**: Added first-class support for event location and participants with seamless ICS import/export. Location is stored as a single string, participants as an array of strings. Default property names are `Location` and `Participants` (configurable in Settings → Properties). These are now core event properties, not just custom frontmatter fields. The Create/Edit Event modal includes dedicated Location and Participants input fields, and presets can save location and participants for quick event creation. When exporting to ICS format, location maps to the standard `LOCATION` field and participants map to `ATTENDEE` fields with proper `mailto:` URIs and common name (CN) parameters. When importing from ICS files (Google Calendar, Outlook, Apple Calendar, etc.), `LOCATION` and `ATTENDEE` fields are automatically extracted and stored in your configured properties. This enables full round-trip compatibility with external calendar applications.

- **Bases View for Event Series**: The Event Series Modal now includes a "Bases" footer with three view type buttons — **Table**, **List**, and **Cards**. Click any button to open a Bases view filtered to show only events from the current series (recurring events by RRule ID, name-based series by Calendar Title, or category-based series by category value). The Bases footer is hidden in the category tab until you select a specific category. This provides a seamless way to view and edit event series in Bases' powerful table/card interfaces.

- **Enhanced Event Series Statistics**: The Event Series Modal now displays comprehensive statistics with two rows. The first row shows total events, past events, skipped count, and completion percentage. The second row shows time-based breakdowns (this year, this month, this week) and automatic frequency calculation. Frequency is calculated from past event history and displayed in the most appropriate unit (e.g., "3.2x/week" for multiple times per week, "1.5x/month" for roughly monthly events). Requires at least 2 past events to calculate frequency. All statistics are computed from the full unfiltered list regardless of filter settings.

- **Timeline View for Event Series**: Added a **Timeline** button to the Event Series Modal footer alongside Table, List, and Cards. Click Timeline to open an interactive timeline visualization powered by vis-timeline showing all events in the series as labeled points on a time axis. The title clearly shows the context (e.g., "Timeline for Recurring - Gym", "Timeline for Category - Health"). Features include: zoomable and pannable timeline (zoom with mouse wheel, pan by dragging), event type distinction (timed events show a square dot, all-day events show a hollow circle dot with dashed border), events displayed with their clean titles, category-based coloring matching your color rules, hover tooltips showing the same detailed information as the calendar view (time range with duration for timed events, date for all-day events, plus configured display properties differentiated between timed and all-day), skipped event indicators (faded with strikethrough), click any event to open the preview modal. Perfect for visualizing event patterns and distributions over time.

- **Category-Colored Rows in All Event List Modals**: The Filtered Events, Skipped Events, Global Event Search, and Selected Events modals now color each row with a tinted background and left border based on the event's category, matching the category coloring used in the Events Browser.

- **Calendar Sync Icons**: Both CalDAV and ICS URL subscriptions now support optional calendar icons. Set an icon (emoji or Unicode character) for each account/subscription in the configuration modal, and it will appear in the top-right corner of all synced events from that calendar. This makes it easy to visually identify which external calendar each event came from. Icons use the same marker system as recurring events and holidays.

- **ICS Subscription Integration Color**: ICS URL subscriptions now have their own "Integration event color" setting (matching CalDAV's existing setting). This color is applied to all events synced from ICS subscriptions and overrides color rules, just like CalDAV integration colors. Configure in Settings → Integrations → ICS URL Subscriptions.

### Changed

- **Untracked save behavior in event modal**: Saving with empty date/time inputs now explicitly keeps the event untracked by clearing Prisma date fields instead of forcing a timed event payload.

- **Event modal sticky footer**: Cancel, Save as preset, and Save buttons now stay visible at the bottom of the Create/Edit Event modal even when the form overflows and requires scrolling.

- **Toolbar button renamed**: The old "X recurring" toolbar button has been replaced with an always-visible **"Events"** button that opens the new unified Events Browser instead of the old recurring-only modal.

- **Incremental Calendar Rendering**: The calendar no longer destroys and recreates every DOM element on each update. Changes are now diffed against the previous state — only added, removed, or modified events touch the DOM. Editing a single event in a view with hundreds of events now updates just that one element instead of rebuilding all of them. Settings changes that don't affect event rendering (hour range, weekends, slot duration) no longer trigger any event refresh at all.

### Fixed

- **Sticky Toolbar + Sticky Headers Conflict**: When both "Sticky day headers" and "Sticky all-day events" are enabled, the top toolbar (including the Untracked Events dropdown) now stays visible while scrolling. Sticky day headers and the all-day section are now offset dynamically to sit below the toolbar instead of overlapping/pushing it away.

- **Zoom Level Text Duplication**: Fixed a race condition that caused the zoom level button text to duplicate (e.g., "Zoom: 30 minutes, 30 minutes") when changing viewports, intervals, or navigating the calendar.

- **Keyboard Navigation Focus on Leaf Switch**: Arrow key interval navigation (left/right) now works immediately when switching back to the calendar tab. Previously, you had to click the calendar to restore focus before keyboard navigation would respond.

- **Stopwatch Continue with Past End Date**: When using "continue" on the stopwatch, if the end date is in the past it is now automatically updated to the current time. Previously, the stale end date would remain unchanged.

- **Filter Expressions Not Applied Immediately**: Adding or changing JavaScript filter expressions in Settings → Rules now takes effect immediately without requiring a plugin restart. Previously, the event store cache retained stale entries because file modification times hadn't changed during the resync, causing the filter to be silently skipped until the next cold start.

- **Enter Key Not Working in Modals**: Pressing Enter to submit now works reliably in all modals (event modal, move-by modal, save preset modal, batch frontmatter modal) regardless of which element has focus. Previously, keyboard handlers were attached to the modal's content area, so clicking buttons or expanding sections like the stopwatch could move focus outside the handler's reach, causing Enter to stop responding. All modals now use Obsidian's modal-wide scope system instead.

- **ICS/CalDAV Sync Creating Duplicate Events on Startup**: External calendar sync (ICS subscriptions and CalDAV) no longer creates duplicate notes for the same remote event. Previously, a race condition allowed sync to start before the vault had been fully indexed — the sync state manager didn't yet know about existing events, so `findByUid()` returned null and created a new file instead of updating the existing one. Sync now waits for all async indexer event handlers to complete before proceeding.

- **Renaming Recurring Source Event Creates Duplicate Instances**: Renaming a recurring source event file no longer generates a duplicate set of instances. Previously, the rename was processed as a delete + create — the delete wiped all physical instance tracking, then the create saw zero instances and generated new ones from scratch, resulting in two complete series sharing the same RRule ID. The rename now preserves physical instance tracking and renames existing instance files instead.

---

## 1.32.0 - 2/8/2026

### Added

- **Auto-stop Stopwatch on New Event**: When using "Create new event with stopwatch" (`Ctrl+Shift+O`), any currently running stopwatch event is automatically stopped and saved before the new event is created. This allows you to chain event tracking without manually closing the previous event — just press the shortcut and a new tracking session begins instantly.

- **Trigger Stopwatch Context Menu Action**: Right-click any event and select "Trigger stopwatch" to instantly start time tracking on it. This one-click action sets the start time to now, starts the stopwatch, saves the event, and minimizes — all without opening the edit modal. If another stopwatch is already running, it is automatically stopped and saved first. All-day events are automatically converted to timed events. Shown by default in the context menu, but can be hidden via Settings → Context menu items.

- **Separate Mobile Toolbar Configuration**: You can now independently configure which toolbar buttons appear on mobile vs desktop. A new "Mobile toolbar buttons" section in Settings lets you hide buttons on mobile without affecting the desktop layout.

- **Go to Today Hotkey**: New `Go to today` command navigates the calendar to show today's date. Assign a hotkey via `Settings` → `Hotkeys` → search "Prisma Calendar: Go to today". The existing `Scroll to current time` command continues to scroll the viewport to the now-indicator within the current view.

- **Bases Settings Tab**: New dedicated settings tab for configuring Bases views. Access via Settings → Bases.

- **Bases View Type Setting**: Choose between cards, table, or list view for all Bases views throughout Prisma Calendar. Cards view (default) displays events as visual cards, table view as a sortable table with columns, and list view as a simple list. This setting applies to category events views and interval-based Bases views.

### Changed

- **Scroll-Preserving Zoom**: Changing zoom levels (via `Ctrl+Scroll` or the zoom menu) now keeps the same time centered in the viewport. Previously, zooming would reset the scroll position and lose your place in the day.

- **Collapsible Property Sections**: The "Display Properties" and "Other Properties" sections in the event modal are now collapsed by default to reduce visual clutter. Click the section header to expand/collapse. Clicking "Add property" auto-expands the section.

- **Even Time Split for Multi-Category Statistics**: Events with multiple categories now split their duration evenly across all assigned categories in statistics views. Previously, the full duration was counted for each category, inflating totals. For example, a 2-hour event with categories "Work, Learning" now contributes 1 hour to each category instead of 2 hours to each.

- **Mobile calendar toolbar**: The search and expression inputs (plus zoom and filter presets) are now collapsed by default on mobile to save space. Tap **Filters** to expand/collapse them.

---

## 1.31.0 - 1/27/2026

### Added

- **Clickable Recurring Events in List Modal**: Clicking on a recurring event in the "Show recurring events" modal now opens a detailed list of all physical instances for that specific recurring event. This allows you to quickly view and navigate to individual occurrences. Hold Ctrl/Cmd while clicking to open the source event file in a new tab instead.

- **Smart Instance Sorting**: The recurring event instances list now sorts intelligently based on the view mode. When showing past events, instances are sorted from newest to oldest (most recent first). When showing only future events, instances are sorted from oldest to newest (next occurrence first). This makes it easier to find the most relevant instances regardless of which time period you're viewing.

### Changed

- **Read-only Mode Storage**: Read-only mode is now stored in a separate `sync.json` file instead of the main settings. This allows you to prevent the read-only state from syncing across devices when using Git or other sync solutions. The setting remains accessible in Settings → General → "Read-only mode". To prevent syncing read-only mode state, add `.obsidian/plugins/prisma-calendar/sync.json` to your `.gitignore` file.

---

## 1.30.0 - 1/26/2026

### New Video

- [Prisma Calendar — Major Productivity Improvements Breakdown](https://www.youtube.com/watch?v=p4yGAGTyoyI)

**What's Covered**:
- Untracked events dropdown showing all events without dates
- Bidirectional drag & drop to track and untrack events visually
- Untracked event filtering using JavaScript expressions
- Customizable calendar toolbar with per-button control
- Drag-to-create events by clicking or dragging on the timeline
- Keyboard-first commands for fast event time editing
- Stopwatch improvements including resume and mid-session timers
- Visual markers distinguishing recurring event sources and instances
- Improved recurring events modal and frontmatter propagation
- Category assignment everywhere with full undo support
- Auto-category assignment based on event name
- Category statistics with totals, breakdowns, and percentages
- Statistics commands for today, this week, and this month
- Configurable desktop event limits with "+more" overflow
- Configurable all-day event height with scrollable content
- Sticky headers and all-day sections for easier scrolling
- Navigate-back command for fast context switching
- Clickable categories opening Bases views

### New Features

- **Read-only Mode**: New setting to prevent automatic file modifications. When enabled in Settings → General → "Read-only mode", the plugin will not automatically write to files, including marking events as notified, generating recurring event instances, or marking past events as done. Manual actions triggered by the user (like propagating frontmatter from context menu) will still work. This is useful for preventing sync conflicts or when you want full control over when files are modified.

- **Edit Source Event Context Menu Option**: New context menu option "Edit source event" for physical and virtual recurring event instances. When you right-click on a recurring event instance (either a physical file or virtual occurrence), you can now select "Edit source event" to open the edit modal with the source recurring event's data. This allows you to quickly modify the recurring event template without navigating to the source event first. Enabled by default, can be toggled in Settings → Calendar → Context menu items.

- **Show Duration in Event Title**: New setting to display event duration directly in the event title. When enabled in Settings → Calendar → "Show duration in event title", timed events will show their duration in parentheses after the event name (e.g., "Meeting (2h 30m)"). This makes it easy to see event durations at a glance without hovering over events. The duration is displayed in a compact format (e.g., 1h, 30m, 2h 15m) and only appears for timed events with both start and end times. Enabled by default.

- **Quick Category Removal in Event Modal**: Categories displayed in the event create/edit modal now include a small "×" button on the right side of each category tag. Click this button to instantly remove that category from the event without opening the category assignment modal. This provides a faster workflow for removing individual categories while still allowing full category management through the "Assign categories" button.

- **Assign Categories to Minimized Event**: New command "Assign categories to minimized event" allows you to quickly assign categories to a minimized event modal without restoring the full modal. When you have a minimized event, you can run this command to open the category assignment modal directly, make your changes, and continue working - perfect for fast category updates while keeping your event minimized. Access via command palette when a minimized modal is present.

- **Category Rename and Delete**: Users can now rename and delete categories directly from Settings → Categories using the new edit (pencil) and delete (trash) buttons next to each category. When you click rename, a modal prompts you to enter the new category name and shows how many events will be affected. When you click delete, a confirmation modal appears showing the number of events that will be modified. Both operations work automatically in the background, updating the category property in all affected event files and adjusting the associated color rules. This makes category management effortless - no need to manually edit individual event files or color rules.

  **Note:** After renaming or deleting categories, restart Obsidian for changes to fully propagate across all calendar views and settings.

- **Category Auto-Assignment in Edit Modal**: The event edit modal now applies category auto-assignment when you change the event title, matching the behavior of the create modal. When you modify an event's title and blur the title field, categories are automatically assigned based on configured rules (name matching and custom presets). This ensures consistent category assignment behavior across both create and edit workflows.

- **Stopwatch Auto-Fill End Time**: When you click "start" on the stopwatch, it now automatically fills both the start time (current time) and the end time (start time + default duration from settings). This provides a complete time block immediately, which you can adjust as needed. The default duration is configured in Settings → General → "Default duration (minutes)".

- **Multiple Event Names in Category Assignment Presets**: Category assignment presets now support comma-separated event names in a single preset. Instead of creating separate presets for similar events, you can now define multiple event names that should receive the same categories. For example, a preset with event names "Coding, Work, Dev" will automatically assign the configured categories to events named "Coding", "Work", or "Dev". This makes category auto-assignment more flexible and reduces the number of presets needed. Configure in Settings → Categories → Auto-assign categories → Custom category assignment presets.

### Changed

- **Category Assignment Modal**: Selected categories now appear at the top of the list, followed by unselected categories sorted alphabetically. This makes it easier to see which categories are already assigned when working with multiple events.

- **Improved Category Settings UI**: Enhanced the visual design of category cards in Settings → Categories. Each category card now displays with a subtle background tint matching the category's configured color, making it easier to visually identify categories at a glance.

- **Improved Category Assignment Preset UI**: Completely redesigned the category assignment preset interface in Settings → Categories for better usability and visual appeal. Each preset now displays in a compact single-row layout with colorful category tags showing their configured colors, larger spacing for easier interaction, and improved buttons ("+" for adding categories, "×" for removing). The event name input supports word-break for long comma-separated names, and a visual arrow (→) shows the relationship between event names and categories. The layout naturally wraps to multiple rows when needed.

- **Improved Color Rules Settings UI**: Enhanced the color rule interface in Settings → Rules for a cleaner, more professional appearance. Color pickers now appear as standalone elements without bulky setting wrappers, using native HTML color inputs that blend seamlessly into the rule layout.

- **Improved Modal Button Styling**: Enhanced the visual design of modal action buttons across the plugin. Modal buttons (Cancel, Delete, etc.) are now centered horizontally for better visual balance, with consistent 8px spacing using flexbox. Delete confirmation modals for batch operations now have cleaner, more centered button layouts.

- **Stopwatch Continue Button**: The stopwatch "start (no fill)" button has been renamed to "continue" and now continues from the existing start time in the event rather than creating a new start time. When you click "continue", the timer calculates the elapsed time based on the event's start date and continues tracking from that point, making it perfect for resuming work on existing events. This provides accurate time tracking when you return to an event after a break.

### Bug Fixes

- **Virtual Event Context Menu**: Fixed virtual recurring events showing incorrect context menu options. Virtual events now properly display only relevant actions (Enlarge, Go to source, Edit source event, View recurring events, Enable/Disable recurring event) and hide file-based operations that don't apply to read-only virtual instances. This ensures a cleaner, more appropriate context menu for virtual events.

- **Category Assignment Preset Input State Preservation**: Fixed a bug where typing an event name in a category assignment preset would reset when adding or removing categories. The input field now preserves its value, focus state, and cursor position during category operations. This allows you to type event names and manage categories simultaneously without losing your input.

- **Event Name Reset Bug in Category Assignment**: Fixed a bug where the event name would be reset to an empty string when adding or removing categories from a preset. The current input value is now properly preserved when updating preset categories, ensuring that unsaved event names are not lost during category operations.

- **Daily Statistics in Day View**: Fixed daily statistics modal showing today's date instead of the selected day when opened from day view. Previously, opening daily statistics while viewing a specific day would incorrectly display statistics for today. Now it correctly shows statistics for the day being viewed. Weekly and monthly views retain the original behavior of showing today if within the visible interval.

- **Event Edit Modal ZettelID Preservation**: Fixed saving from a restored minimized event modal incorrectly renaming the event file with a new ZettelID. Previously, when you created an event with stopwatch tracking, saved it, then reopened the minimized modal and saved again, the file would be renamed with a new ZettelID. The edit modal now correctly preserves the ZettelID.

- **Duplicated Recurring Instances Visibility**: Fixed duplicated recurring event instances disappearing from the calendar. Previously, when duplicating a recurring instance, the original event would become invisible because the system only tracked one physical instance per date. Now the system correctly supports multiple physical instances sharing the same instance date, ensuring both the original and duplicated events remain visible on the calendar. This fix enables proper tracking of duplicated instances while maintaining correct virtual event generation (virtual events still start after the latest non-ignored physical instance).

---

## 1.29.1 - 1/14/2026

### Bug Fixes

- **Event Creation Race Condition**: Fixed events occasionally failing to appear on the calendar immediately after creation. The indexer now properly validates that required properties (start/date) have actual values before processing events, preventing race conditions where the metadata cache updates before property values are fully populated.

---

## 1.29.0 - 1/12/2026

### New Features

- **Category Statistics Display**: The categories settings page now displays comprehensive event statistics at the top showing total events, timed events count and percentage, and all-day events count and percentage. Each individual category also shows its detailed breakdown of total events, timed events, and all-day events with percentages. This provides instant insight into your event distribution patterns.

- **Event Markers for Recurring Events**: Visual indicators now appear in the top-right corner of recurring events to distinguish between source events and physical instances. Source recurring events (the original recurring event template) display a configurable marker (default: ⦿), while physical recurring instances (actual generated events) show a different marker (default: 🔄). Both markers and their visibility can be customized in Settings → Calendar → Recurring events → Event markers. This makes it instantly clear which events are source templates versus generated instances when viewing your calendar.

- **Enhanced Event Tooltips**: Event hover tooltips now display start/end times and duration for timed events, and date for all-day events. Wikilink properties are displayed cleanly showing only the alias or filename. Provides quick time and property information without opening the event.

- **Configurable All-Day Event Height**: Individual all-day events now have a configurable maximum height (default 75px, range 30-500px). Events that exceed this height become scrollable, allowing you to see all frontmatter properties while keeping the calendar compact. Configure via Settings → Calendar → User interface → "All-day event height".

- **Statistics for Now**: Added new statistics commands that use the current date/time instead of the calendar's visible interval. When viewing a past or future date in the calendar, these commands show statistics for today/this week/this month. Available commands: "Show daily statistics for now", "Show weekly statistics for now", and "Show monthly statistics for now". The original statistics commands use the currently visible calendar interval.

- **Recurring Events Modal Improvements**: Enhanced recurring events management with category support and visual improvements.
  - **Category Color Backgrounds**: Recurring events display their category color as a semi-transparent background across the entire row with a left border accent
  - **Category Assignment Command**: "Category" button uses the unified category assignment command for consistent behavior
  - **Clean Display**: Zettelkasten IDs are automatically stripped from event titles for better readability (handles both prefix and suffix formats)
  - **Removed File Paths**: Subtitle file paths removed as they're redundant with the title
  - Access via command palette: "Show recurring events"

- **Recurring Events List Modal Enhancement**: When viewing instances of a recurring event, the modal background displays a subtle gradient using the source event's category color

### Bug Fixes

- **Untracked Events Drag & Drop**: Fixed duplicate command execution when dragging calendar events to the untracked dropdown. Previously required 2 undo actions to revert, now correctly requires only 1 undo.

---

## 1.28.0 - 1/11/2026

### New Features

- **Desktop Event Limit**: Added setting to control how many events show per day on desktop before displaying a "+more" link. Configure "Desktop events per day" in Settings → Calendar → Visual Appearance (0 = unlimited, range: 0-10). Previously, only mobile had configurable event limits.

### Bug Fixes

- **Event Modal Updates**: Fixed crash when updating events after save operations. The modals now properly update internal event properties when files are renamed, preventing "Cannot set property extendedProps" errors during create/edit workflows.

- **Event Modal Rendering**: Fixed event modal inputs not rendering correctly on certain devices due to CSS conflicts with other plugins and themes. All form elements now use the `prisma-` prefix to prevent naming collisions. The modal has been restyled with improved layout, proper spacing.

---

## 1.27.0 - 1/11/2026

### New Features

- **What's New Modal**: When you update Prisma Calendar, a modal automatically appears showing all changes since your last version. The modal displays the changelog entries for versions between your previous and current version, making it easy to see what's new. The modal includes links to the full changelog, documentation, and support options.

- **Customizable Calendar Toolbar**: Configure which buttons appear in the calendar toolbar to optimize space usage in narrow sidebars. Choose from Previous/Next navigation, Today, Now, Create Event, Zoom Level, Filter Presets, Search Input, Expression Filter, and Untracked Events dropdown. All buttons are enabled by default. Access via Settings → Calendar → Toolbar buttons. **Note**: Reopen the calendar view for changes to take effect.

### Breaking Changes

- **Deprecated Setting Removed**: The "Show untracked events dropdown" toggle has been removed in favor of the unified toolbar buttons configuration. If you previously disabled the untracked events dropdown, you'll need to uncheck "Untracked Events" in the new toolbar buttons section.

---

## 1.26.0 - 1/9/2026

### New Features

- **Untracked Event Filtering**: Filter untracked events based on frontmatter properties using JavaScript expressions. Configure global filters in Settings → Rules & Filters → Untracked Event Filtering to control which untracked events appear in the dropdown. Works identically to regular event filtering but applies only to events without dates.

- **Untracked Events Dropdown**: New reactive dropdown showing events without date properties
  - Displays in calendar toolbar as "Untracked" button
  - Shows all events that don't have Start Date, End Date, or Date properties
  - Search functionality to filter untracked events
  - Display properties support (configurable in settings)
  - Color rules apply automatically
  - Double-click to open event file

- **Bidirectional Drag & Drop for Untracked Events**
  - **Dropdown → Calendar**: Drag untracked events from dropdown to calendar to assign dates
    - Drop on time slot = timed event with start/end times
    - Drop on all-day area = all-day event with date
  - **Calendar → Dropdown**: Drag calendar events to dropdown to remove dates and make them untracked
    - Drop on "Untracked" button (closed dropdown)
    - Drop anywhere in open dropdown area
    - Clears Start Date, End Date, Date, and All Day properties
  - Full undo/redo support for all drag operations
  - Smart dropdown behavior: temporarily hides after 1.5s of hovering while dragging to prevent blocking calendar
  - Stays open after dropping events for easier bulk operations

- **New Command**: "Toggle untracked events dropdown" (`show-untracked-events`)
  - Toggle dropdown visibility via command palette or hotkey
  - Configurable in Settings → Hotkeys
  - Quick access to untracked events without using mouse

- **Reactive Untracked Events System**
  - Dropdown automatically updates when files change
  - Instant refresh when events become tracked/untracked

### Improvements

- **Immediate Command Availability**: Commands now work immediately after switching to a calendar view. Previously, you had to click on the calendar before commands would respond. Now when you switch tabs or use ribbon icons or the specific command to open a calendar, all the other commands are instantly available without extra interaction.

- **Smart Minimized Modal Updates**: When tracking time with the stopwatch in a minimized modal, the modal now automatically updates if the underlying event file is modified from another window or source. This prevents data inconsistencies and ensures you're always working with the latest event information. If the event file is deleted while tracking, the minimized modal is automatically cleared with a notification.

---

## 1.25.0 - 1/8/2026

### New Features

- **Drag-to-Create Events**: You can now drag on the timeline to create events by defining the start and end time in one gesture. Click and drag on any empty time slot in week or day views, and the event creation modal opens with the selected time range pre-filled. Single clicks use your configured default duration, while dragging uses the exact range you selected. This matches the behavior of Google Calendar and Notion Calendar, making time-blocking workflows faster and more intuitive.

- **Fast Event Editing Commands**: Added five keyboard-friendly commands for rapid event time management. Hover over any event to focus it, then trigger commands via hotkeys:
  - **Edit last focused event**: Opens the edit modal for the last hovered event (for virtual events, opens the source event)
  - **Set start time to now**: Updates the focused event's start time to the current moment
  - **Set end time to now**: Updates the focused event's end time to the current moment
  - **Fill start time from previous event**: Sets start time to match the end time of the previous event (perfect for chaining tasks)
  - **Fill end time from next event**: Sets end time to match the start time of the next event

  These commands are ideal for logging actual execution times after completing tasks, eliminating the need to right-click and navigate menus. Assign hotkeys in Settings → Hotkeys.

  Additionally, the right-click context menu now includes "Fill start/end time from current time" options for quick time logging without leaving the calendar view.

- **Configurable Context Menu**: You can now customize which actions appear when right-clicking events. All 23 context menu items (enlarge, edit, duplicate, move, fill time, etc.) are enabled by default, but you can disable any items you don't use in Settings → Calendar → Context Menu. This declutters the right-click menu and keeps only the actions relevant to your workflow.

### Bug Fixes

- **Fixed Default Duration for Timeline Click-to-Create**: Fixed an issue where clicking on the timeline to create events always used a fixed 60-minute duration instead of respecting the configured default duration setting. Timeline-created events now correctly use your configured default duration (found in Settings → Event Defaults), matching the behavior of the "Create Event" button for consistent event creation across all methods.

- **Fixed Recurring Events Not Being Detected After Editing**: Fixed an issue where recurring events (especially non-weekly events like daily, monthly, or yearly) sometimes weren't being picked up by after editing. The system now properly detects and processes recurring events immediately after changes, ensuring all recurrence patterns are correctly identified and physical instances are generated as expected.

- **Fixed Recurring Event ID Overwriting**: Fixed an issue where the plugin could overwrite existing recurring event IDs due to stale metadata cache. The system now waits and rechecks the metadata cache before generating a new ID, preventing duplicate physical instances from being created when an ID already exists in the file.

- **Fixed Newly Created Future Events Notifications**: Fixed an issue where newly created events with future start/end times were being marked as already notified. The system now checks the event start date when creating or editing events. If the start date is in the past or within 1 minute of now, the event is automatically marked as already notified at submission time, preventing notification spam for actual or past events.

---

## 1.24.0 - 1/7/2026

### New Features

- **Auto-Category Assignment**: Categories can now be automatically assigned to new events based on the event name. When you finish typing the event title, the system checks for matches and replaces categories accordingly. Enable "Auto-assign when name matches category" to automatically assign categories when the event name matches a category name (case-insensitive, ignoring ZettelID and instance dates). Configure custom assignment presets to map specific event names to multiple categories (e.g., "Coding" → Software, Business). The behavior is intentional and predictable - you see exactly what gets assigned before saving the event.

---

## 1.23.0 - 1/6/2026

### New Features

- **Sticky Headers for Better Scrolling**: Added configurable sticky headers for weekly and daily views. Enable "Sticky day headers" to keep day/date headers visible at the top when scrolling through time slots. Enable "Sticky all-day events" to keep the all-day event section pinned below the headers. Both options work independently or together, making it easier to navigate long calendars without losing context of which day you're viewing.

- **"Now" Button for Timeline Navigation**: Added a "Now" button to the calendar toolbar that scrolls to the current time or day. In week and day views, it navigates to today and centers the view on the current time marker. In month view, it navigates to today and centers the current day in the viewport. Especially useful after scrolling or zooming to quickly return to the present moment. Also available as an Obsidian command "Scroll to current time". The now indicator line has also been made thicker (2.5px) for better visibility.

- **Date Property Normalization for Sorting**: Added setting to copy start or end datetime into the `Date` property for timed events, enabling external tools (Dataview, Bases, etc.) to sort all events chronologically by a single field. Solves the problem where mixed timed and all-day events can't be sorted together. Configure in Properties Settings.

- **Batch Frontmatter Management with Smart Prefilling**: Added comprehensive frontmatter editing in batch selection mode. The "Frontmatter" button opens a modal that automatically prefills properties common to all selected events, making bulk editing efficient and intuitive. Add new properties, update existing ones, or mark properties for deletion across multiple events at once. All operations are fully undoable.

- **Category Percentages**: Categories list now displays percentages alongside event counts (e.g., "91 events - 45.5%") to quickly see the distribution of events across categories.

- **Category Events Sorting**: Category events modal now sorts events by the configured date property from newest to oldest, making it easier to see recent events first.

- **Bases View Properties**: Added setting to configure additional frontmatter properties to display as columns in the category events bases view. Configure comma-separated properties in Properties Settings → Bases view properties.

- **Current Interval Bases View**: Added command to view events from the current calendar interval (day/week/month) in a Bases table format. Use "Show current interval in Bases" command to open a modal showing all events within the visible calendar range, with full Bases filtering and sorting capabilities.

- **Keyboard Navigation for Category Modals**: Category assignment and selection modals now support full keyboard navigation. Press Enter to select the first filtered category when searching, or press Enter again to submit the form with selected categories.

### Bug Fixes

- **Fixed Button Text Rendering**: Fixed an issue where event count buttons (filtered, skipped, recurring) would sometimes render their text twice on rerenders. Button text now updates correctly without duplication.

---

## 1.22.3 - 1/5/2026

### Performance Improvements

- **Optimized Category Color Changes**: Changing category colors (and also other settings changes) are now significantly more responsive and no longer causes UI lag. This prevents unnecessary vault-wide rescans when tweaking visual settings.

### Bug Fixes

- **Fixed Excluded Properties in Frontmatter Propagation**: Excluded properties from settings (`excludedRecurringPropagatedProps`) are now properly filtered out during frontmatter propagation to recurring event instances. Excluded props no longer appear in the propagation confirmation modal and are filtered before propagation, preventing unnecessary processing.

---

## 1.22.2 - 1/5/2026

### Bug Fixes

- **Fixed Obsidian Share Import Failure**: Fixed "Request failed. Unsupported URL" when importing shared files into Obsidian.

---

## 1.22.1 - 1/4/2026

### Bug Fixes

- **Fixed Event Synchronization Issues**: Resolved the event synchronization problem mentioned in 1.22.0. Events now consistently appear in the calendar immediately after creation, editing, or duplication. Creating events, duplicating events, and editing events now feels instant and responsive.

---

## 1.22.0 - 12/27/2025

### New Features

- **Navigate Back Command**: Added "Navigate back" command that allows you to quickly return to the previous calendar view. When you navigate to an event's date (e.g., from global search, clicking a date link, or opening an event from a modal), the calendar stores the previous view state. Use the command (or assign a hotkey) to jump back to where you were before. Perfect for quickly navigating between your current view and specific events without losing your place.

- **Quarterly and Semi-Annual Recurring Events**: Added `quarterly` (every 3 months) and `semi-annual` (every 6 months) options to recurring events. Perfect for quarterly reviews, semi-annual checkups, and other regular intervals. Configure with `RRule: quarterly` or `RRule: semi-annual` in frontmatter, or select from the recurring event modal dropdown.

- **Time Tracker Resume Button**: Added a "Resume" button to the time tracker (stopwatch) that appears after stopping the timer. This allows you to continue tracking time without resetting the start time or creating a new event. Perfect for resuming work after breaks or interruptions.
  - **How it works**: When you press "Stop", the timer stops and fills the end time. The "Resume" button appears alongside "Start new" and "Start new (no fill)" buttons.
  - **Resume behavior**: Pressing "Resume" continues the timer from where it left off without modifying the start time or end time fields. The total elapsed time and break time continue to accumulate accurately.
  - **Use case**: Ideal for tracking work sessions with interruptions - stop the timer when interrupted, then resume when you're ready to continue without losing your timing data.

### Bug Fixes

- **Fixed Calendar Indexer Race Condition**: Fixed an issue where newly created events wouldn't appear in the calendar until manual refresh. The calendar now immediately shows new events, even when Obsidian's metadata cache is still processing the file.

---

## 1.21.0 - 12/25/2025

### New Features

- **Mobile Default View Configuration**: Added a separate "Default mobile view" setting that allows you to configure which calendar view to use when opening the calendar on mobile devices (screen width ≤ 768px). The mobile default view is independent from the desktop default view, giving you full control over the mobile calendar experience. Configure it in Settings → Calendar → User Interface → "Default mobile view".

### Improvements

- **Robust Settings Migration**: Settings validation is now more forgiving and robust. When loading settings with extra fields or incorrect values, the system no longer fails or resets all settings. Instead, it gracefully handles invalid or outdated settings by replacing only the problematic fields with their default values while preserving all other valid settings. This makes the plugin more resilient to:
  - Settings from older plugin versions
  - Manually edited settings files with typos or invalid values
  - Settings corrupted by external tools or sync conflicts
  - Missing or partially migrated settings

---

## 1.20.2 - 12/24/2025

### Bug Fixes

- **Fixed ZettelID Preservation with Time Tracker**: Fixed a bug where ZettelIDs were lost when using the time tracker with minimized modals. When creating or editing events with the time tracker running, the system now correctly preserves ZettelIDs and synchronizes file paths. This prevents duplicate files and ensures the minimized modal can be restored with the correct file path, even after renaming events.

---

## 1.20.1 - 12/24/2025

### Improvements

- **Undoable Category Assignment**: Category assignment from the event context menu now uses the command system, making it fully undoable. Previously, category assignments were applied directly to frontmatter without undo support. Now all category assignments (both individual and batch) support undo/redo operations.

- **Hotkey-Configurable Batch Category Assignment**: Added a new command "Batch: Assign categories to selection" that allows you to assign categories to multiple selected events via keyboard shortcut. The command can be assigned a custom hotkey in Obsidian's settings for quick access during batch operations.

---

## 1.20.0 - 12/24/2025

### New Features

- **Category Assignment Everywhere**: Comprehensive category management across all event interactions:
  - **Event Context Menu**: Added "Assign Categories" button in the event tooltip/context menu (appears when you click on an event). Opens the category assignment modal with the event's current categories pre-selected.
  - **Event Modal (Create/Edit)**: Added "Assign Categories" button in the event creation and editing modal. Categories are displayed with their configured colors, and the button allows you to modify categories before saving the event.
  - **Batch Category Assignment**: Added "Categories" button in batch selection mode for assigning categories to multiple events at once.

  All category assignment interfaces feature:
  - **Multi-select with search**: Filter and select multiple categories simultaneously
  - **Pre-selected categories**: Current event categories are automatically checked
  - **Create new categories**: Type a non-existent category name and click "Create New" to add it on the fly with the default event color
  - **Color indicators**: Each category displays its configured color from Settings → Categories
  - **Override behavior**: Assigned categories completely replace existing categories (doesn't merge)
  - **Remove all categories**: Uncheck all categories and click "Remove Categories" to clear categories
  - **Full undo support**: Restores previous category state (batch operations only)
  - **Format support**: Works with both YAML array format (`Category: - Work - Meeting`) and single string format (`Category: Work`)

  See [Categories Documentation](/features/organization/categories) for complete usage instructions, including assignment, color management, and viewing events by category.

- **Time Tracker "Start Without Fill" Button**: Added an optional "Start without fill" button to the time tracker that allows you to begin time tracking without updating the event's start date field.
- **Create Event With Stopwatch Command**: Added a new command "Create new event with stopwatch" that opens the event creation modal with the time tracker automatically started, allowing you to immediately begin tracking time for a new event.
- **Clickable Categories with Bases View**: Categories are now clickable throughout the plugin, opening a Bases table view that shows all events with that category:
  - **Event Modal**: Click any category badge in the event creation/edit modal to view all events with that category
  - **Settings → Categories**: Click any category name in the categories settings page to view all events with that category
  - **Bases Integration**: The category view uses Obsidian Bases to display a sortable, filterable table with all events in that category
  - **Smart Column Layout**: Automatically displays relevant columns (file name, start/end dates, date, status) with optimized sizing
  - **Recent First**: Events are sorted by modification time (most recent first) for easy access to recently updated events
  - **Full Bases Features**: Complete access to Bases functionality including sorting, filtering, and direct note opening

  See [Categories Documentation](/features/organization/categories#viewing-events-by-category) for detailed usage instructions and screenshots.

### Improvements

- **Mobile Event Interaction**: Improved mobile event interaction with intuitive tap gestures. Single tap on any event now opens the context menu, making it easier to access event actions on mobile devices. Double tap opens the event note.
- **Settings Organization**: Reorganized settings for better clarity and usability:
  - General settings now have dedicated sections for Time tracker and Statistics
  - Notification property names moved to Properties tab for single source of truth
  - Notifications tab simplified to focus only on notification behavior and default times

### Bug Fixes

- **Minimized Modal State Synchronization**: Fixed an issue where creating a new event with active time tracking would save the minimized modal state as "create" mode instead of "edit" mode. When restoring the minimized modal, it would attempt to create a duplicate event instead of editing the existing one. The minimized modal manager now correctly updates to "edit" mode with the newly created file path after event creation, ensuring proper synchronization between the modal state and the actual event file.

---

## 1.19.0 - 12/22/2025

### New Features

- **Skip Event Checkbox in Event Modal**: Added a "Skip event" checkbox to the Create/Edit Event modal that allows you to mark events as skipped directly from the form. When checked, the event is hidden from the calendar using the configured skip property. The skip state is preserved in event presets, allowing you to create presets that include skipped events. The checkbox appears when the skip property is configured in Settings → Properties.

### Improvements

- **Better performance and more precise "Fill prev"/"Fill next"**: The "Fill prev" and "Fill next" time-filling features are now much faster and find the correct adjacent events anywhere in your calendar.

### Bug Fixes

- **Fixed Property Removal in Event Editing**: Fixed certain scenarios where removing properties from events didn't apply correctly. The `EditEventCommand` now properly detects and applies property deletions, ensuring that when you remove custom properties or other frontmatter fields from an event, they are correctly deleted from the file's frontmatter.

- **Prevented Prisma Internal Properties in Custom Properties**: Ensured that display properties and other frontmatter properties don't include any Prisma internal properties. Custom properties can no longer overwrite Prisma-managed properties (like status, category, break, skip, recurring event properties, etc.), preventing conflicts and ensuring data integrity. Prisma internal properties are automatically excluded from custom property management in the event modal.

---

## 1.18.2 - 12/22/2025

### Bug Fixes

- **Fixed Color Rule Evaluation Errors**: Fixed an issue where color rules using `.includes()` (like `Category.includes('Work')`) would fail with "Cannot read properties of undefined" errors when the referenced property was missing from event frontmatter. The system now automatically normalizes frontmatter before color evaluation, ensuring properties used with `.includes()` default to empty arrays when missing, preventing evaluation errors and eliminating console warnings.

---
## 1.18.1 - 12/22/2025

### Bug Fixes

- **Fixed Color Rules Not Applying Correctly**: Fixed an issue where color rules would sometimes fail to apply to events, causing them to display with incorrect or default colors. Color evaluation now works consistently across all calendar views.

---

## 1.18.0 - 12/22/2025

### New Features

- **Mark as Not Done in Batch Selection**: Added a new "Mark as Not Done" button in batch selection mode that allows you to mark multiple selected events as not done at once. This complements the existing "Mark as Done" functionality and uses the status property and not done value configured in Settings → Properties. The operation is fully undoable.

- **Highlight Events With Category**: Added a new command that opens a modal to select a category and temporarily highlights all events assigned to that category. The modal displays all available categories from your events in a dropdown, and events are highlighted for 10 seconds. This complements the existing "Highlight events without categories" command, making it easy to visually identify events by category across your calendar.

- **Configurable Default Statistics Grouping**: Added a new setting "Default statistics grouping" in Settings → Parsing that allows you to configure whether statistics modals start grouped by event name or by category. The default is "Event Name", but you can change it to "Category" if you prefer to see category-based statistics by default. You can still toggle between modes within each statistics modal using the "Group by" button.

- **Categories Settings**: Added a new "Categories" section in Settings that provides a convenient interface for managing category colors. The section displays all categories automatically detected from your events, shows the event count for each category, and allows you to configure colors for each category with a color picker. Behind the scenes, category colors are managed as color rules using expressions like `Category.includes('Work')`. The section also includes a pie chart visualization showing the distribution of events across categories with percentages. Categories are read-only (automatically detected from event usage) and sorted by event count. This makes it easy to visually organize and understand your category usage at a glance.

  📖 See [Color Rules Documentation](/features/organization/color-rules#category-color-management) and [Configuration Settings](/configuration/rules#categories-settings) for detailed information.

### Improvements

- **Optimized Default Batch Action Buttons**: To reduce toolbar clutter and keep the batch selection toolbar on a single row, the following buttons are now disabled by default: "Move By", "Open All", "Move Prev", and "Clone Prev". All batch action buttons remain fully configurable in Settings → Calendar → Batch Selection, so you can enable any combination of buttons to match your workflow. Enabling all buttons would cause the toolbar to span two rows, so we've optimized the defaults to show the most commonly used actions while keeping the interface compact. **Note:** All batch operations available via buttons can also be performed using Obsidian commands, which can be assigned custom hotkeys for even faster access. See the [Hotkeys documentation](/features/advanced/hotkeys) for details.

### Bug Fixes

- **Fixed Event Presets Not Preserving Date/Time Values**: Fixed an issue where applying an event preset would incorrectly override the start and end date/time values in the form. Event presets now correctly preserve your existing date/time values and only apply template settings (title, categories, recurring settings, etc.). This ensures that presets work as intended - as reusable templates that don't lock you into specific dates or times.

---

## 1.17.0 - 12/21/2025

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

  📖 See [Recurring Events Documentation](/features/events/recurring-dsl#propagation-modes) and [Configuration Settings](/configuration/event-groups#frontmatter-propagation) for detailed information.

---

## 1.16.0 - 12/20/2025

### New Features

- **Mark as Undone**: Added the ability to mark completed events as "not done" through the context menu. When you right-click on an event that has already been marked as done, you'll now see a "Mark as undone" option instead of "Mark as done". The value used for marking events as undone can be customized in Settings → Properties → "Not done value" (defaults to "Not Done"). This feature works alongside the existing "Mark as done" functionality and is fully undoable.

- **Skip Notifications for Newly Created Events**: Added a new setting "Skip newly created events" (enabled by default) that automatically marks events as notified if they were created within the last minute. This prevents unwanted notifications when creating events via Create Event modal, Stopwatch, or other creation methods. The feature uses the ZettelID timestamp embedded in the filename to detect newly created events. Can be toggled in Settings → Notifications → General.

### Bug Fixes

- **Fixed Expression Filter with Missing Properties**: Fixed expression filters failing when events don't have properties referenced in the filter. Now handles missing properties intelligently: equality checks (`===`) return `false` when the property is missing, while inequality checks (`!==`) return `true`. For example, `Category === 'Reading'` now correctly filters out events without a `Category` property, and `Category !== 'Work'` correctly includes them.

---

## 1.15.1 - 12/20/2025

### Bug Fixes

- **Fixed Events Disappearing on Last Day of Week**: Fixed a timezone conversion bug where events after a certain time (e.g., 3 PM) on the last day of the week would disappear from weekly, daily, and list views. Events now display correctly on the last day of the week regardless of timezone.

---

## 1.15.0 - 12/20/2025

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

## 1.14.2 - 12/18/2025

### Bug Fixes

- **Fixed Stopwatch Break Time Accumulation**: The stopwatch in the event modal now correctly adds break time to any existing break value instead of overriding it. Previously, if an event had 10 minutes of break time and you took a 5-minute break using the stopwatch, it would override the value to 5 minutes instead of accumulating to 15 minutes.

---

## 1.14.1 - 12/16/2025

### Bug Fixes

- **Fixed Generate Past Events Logic**: Corrected the "Generate Past Events" feature to work as intended. The system now properly generates future instances from today (as normal) and additionally backfills all missing past instances from the source event date when the feature is enabled. Previously, it incorrectly shifted all generation to start from the past, which didn't match the expected behavior of maintaining both historical records and future planning.

---

## 1.14.0 - 12/16/2025

### New Features

- **Thicker Hour Lines**: Added a new setting "Thicker hour lines" in Settings → Calendar → User Interface to make full-hour lines (12:00, 13:00, 14:00, etc.) thicker in day and week views for better visual contrast and easier time identification. This setting is enabled by default and helps distinguish major time divisions from minor slot intervals.
- **ICS Import Progress Modal**: When importing ICS files, a progress modal now displays the import status in real-time, showing the number of events being processed and the current event being imported. This prevents users from accidentally triggering multiple imports and provides clear feedback on the import progress. The modal automatically closes when the import completes and shows a summary of imported, skipped, and failed events.
- **Create Event Command**: Added a new "Create new event" command that opens the event creation modal when a calendar view is focused. This command can be triggered via keyboard shortcuts, allowing quick event creation without clicking on the calendar. The event is created at the current time rounded to the nearest hour with the default duration from settings.
- **Generate Past Recurring Events**: Added a new frontmatter property "Generate Past Events" (configurable in Settings → Properties) that allows recurring events to generate instances from the source event's start date instead of from today. When enabled on a recurring event, physical instances are created starting from the source event date onwards, making it possible to track historical recurring events.

### Improvements

- **Recurring Event Type Display**: The "View Recurring Events" modal now displays the recurrence pattern (Daily, Weekly, Bi-weekly, Monthly, Bi-monthly, Yearly) at the top of the modal. For weekly and bi-weekly events, it also shows which days of the week the event occurs on (e.g., "Recurrence: Weekly • Days: Monday, Wednesday, Friday"), making it easier to understand the recurring event pattern at a glance.

---

## 1.13.0 - 12/12/2025

### New Video

- [The Most Advanced Calendar Plugin for Obsidian — Prisma Calendar Feature Showcase (Part 3)](https://www.youtube.com/watch?v=QuTyruv7uhU)

### New Features

- **Open File in New Window**: Added "Open file in new window" option to the event context menu (right-click). This opens the event file in a detached popout window, making it easier to edit complex properties like checkboxes and list properties directly in the markdown editor without leaving the calendar view.

### Bug Fixes

- **Fixed Double Timestamps on Manual Events**: Events created manually with Prisma's ZettelID format (`-YYYYMMDDHHmmss`) no longer get double-timestamped when cloned or moved. The calendar now detects existing Prisma ZettelIDs and preserves them instead of adding a new one, preventing filenames like `Meeting-20250106120000-20250112153045.md`.

---

## 1.12.0 - 12/10/2025

### Improvements

- **Separate Display Properties for All-Day Events**: Added a new setting "Display properties (all-day events)" in Settings → Properties → Frontmatter display, allowing you to configure different frontmatter properties to display for all-day events versus timed events. The existing "Display properties (timed events)" setting now explicitly applies only to timed events. Both settings work independently, giving you full control over which properties appear in each event type.

### Bug Fixes

- **Fixed All-Day Event Drag Offset**: Fixed an issue where all-day events appeared offset from the cursor (approximately 10 pixels below) when dragging, making the drag operation feel misaligned. The event box now follows the cursor correctly for both all-day and timed events.
- **Fixed Highlight Upcoming Event**: The upcoming event highlight now correctly ignores all-day events and only highlights all currently active timed events. Previously, it would highlight all events including all-day events, but now it prioritizes timed events and ignores all-day events completely.

---

## 1.11.0 - 12/9/2025

### New Video

- [Prisma Calendar Tutorial: Build a Real Calendar Workflow in Obsidian (Start to Finish)](https://www.youtube.com/watch?v=aARXf9ehgaw)

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

## 1.10.0 - 12/6/2025

### New Features

#### CalDAV Integration

:::danger SECURITY WARNING
**CalDAV credentials are stored in PLAINTEXT in your vault's `data.json` file.**

- ⚠️ **NEVER use your main account password**
- ✅ **ALWAYS use app-specific passwords** (iCloud, Google, Fastmail all support them)
- 🔒 See [Security Considerations](https://real1tyy.github.io/Prisma-Calendar/features/advanced/integrations#security-considerations) for detailed information

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

## 1.9.0 - 12/5/2025

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

## 1.8.0 - 11/30/2025

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

## 1.7.0 - 11/29/2025

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

---

## 1.6.0 - 11/20/2025

### New Video

1- [The Most Advanced Calendar Plugin for Obsidian — Prisma Calendar Feature Showcase (Part 1)](https://www.youtube.com/watch?v=aULuB6petbU)
- [The Most Advanced Calendar Plugin for Obsidian — Prisma Calendar Feature Showcase (Part 2)](https://www.youtube.com/watch?v=JCYGWltxQQ0)

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

---

## 1.5.0 - 10/30/2025

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

---

## 1.4.0 - 10/28/2025

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

---

## 1.3.0 - 10/10/2025

### New Features
- **Move By Command**: New hotkey command to move selected events by a custom number of days. Allows precise event repositioning with positive or negative day offsets.
- **Auto-mark Past Events**: Automatically mark past events as done during startup. Configure the status property and done value in settings. Runs asynchronously without blocking the main thread.

---

## 1.2.0 - 10/6/2025

### Recurring Events Enhancements
- **Interlinked Recurring Events**: Recurring event instances are now properly interlinked, allowing seamless navigation between occurrences.
- **Source Navigation**: Right-click on any recurring event instance to quickly navigate to the source note that defines the recurrence rule.
- **View All Recurring Events**: New context menu option to view all instances of a recurring event series in a dedicated modal.

---

## 1.1.0 - 9/21/2025
- Initial release of Prisma Calendar
