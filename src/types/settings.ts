import {
	ColorSchema,
	ContextMenuStateSchema,
	normalizeDirectoryPath,
	PageHeaderStateSchema,
	type SettingsStore,
	TabbedContainerStateSchema,
} from "@real1ty-obsidian-plugins";
import { z } from "zod";

import {
	BATCH_BUTTON_IDS,
	DEFAULT_BATCH_ACTION_BUTTONS,
	DEFAULT_CONTEXT_MENU_ITEMS,
	DEFAULT_TOOLBAR_BUTTONS,
} from "../constants";
import {
	computeDedicatedUIPropKeys,
	computeNotificationDedicatedUIPropKeys,
	computeNotificationSystemPropKeys,
	computeSystemPropKeys,
} from "../utils/prop-classifications";
import { AI_DEFAULTS } from "./ai";
import { CalDAVSettingsSchema, ICSSubscriptionSettingsSchema } from "./integrations";
import { CalendarViewTypeSchema, ContextMenuItemSchema, LOCALE_KEYS, ToolbarButtonSchema } from "./view";

// Use library's HolidayType definition
const HolidayTypeSchema = z.enum(["public", "bank", "school", "observance", "optional"]);

const HolidaySettingsSchema = z
	.object({
		enabled: z.boolean().catch(false),
		country: z.string().catch("US"), // ISO country code (HolidaysTypes.Country)
		state: z.string().optional(), // State/province code - ISO 3166-2 (HolidaysTypes.Country)
		region: z.string().optional(), // Region code (HolidaysTypes.Country)
		types: z.array(HolidayTypeSchema).catch(["public"]), // Holiday types (HolidaysTypes.Options)
		timezone: z.string().optional(), // Timezone, e.g. America/New_York (HolidaysTypes.Options)
	})
	.strip();

const EventPresetSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		title: z.string().optional(), // Event title to pre-fill
		allDay: z.boolean().optional(), // Whether this is an all-day event
		categories: z.string().optional(), // Event categories (comma-separated string)
		location: z.string().optional(), // Event location (single string)
		participants: z.string().optional(), // Event participants (comma-separated string)
		breakMinutes: z.number().nonnegative().optional(), // Break time in minutes to subtract from duration
		notifyBefore: z.number().int().nonnegative().optional(), // Override notification timing (minutes for timed, days for all-day)
		markAsDone: z.boolean().optional(), // Mark event as done
		skip: z.boolean().optional(), // Skip/hide event from calendar
		icon: z.string().optional(), // Event icon override (emoji or text)
		rruleType: z.string().optional(), // Recurrence type
		rruleSpec: z.string().optional(), // Weekdays for recurring events
		futureInstancesCount: z.number().int().positive().optional(), // Per-preset override of future instances count
		customProperties: z.record(z.string(), z.unknown()).optional(), // Additional frontmatter properties
		createdAt: z.number().int().positive(), // Timestamp when preset was created
		updatedAt: z.number().int().positive().optional(), // Timestamp when preset was last modified
	})
	.strip();

const GeneralSettingsSchema = z
	.object({
		directory: z
			.string()
			.catch("Tasks")
			.transform(normalizeDirectoryPath)
			.describe("Folder to scan for events and create new events in")
			.meta({ placeholder: "e.g., tasks, calendar, events" }),
		defaultDurationMinutes: z
			.number()
			.int()
			.positive()
			.catch(60)
			.describe("Default event duration when only start time is provided"),
		showDurationField: z
			.boolean()
			.catch(true)
			.describe(
				"Display a duration in minutes field in the event creation/edit modal for quick editing. Changes to duration automatically update the end date, and vice versa."
			),
		showStopwatch: z
			.boolean()
			.catch(true)
			.describe(
				"Display a stopwatch in the event creation/edit modal for precise time tracking. Start fills the start date, stop fills the end date, and break time is tracked automatically."
			),
		showRibbonIcon: z
			.boolean()
			.catch(true)
			.describe("Display an icon in the left sidebar to quickly open this planning system"),
		locale: z
			.enum(LOCALE_KEYS)
			.catch("en")
			.describe("Language and date format for headings, day names, month names, toolbar labels, and date displays"),
		templatePath: z
			.string()
			.optional()
			.describe("Path to Templater template file for new events (optional, requires Templater plugin)")
			.meta({ placeholder: "e.g., Templates/event-template.md" }),
		markPastInstancesAsDone: z
			.boolean()
			.catch(false)
			.describe(
				"Automatically mark past events as done during startup by updating their status property. Configure the status property and done value in the Properties section."
			),
		virtualEventsFileName: z
			.string()
			.catch("Virtual Events")
			.describe("File name for the virtual events storage file (without .md extension)"),
		eventPresets: z.array(EventPresetSchema).catch([]),
		defaultPresetId: z.string().optional(),
		exportFolder: z.string().catch("Prisma-Exports").describe("Folder where exported .ics files are saved"),
		enableKeyboardNavigation: z
			.boolean()
			.catch(true)
			.describe(
				"Use left/right arrow keys to navigate between intervals. Automatically disabled when search or expression filter inputs are focused."
			),
		autoAssignZettelId: z
			.enum(["disabled", "calendarEvents", "allEvents"])
			.catch("disabled")
			.describe(
				"Automatically add a Zettel ID timestamp to filenames of events in the planning system directory that don't have one. Files are renamed from 'My Event.md' to 'My Event-20260216120000.md'."
			),
		indexSubdirectories: z
			.boolean()
			.catch(true)
			.describe(
				"Index event files in all subdirectories of the configured folder, not just the immediate children. When enabled, events stored at any depth (e.g., courses/CS101/assignments/HW1.md) appear in the planning system. When disabled, only files directly inside the configured folder are indexed."
			),
	})
	.strip();

const PropsSettingsSchema = z
	.object({
		startProp: z.string().catch("Start Date").describe("Frontmatter property name for event start date/time"),
		endProp: z
			.string()
			.catch("End Date")
			.describe("Frontmatter property name for event end date/time (for timed events)"),
		dateProp: z.string().catch("Date").describe("Frontmatter property name for all-day events (date only, no time)"),
		allDayProp: z.string().catch("All Day").describe("Frontmatter property name for all-day flag"),
		sortingStrategy: z
			.enum(["none", "startDate", "endDate", "allDayOnly", "allStartDate", "allEndDate"])
			.catch("none")
			.describe(
				"Write a normalized datetime to a dedicated sort property so external tools (Bases, Dataview) can sort all event types by a single field. Timed events use the full datetime. All-day events get T00:00:00 appended for consistent cross-type sorting. The value is written to the sort date property configured below."
			),
		sortDateProp: z
			.string()
			.catch("Sort Date")
			.describe(
				"Frontmatter property to write the normalized datetime to. This is a dedicated sorting property, separate from the Date property used by all-day events."
			),
		titleProp: z
			.string()
			.optional()
			.describe("Frontmatter property name for event title (optional, defaults to file name)")
			.meta({ placeholder: "Title" }),
		calendarTitleProp: z
			.string()
			.catch("Calendar Title")
			.describe(
				"Auto-computed display title property (wiki link with ZettelID stripped from filename). Used for clean rendering in planning system and Bases views. The value is always kept up to date automatically."
			),
		zettelIdProp: z
			.string()
			.optional()
			.describe(
				"Frontmatter property name for auto-generated ZettelID (optional, generates timestamp-based ID on creation/cloning)"
			)
			.meta({ title: "ZettelID property", placeholder: "ZettelID" }),
		skipProp: z
			.string()
			.catch("Skip")
			.describe("Frontmatter property name to hide events from the planning system (when set to true)"),
		rruleProp: z
			.string()
			.catch("RRule")
			.meta({ title: "RRule property" })
			.describe("Frontmatter property name for recurring event type (daily, weekly, monthly, etc.)"),
		rruleSpecProp: z
			.string()
			.catch("RRuleSpec")
			.meta({ title: "RRule specification property" })
			.describe("Frontmatter property name for recurring event specification (weekdays for weekly/bi-weekly events)"),
		rruleUntilProp: z
			.string()
			.catch("RRuleUntil")
			.meta({ title: "RRule until property" })
			.describe("Frontmatter property name for recurring event end date (inclusive last occurrence day)"),
		rruleIdProp: z
			.string()
			.catch("RRuleID")
			.meta({ title: "RRule ID property" })
			.describe("Frontmatter property name for recurring event unique identifier"),
		sourceProp: z
			.string()
			.catch("Source")
			.describe("Frontmatter property name for linking recurring event instances to their source event file"),
		instanceDateProp: z
			.string()
			.catch("Recurring Instance Date")
			.meta({ title: "Recurring instance date property" })
			.describe("Frontmatter property name for the date of a physical recurring event instance"),
		frontmatterDisplayProperties: z
			.array(z.string())
			.catch(["Category"])
			.meta({ title: "Display properties (timed events)" })
			.describe(
				"Comma-separated list of frontmatter property names to display in timed events (events with start and end times). Properties are shown in weekly and daily views, but hidden in monthly view to save space."
			),
		frontmatterDisplayPropertiesAllDay: z
			.array(z.string())
			.catch(["Category"])
			.meta({ title: "Display properties (all-day events)" })
			.describe(
				"Comma-separated list of frontmatter property names to display in all-day events. Properties are shown in weekly and daily views, but hidden in monthly view to save space."
			),
		frontmatterDisplayPropertiesUntracked: z
			.array(z.string())
			.catch(["Category"])
			.meta({ title: "Display properties (untracked events)" })
			.describe(
				"Comma-separated list of frontmatter property names to display in untracked events (events without dates). These appear in the untracked events sidebar."
			),
		frontmatterDisplayPropertiesHeatmap: z
			.array(z.string())
			.catch(["Category"])
			.meta({ title: "Display properties (heatmap)" })
			.describe(
				"Comma-separated list of frontmatter property names to display in the heatmap day detail panel when inspecting events. Properties appear below each event title with links rendered interactively."
			),
		statusProperty: z
			.string()
			.catch("Status")
			.describe("Frontmatter property name for event status (used when automatically marking past events as done)"),
		doneValue: z.string().catch("Done").describe("Value to set in the status property when marking an event as done"),
		notDoneValue: z
			.string()
			.catch("Not Done")
			.describe("Value to set in the status property when marking an event as not done"),
		customDoneProperty: z
			.string()
			.catch("")
			.describe(
				'Overrides the status property for manual mark-as-done actions. Format: "propertyName value" (e.g., "archived true"). When set, this is used instead of the status property. Leave empty to use the default behavior.'
			)
			.meta({ placeholder: "archived true" }),
		customUndoneProperty: z
			.string()
			.catch("")
			.describe(
				'Overrides what happens when marking as undone. Format: "propertyName value" (e.g., "archived false"). Requires "Custom done property" to be configured. If empty, the custom done property key is removed on undone instead.'
			)
			.meta({ placeholder: "archived false" }),
		categoryProp: z
			.string()
			.catch("Category")
			.describe("Frontmatter property name for event categories (used for grouping in statistics)"),
		locationProp: z.string().catch("Location").describe("Frontmatter property name for event location (single string)"),
		participantsProp: z
			.string()
			.catch("Participants")
			.describe(
				"Frontmatter property name for event participants (array of strings, supports comma-separated in YAML)"
			),
		breakProp: z
			.string()
			.catch("Break")
			.describe(
				"Frontmatter property name for break time in minutes (subtracted from event duration in statistics, supports decimals)"
			),
		futureInstancesCountProp: z
			.string()
			.catch("Future Instances Count")
			.describe(
				"Frontmatter property name for per-event override of future instances count (defaults to global setting if not specified)"
			),
		generatePastEventsProp: z
			.string()
			.catch("Generate Past Events")
			.describe(
				"Frontmatter property name for generating past recurring instances from source event start date (set to true to enable)"
			),
		caldavProp: z
			.string()
			.catch("CalDAV")
			.meta({ title: "CalDAV property" })
			.describe("Frontmatter property name for CalDAV integration metadata on synced events"),
		icsSubscriptionProp: z
			.string()
			.catch("ICSSubscription")
			.meta({ title: "ICS subscription property" })
			.describe("Frontmatter property name for ICS subscription metadata on synced events"),
		iconProp: z
			.string()
			.catch("Icon")
			.describe(
				"Frontmatter property name for event icon override (emoji or text, takes precedence over integration and recurring icons)"
			),
		prerequisiteProp: z
			.string()
			.catch("Prerequisite")
			.describe(
				"Frontmatter property name for event prerequisites (wiki-links to other events that must complete before this event)"
			),
		basesViewProperties: z
			.array(z.string())
			.catch([])
			.describe(
				"Comma-separated list of frontmatter properties to include as columns in Bases views. These properties will appear after the default columns (file name, date, status)."
			),
		basesViewType: z
			.enum(["table", "cards", "list"])
			.catch("cards")
			.describe(
				"Choose the default view type for Bases views (category events, interval views). Cards view displays events as visual cards, table view as a sortable table, and list view as a simple list."
			),
	})
	.strip();

/**
 * Settings keys for per-instance system properties (timing, identity, recurrence).
 * Derived from PROP_CLASSIFICATIONS in event-metadata.ts.
 * When adding a new frontmatter property, add it to the registry instead.
 */
export const SYSTEM_PROP_KEYS = computeSystemPropKeys();

/**
 * Settings keys for properties that have dedicated UI controls in the edit modal.
 * Derived from PROP_CLASSIFICATIONS in event-metadata.ts.
 * When adding a new property with its own modal control, add it to the registry instead.
 */
export const DEDICATED_UI_PROP_KEYS = computeDedicatedUIPropKeys();

const NotificationsSettingsSchema = z
	.object({
		enableNotifications: z
			.boolean()
			.catch(true)
			.describe("Enable event notifications. When disabled, all notification settings below are ignored."),
		notificationSound: z.boolean().catch(false).describe("Play a system sound when notifications are shown"),
		snoozeMinutes: z
			.number()
			.int()
			.positive()
			.catch(15)
			.describe(
				"How many minutes to snooze a notification when pressing the Snooze button. The notification will be triggered again after this duration."
			),
		skipNewlyCreatedNotifications: z
			.boolean()
			.catch(true)
			.describe(
				"Automatically mark events as notified if they were created within the last minute. Prevents notifications for events created via Create Event, Stopwatch, or other creation methods."
			),
		defaultMinutesBefore: z.number().int().nonnegative().optional(),
		minutesBeforeProp: z
			.string()
			.catch("Minutes Before")
			.describe("Frontmatter property name for per-event notification times (timed events)"),
		defaultDaysBefore: z.number().int().nonnegative().optional(),
		daysBeforeProp: z
			.string()
			.catch("Days Before")
			.describe("Frontmatter property name for per-event notification days (all-day events)"),
		alreadyNotifiedProp: z
			.string()
			.catch("Already Notified")
			.describe("Frontmatter property name to mark events as already notified"),
	})
	.strip();

/**
 * Notification settings keys derived from PROP_CLASSIFICATIONS in event-metadata.ts.
 */
export const NOTIFICATION_SYSTEM_PROP_KEYS = computeNotificationSystemPropKeys();
export const NOTIFICATION_DEDICATED_UI_PROP_KEYS = computeNotificationDedicatedUIPropKeys();

const FilterPresetSchema = z
	.object({
		name: z.string(),
		expression: z.string(),
	})
	.strip();

const CategoryAssignmentPresetSchema = z
	.object({
		id: z.string(),
		eventName: z.string(), // Event name(s) to match (comma-separated, case-insensitive, without ZettelID)
		categories: z.array(z.string()), // Categories to assign
	})
	.strip();

const BatchActionButtonSchema = z.enum(BATCH_BUTTON_IDS as [string, ...string[]]);

const CalendarSettingsSchema = z
	.object({
		futureInstancesCount: z
			.number()
			.int()
			.min(1)
			.max(52)
			.catch(2)
			.describe("Maximum number of future recurring event instances to generate (1-52)"),
		propagateFrontmatterToInstances: z
			.boolean()
			.catch(false)
			.describe(
				"Automatically propagate frontmatter changes from recurring event sources to all physical instances. When you update custom properties (like category, priority, status) in a source event, all existing instances are updated immediately."
			),
		askBeforePropagatingFrontmatter: z
			.boolean()
			.catch(false)
			.describe(
				"Show a confirmation modal before propagating frontmatter changes to instances. Allows you to review changes before applying them."
			),
		excludedRecurringInstanceProps: z
			.string()
			.catch("")
			.describe(
				"Comma-separated list of frontmatter property names to exclude when propagating changes from recurring event sources to physical instances."
			)
			.meta({ placeholder: "tags, internal_id" }),
		enableNameSeriesTracking: z
			.boolean()
			.catch(true)
			.describe(
				"Track name-based event series (groups events sharing the same title). Used for name series propagation and series views. Disable to reduce memory usage in large vaults."
			),
		propagateFrontmatterToNameSeries: z
			.boolean()
			.catch(false)
			.describe(
				"Automatically propagate frontmatter changes across events that share the same title. When you update custom properties on one event, all other events with the same name are updated immediately."
			),
		askBeforePropagatingToNameSeries: z
			.boolean()
			.catch(false)
			.describe(
				"Show a confirmation modal before propagating frontmatter changes to name series members. Allows you to review changes before applying them."
			),
		excludedNameSeriesProps: z
			.string()
			.catch("")
			.describe(
				"Comma-separated list of frontmatter property names to exclude when propagating changes across name series members."
			)
			.meta({ placeholder: "tags, internal_id" }),
		propagateFrontmatterToCategorySeries: z
			.boolean()
			.catch(false)
			.describe(
				"Automatically propagate frontmatter changes across events that share the same category. When you update custom properties on one event, all other events with the same category are updated immediately."
			),
		askBeforePropagatingToCategorySeries: z
			.boolean()
			.catch(false)
			.describe(
				"Show a confirmation modal before propagating frontmatter changes to category series members. Allows you to review changes before applying them."
			),
		excludedCategorySeriesProps: z
			.string()
			.catch("")
			.describe(
				"Comma-separated list of frontmatter property names to exclude when propagating changes across category series members."
			)
			.meta({ placeholder: "tags, internal_id" }),
		defaultView: CalendarViewTypeSchema.catch("timeGridWeek"),
		defaultMobileView: CalendarViewTypeSchema.catch("timeGridWeek"),
		hideWeekends: z.boolean().catch(false).describe("Hide Saturday and Sunday in calendar views"),
		showDecimalHours: z
			.boolean()
			.catch(false)
			.describe(
				"Display durations as decimal hours (e.g., 2.5h) instead of formatted (e.g., 2h 30m) in statistics modals. Can be temporarily toggled by clicking the duration in the statistics header."
			),
		defaultAggregationMode: z
			.enum(["name", "category"])
			.catch("name")
			.describe("Default grouping mode for statistics modals: group by event name or by category"),
		capacityTrackingEnabled: z
			.boolean()
			.catch(true)
			.describe(
				"Show used vs remaining hours in statistics and page header. Boundaries are inferred from the earliest and latest events in each period."
			),
		hourStart: z.number().int().min(0).max(23).catch(7).describe("First hour to show in time grid views"),
		hourEnd: z.number().int().min(1).max(24).catch(23).describe("Last hour to show in time grid views"),
		firstDayOfWeek: z.number().int().min(0).max(6).catch(0), // 0 = Sunday, 1 = Monday, etc.
		slotDurationMinutes: z
			.number()
			.int()
			.min(1)
			.max(60)
			.catch(30)
			.describe("Duration of time slots in the calendar grid (1-60 minutes)"),
		snapDurationMinutes: z
			.number()
			.int()
			.min(1)
			.max(60)
			.catch(30)
			.describe("Snap interval when dragging or resizing events (1-60 minutes)"),
		zoomLevels: z.array(z.number().int().min(1).max(60)).catch([1, 2, 3, 5, 10, 15, 20, 30, 45, 60]), // available zoom levels for slot duration
		density: z.enum(["comfortable", "compact"]).catch("comfortable"),
		enableEventPreview: z.boolean().catch(true).describe("Show preview of event notes when hovering over events"),
		nowIndicator: z.boolean().catch(true).describe("Display a line showing the current time in weekly and daily views"),
		highlightUpcomingEvent: z
			.boolean()
			.catch(true)
			.describe(
				"Subtly highlight events that are currently active (if any), or the next upcoming event. Only visible when the current time is within the visible date range."
			),
		thickerHourLines: z
			.boolean()
			.catch(true)
			.describe("Make full-hour lines (12:00, 13:00, etc.) thicker in day and week views for better visual contrast"),
		pastEventContrast: z
			.number()
			.int()
			.min(0)
			.max(100)
			.catch(70)
			.describe("Visual contrast of past events (0% = invisible, 100% = normal)"),
		eventOverlap: z
			.boolean()
			.catch(true)
			.describe(
				"Allow events with overlapping times to render on top of each other. When disabled, overlapping events render side-by-side in columns (like Google Calendar). Applies to all views."
			),
		slotEventOverlap: z
			.boolean()
			.catch(true)
			.describe(
				"In week/day time-grid views, allow events that share the exact same time-slot boundaries to render on top of each other. When disabled, events with identical start/end times are placed in separate columns within the slot. Has no effect when event overlap is disabled."
			),
		eventMaxStack: z
			.number()
			.int()
			.min(1)
			.max(10)
			.catch(4)
			.describe("Maximum number of events to stack vertically before showing '+ more' link"),
		desktopMaxEventsPerDay: z
			.number()
			.int()
			.min(0)
			.max(20)
			.catch(0)
			.describe("Maximum events to show per day on desktop before showing '+more' link (0 = unlimited)"),
		mobileMaxEventsPerDay: z
			.number()
			.int()
			.min(0)
			.max(20)
			.catch(4)
			.describe("Maximum events to show per day on mobile before showing '+more' link (0 = unlimited)"),
		showColorDots: z
			.boolean()
			.catch(true)
			.describe("Show color indicator dots at the top of each day in month and year views"),
		skipUnderscoreProperties: z
			.boolean()
			.catch(true)
			.describe(
				"Hide frontmatter properties that start with underscore (e.g., _ZettelID) in event previews and edit modals"
			),
		filterPresets: z.array(FilterPresetSchema).catch([]), // Named filter expressions for quick access
		dragEdgeScrollDelayMs: z
			.number()
			.int()
			.min(50)
			.max(2000)
			.catch(600)
			.describe("Delay in milliseconds before scrolling when dragging events near the edge"),
		batchActionButtons: z.array(BatchActionButtonSchema).catch([...DEFAULT_BATCH_ACTION_BUTTONS]), // Which batch action buttons to show in batch selection mode toolbar
		toolbarButtons: z.array(ToolbarButtonSchema).catch([...DEFAULT_TOOLBAR_BUTTONS]), // Which buttons to show in the calendar toolbar (desktop)
		mobileToolbarButtons: z.array(ToolbarButtonSchema).catch([...DEFAULT_TOOLBAR_BUTTONS]), // Which buttons to show in the calendar toolbar (mobile)
		stickyDayHeaders: z
			.boolean()
			.catch(true)
			.describe("Keep day/date headers visible at the top when scrolling down in weekly and daily views"),
		stickyAllDayEvents: z
			.boolean()
			.catch(true)
			.describe("Keep all-day event section visible at the top when scrolling down in weekly and daily views"),
		allDayEventHeight: z
			.number()
			.int()
			.min(30)
			.max(500)
			.catch(75)
			.describe("Maximum height in pixels for all-day events section before overflow"),
		autoAssignCategoryByName: z
			.boolean()
			.catch(true)
			.describe(
				"Automatically assign a category when the event name (without ZettelID) matches a category name (case-insensitive). Example: creating an event named 'Health' will auto-assign the 'health' category."
			),
		autoAssignCategoryByIncludes: z
			.boolean()
			.catch(false)
			.describe(
				"Use substring matching (case-insensitive) for category auto-assignment and category assignment presets. When enabled, categories match if the event name contains the category name, and preset event names match if the event name contains the preset name. Example: 'Youtube Analysis' matches the 'Youtube' category and a preset with event name 'Youtube'."
			),
		titleAutocomplete: z
			.boolean()
			.catch(true)
			.describe(
				"Show inline type-ahead suggestions when typing event titles in the create/edit modal. Suggests categories, event presets, and frequently used event names."
			),
		categoryAssignmentPresets: z.array(CategoryAssignmentPresetSchema).catch([]), // Custom category assignment rules based on event name
		activeTab: TabbedContainerStateSchema.optional().catch(undefined), // Persisted tab state (active tab, visibility, order)
		pageHeaderState: PageHeaderStateSchema.optional().catch(undefined), // Persisted page header button state
		contextMenuItems: z.array(ContextMenuItemSchema).catch([...DEFAULT_CONTEXT_MENU_ITEMS]), // Legacy: simple list of enabled item IDs (kept for backward compatibility)
		contextMenuState: ContextMenuStateSchema.optional().catch(undefined), // Persisted context menu state (order, renames, icons, colors)
		ganttContextMenuState: ContextMenuStateSchema.optional().catch(undefined), // Persisted gantt bar context menu state
		showSourceRecurringMarker: z
			.boolean()
			.catch(true)
			.describe("Display a marker indicator on source recurring events (the original event that generates instances)."),
		showPhysicalRecurringMarker: z
			.boolean()
			.catch(true)
			.describe(
				"Display a marker indicator on physical recurring instance events (actual instances created from source)."
			),
		sourceRecurringMarker: z
			.string()
			.catch("⦿")
			.describe("Symbol/emoji to display on source recurring events in the top-right corner."),
		physicalRecurringMarker: z
			.string()
			.catch("🔄")
			.describe("Symbol/emoji to display on physical recurring instance events in the top-right corner."),
		showDurationInTitle: z
			.boolean()
			.catch(true)
			.describe("Display event duration (e.g., 2h 30m) in parentheses after the event title for timed events"),
		dayCellColoring: z.enum(["off", "uniform", "boundary"]).catch("off" as const), // Day cell background coloring mode: off, uniform single color, or alternating by month boundary
		monthEvenColor: ColorSchema.catch("#131313"), // Background color for even months / uniform day background
		monthOddColor: ColorSchema.catch("#6b9080"), // Background color for odd months
		eventTextColor: ColorSchema.catch("#ffffff"), // Default text color for events (used when it has sufficient contrast on background)
		eventTextColorAlt: ColorSchema.catch("#000000"), // Alternative text color (used when default has poor contrast)
		connectionColor: ColorSchema.catch("#7c3aed"), // Color of prerequisite connection arrows
		connectionStrokeWidth: z
			.number()
			.int()
			.min(1)
			.max(10)
			.catch(3)
			.describe("Thickness of connection arrow lines in pixels"),
		connectionArrowSize: z.number().int().min(4).max(24).catch(12).describe("Size of connection arrowheads in pixels"),
		fileConcurrencyLimit: z
			.number()
			.int()
			.min(1)
			.max(50)
			.catch(10)
			.meta({ title: "File operation concurrency limit" })
			.describe(
				"Maximum number of files to modify in parallel. Lower values reduce the risk of Obsidian freezing on large batch operations. Applies to recurring event propagation, name/category series propagation, and file deletions."
			),
	})
	.strip();

const RulesSettingsSchema = z
	.object({
		filterExpressions: z
			.array(z.string())
			.catch([])
			.describe(
				"JavaScript expressions to filter events (one per line). Changes apply when you click outside or press Ctrl/Cmd+Enter. Note: Expect a brief lag when applying changes as it triggers full re-indexing."
			),
		untrackedFilterExpressions: z
			.array(z.string())
			.catch([])
			.describe(
				"JavaScript expressions to filter untracked events (one per line). Changes apply when you click outside or press Ctrl/Cmd+Enter."
			),
		colorMode: z
			.enum(["off", "1", "2", "3", "4", "5"])
			.catch("1")
			.describe(
				"Controls how many color rule matches are applied to each event. Off: no coloring. 1: single color (default). 2-5: split the event width into equal segments, each colored by a successive matching rule."
			),
		showEventColorDots: z
			.boolean()
			.catch(false)
			.describe(
				"Show color dots in the bottom-right corner of events for matched color rules that were not applied as the event background. Displays overflow colors that exceed the color mode limit, or all matched colors when coloring is disabled."
			),
		defaultNodeColor: ColorSchema.catch("hsl(270, 70%, 50%)"), // Default purple color
		colorRules: z
			.array(
				z
					.object({
						id: z.string(),
						expression: z.string(), // JavaScript expression to evaluate against frontmatter
						color: ColorSchema, // Color to apply if expression evaluates to true
						enabled: z.boolean().catch(true),
					})
					.strip()
			)
			.catch([]),
	})
	.strip();

const CustomPromptSchema = z
	.object({
		id: z.string(),
		title: z.string(),
		content: z.string(),
	})
	.strip();

const AISettingsSchema = z
	.object({
		openaiApiKeySecretName: z.string().catch(""),
		anthropicApiKeySecretName: z.string().catch(""),
		aiModel: z.string().catch(AI_DEFAULTS.DEFAULT_MODEL),
		aiBatchExecution: z
			.boolean()
			.catch(AI_DEFAULTS.DEFAULT_BATCH_EXECUTION)
			.describe(
				"When enabled, all AI-suggested operations execute as a single batch — one undo reverts everything. When disabled, each operation is a separate undo entry."
			),
		aiConfirmExecution: z
			.boolean()
			.catch(AI_DEFAULTS.DEFAULT_CONFIRM_EXECUTION)
			.describe(
				"When enabled, AI-suggested operations show a preview with an Execute button. When disabled, operations execute immediately without confirmation."
			),
		customPrompts: z.array(CustomPromptSchema).catch([]),
		aiPlanningGapDetection: z
			.boolean()
			.catch(AI_DEFAULTS.DEFAULT_PLANNING_GAP_DETECTION)
			.describe("Validate that AI-planned events are contiguous with no gaps between consecutive events."),
		aiPlanningDayCoverage: z
			.boolean()
			.catch(AI_DEFAULTS.DEFAULT_PLANNING_DAY_COVERAGE)
			.describe("Validate that AI plans cover every day in the interval."),
	})
	.strip();

export const SingleCalendarConfigSchema = GeneralSettingsSchema.extend(PropsSettingsSchema.shape)
	.extend(CalendarSettingsSchema.shape)
	.extend(RulesSettingsSchema.shape)
	.extend(NotificationsSettingsSchema.shape)
	.extend({
		id: z.string(),
		name: z.string().catch("Calendar"),
		enabled: z.boolean().catch(true),
		holidays: HolidaySettingsSchema.catch(HolidaySettingsSchema.parse({})),
	})
	.strip();

export const CustomCalendarSettingsSchema = z
	.object({
		licenseKeySecretName: z.string().catch(""),
		version: z.string().catch("1.1.0"),
		calendars: z
			.array(SingleCalendarConfigSchema)
			.min(1)
			.catch([
				{
					id: "default",
					name: "Calendar",
					enabled: true,
					...GeneralSettingsSchema.parse({}),
					...PropsSettingsSchema.parse({}),
					...CalendarSettingsSchema.parse({}),
					...RulesSettingsSchema.parse({}),
					...NotificationsSettingsSchema.parse({}),
					holidays: HolidaySettingsSchema.parse({}),
				},
			]),
		ai: AISettingsSchema.catch(AISettingsSchema.parse({})),
		caldav: CalDAVSettingsSchema.catch(CalDAVSettingsSchema.parse({})),
		icsSubscriptions: ICSSubscriptionSettingsSchema.catch(ICSSubscriptionSettingsSchema.parse({})),
	})
	.strip();

export type CustomPrompt = z.infer<typeof CustomPromptSchema>;
export type FilterPreset = z.infer<typeof FilterPresetSchema>;
export type CategoryAssignmentPreset = z.infer<typeof CategoryAssignmentPresetSchema>;
export type EventPreset = z.infer<typeof EventPresetSchema>;
export type SingleCalendarConfig = z.infer<typeof SingleCalendarConfigSchema>;
export type CustomCalendarSettings = z.infer<typeof CustomCalendarSettingsSchema>;
export type PrismaCalendarSettingsStore = SettingsStore<typeof CustomCalendarSettingsSchema>;

// ─── Sync-Persisted Plugin State ─────────────────────────────────────

export const PrismaSyncDataSchema = z
	.object({
		readOnly: z.boolean().catch(false),
		lastUsedCalendarId: z.string().optional(),
	})
	.strip();
