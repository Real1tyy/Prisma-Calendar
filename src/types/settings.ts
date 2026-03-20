import {
	normalizeDirectoryPath,
	PageHeaderStateSchema,
	type SettingsStore,
	TabbedContainerStateSchema,
} from "@real1ty-obsidian-plugins";
import { z } from "zod";

import {
	BATCH_BUTTON_IDS,
	DEFAULT_BATCH_ACTION_BUTTONS,
	DEFAULT_CONNECTION_ARROW_SIZE,
	DEFAULT_CONNECTION_COLOR,
	DEFAULT_CONNECTION_STROKE_WIDTH,
	DEFAULT_CONTEXT_MENU_ITEMS,
	DEFAULT_EVENT_COLOR,
	DEFAULT_EVENT_TEXT_COLOR,
	DEFAULT_EVENT_TEXT_COLOR_ALT,
	DEFAULT_EXPORT_FOLDER,
	DEFAULT_MONTH_EVEN_COLOR,
	DEFAULT_MONTH_ODD_COLOR,
	DEFAULT_PHYSICAL_RECURRING_MARKER,
	DEFAULT_SOURCE_RECURRING_MARKER,
	DEFAULT_TOOLBAR_BUTTONS,
	DEFAULT_ZOOM_LEVELS,
	PROP_DEFAULTS,
} from "../constants";
import { ColorSchema } from "../utils/validation";
import { AI_DEFAULTS } from "./ai";
import { CalDAVSettingsSchema } from "./integrations";
import { ICSSubscriptionSettingsSchema } from "./integrations";
import { CalendarViewTypeSchema, ContextMenuItemSchema, ToolbarButtonSchema } from "./view";

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
		directory: z.string().catch("").transform(normalizeDirectoryPath),
		defaultDurationMinutes: z.number().int().positive().catch(60),
		showDurationField: z.boolean().catch(true), // show duration in minutes field in event modal for quick editing
		showStopwatch: z.boolean().catch(true), // show stopwatch in event modal for precise time tracking
		showStopwatchStartWithoutFill: z.boolean().catch(false), // show "continue" button that continues tracking from existing start time without creating a new one
		showRibbonIcon: z.boolean().catch(true), // show ribbon icon in left sidebar to open calendar
		locale: z.string().catch("en"), // locale for calendar display language and date formatting
		templatePath: z.string().optional(), // path to Templater template for new events
		markPastInstancesAsDone: z.boolean().catch(false), // automatically mark past events as done on startup
		eventPresets: z.array(EventPresetSchema).catch([]), // Event creation presets with pre-filled values
		defaultPresetId: z.string().optional(), // ID of default preset to auto-fill on create modal open
		exportFolder: z.string().catch(DEFAULT_EXPORT_FOLDER), // folder for ICS exports
		enableKeyboardNavigation: z.boolean().catch(true), // enable arrow key navigation for calendar intervals
		autoAssignZettelId: z.enum(["disabled", "calendarEvents", "allEvents"]).catch("disabled"), // automatically assign ZettelID to files in calendar directory: disabled, calendar events only (timed + all-day), or all events (including untracked)
	})
	.strip();

const PropsSettingsSchema = z
	.object({
		startProp: z.string().catch(PROP_DEFAULTS.start),
		endProp: z.string().catch(PROP_DEFAULTS.end),
		dateProp: z.string().catch(PROP_DEFAULTS.date), // property name for all-day events (date only, no time)
		allDayProp: z.string().catch(PROP_DEFAULTS.allDay),
		sortingStrategy: z.enum(["none", "startDate", "endDate", "allDayOnly", "allStartDate", "allEndDate"]).catch("none"), // sorting normalization strategy: write normalized datetime to sort date property
		sortDateProp: z.string().catch(PROP_DEFAULTS.sortDate), // dedicated sort date property for normalized datetime values
		titleProp: z.string().optional(), // optional; fallback to file name
		calendarTitleProp: z.string().catch(PROP_DEFAULTS.calendarTitle), // auto-computed display title (wiki link with zettel ID stripped) for clean rendering in calendar and Bases views
		zettelIdProp: z.string().optional(), // optional; property name for ZettelID generation
		skipProp: z.string().catch(PROP_DEFAULTS.skip), // property name to skip/hide event from calendar
		rruleProp: z.string().catch(PROP_DEFAULTS.rrule), // property name for RRule type (daily, weekly, etc.)
		rruleSpecProp: z.string().catch(PROP_DEFAULTS.rruleSpec), // property name for RRule specification (weekdays, etc.)
		rruleIdProp: z.string().catch(PROP_DEFAULTS.rruleId), // property name for recurring event ID
		sourceProp: z.string().catch(PROP_DEFAULTS.source), // property name for linking physical instances to their source recurring event
		instanceDateProp: z.string().catch("Recurring Instance Date"), // property name for recurring event instance date
		frontmatterDisplayProperties: z.array(z.string()).catch([]), // frontmatter properties to display inside timed event chips
		frontmatterDisplayPropertiesAllDay: z.array(z.string()).catch([]), // frontmatter properties to display inside all-day event chips
		frontmatterDisplayPropertiesUntracked: z.array(z.string()).catch([]), // frontmatter properties to display inside untracked event chips
		frontmatterDisplayPropertiesHeatmap: z.array(z.string()).catch([]), // frontmatter properties to display inside heatmap day detail rows
		statusProperty: z.string().catch(PROP_DEFAULTS.status), // property name to manage event status
		doneValue: z.string().catch(PROP_DEFAULTS.doneValue), // value to set when marking event as done
		notDoneValue: z.string().catch(PROP_DEFAULTS.notDoneValue), // value to set when marking event as not done
		customDoneProperty: z.string().catch(""), // DSL expression for additional property to set when marking as done (format: "propertyName value")
		customUndoneProperty: z.string().catch(""), // DSL expression for additional property to set when marking as undone (format: "propertyName value"), requires customDoneProperty
		categoryProp: z.string().catch(PROP_DEFAULTS.category), // property name for event categories used in statistics
		locationProp: z.string().catch(PROP_DEFAULTS.location), // property name for event location (single string)
		participantsProp: z.string().catch(PROP_DEFAULTS.participants), // property name for event participants (array of strings)
		breakProp: z.string().catch(PROP_DEFAULTS.break), // property name for break time in minutes (subtracted from duration in statistics)
		futureInstancesCountProp: z.string().catch(PROP_DEFAULTS.futureInstancesCount), // property name for per-event override of future instances count
		generatePastEventsProp: z.string().catch(PROP_DEFAULTS.generatePastEvents), // property name for generating past recurring instances from source event start date
		ignoreRecurringProp: z.string().catch(PROP_DEFAULTS.ignoreRecurring), // property name for ignoring duplicated recurring events from future instance generation
		caldavProp: z.string().catch("CalDAV"), // property name for CalDAV sync metadata
		icsSubscriptionProp: z.string().catch("ICSSubscription"), // property name for ICS subscription sync metadata
		iconProp: z.string().catch(PROP_DEFAULTS.icon), // property name for event icon override (emoji or text, takes precedence over integration icons)
		prerequisiteProp: z.string().catch(PROP_DEFAULTS.prerequisite), // property name for event prerequisites (wiki-links to other events that must complete first)
		basesViewProperties: z.array(z.string()).catch([]), // comma-separated list of properties to include in bases view for category events
		basesViewType: z.enum(["table", "cards", "list"]).catch("cards"), // view type for bases views (table, cards, or list)
	})
	.strip();

type PropsKey = keyof z.infer<typeof PropsSettingsSchema>;

/**
 * Settings keys for per-instance system properties (timing, identity, recurrence).
 * These are NOT copied from source recurring events to physical instances.
 * When adding a new frontmatter property to the schema, add it here if Prisma
 * manages it per-instance (the value differs between source and instance).
 */
export const SYSTEM_PROP_KEYS: PropsKey[] = [
	"startProp",
	"endProp",
	"dateProp",
	"breakProp",
	"titleProp",
	"calendarTitleProp",
	"allDayProp",
	"rruleProp",
	"rruleSpecProp",
	"rruleIdProp",
	"sourceProp",
	"skipProp",
	"instanceDateProp",
	"zettelIdProp",
	"futureInstancesCountProp",
	"caldavProp",
	"icsSubscriptionProp",
	"generatePastEventsProp",
	"ignoreRecurringProp",
];

/**
 * Settings keys for properties that have dedicated UI controls in the edit modal
 * (category picker, prerequisite assigner, icon input, etc.).
 * These must NOT appear in the "Custom Properties" section — otherwise the custom
 * properties form will overwrite values set by the dedicated UI on save.
 * When adding a new frontmatter property with its own modal control, add it here.
 */
export const DEDICATED_UI_PROP_KEYS: PropsKey[] = [
	"statusProperty",
	"categoryProp",
	"prerequisiteProp",
	"iconProp",
	"locationProp",
	"participantsProp",
];

const NotificationsSettingsSchema = z
	.object({
		enableNotifications: z.boolean().catch(true),
		notificationSound: z.boolean().catch(false), // whether to play sound with notifications
		snoozeMinutes: z.number().int().positive().catch(15), // how many minutes to snooze notifications
		skipNewlyCreatedNotifications: z.boolean().catch(true), // skip notifications for events created within the last minute
		defaultMinutesBefore: z.number().int().nonnegative().optional(), // minutes before event to notify, undefined = no default notification
		minutesBeforeProp: z.string().catch(PROP_DEFAULTS.minutesBefore), // frontmatter property to read per-event notification times
		defaultDaysBefore: z.number().int().nonnegative().optional(), // days before all-day event to notify, undefined = no default notification
		daysBeforeProp: z.string().catch(PROP_DEFAULTS.daysBefore), // frontmatter property to read per-event notification days for all-day events
		alreadyNotifiedProp: z.string().catch(PROP_DEFAULTS.alreadyNotified), // frontmatter property to mark events as already notified
	})
	.strip();

type NotificationsKey = keyof z.infer<typeof NotificationsSettingsSchema>;

/**
 * Notification settings keys that map to frontmatter properties.
 * alreadyNotifiedProp is a system prop (per-instance), while minutesBefore/daysBefore
 * have dedicated UI controls in the edit modal.
 */
export const NOTIFICATION_SYSTEM_PROP_KEYS: NotificationsKey[] = ["alreadyNotifiedProp"];
export const NOTIFICATION_DEDICATED_UI_PROP_KEYS: NotificationsKey[] = ["minutesBeforeProp", "daysBeforeProp"];

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
		futureInstancesCount: z.number().int().min(1).max(52).catch(2), // how many future instances to generate for recurring events
		propagateFrontmatterToInstances: z.boolean().catch(false), // automatically propagate non-Prisma frontmatter changes from source to physical instances
		askBeforePropagatingFrontmatter: z.boolean().catch(true), // show confirmation modal before propagating frontmatter changes
		enableNameSeriesTracking: z.boolean().catch(true), // enable name-based series tracking (groups events by title for propagation and series views)
		propagateFrontmatterToNameSeries: z.boolean().catch(false), // automatically propagate frontmatter changes across name-based series (events sharing the same title)
		askBeforePropagatingToNameSeries: z.boolean().catch(false), // show confirmation modal before propagating frontmatter changes to name series
		propagateFrontmatterToCategorySeries: z.boolean().catch(false), // automatically propagate frontmatter changes across category-based series (events sharing the same category)
		askBeforePropagatingToCategorySeries: z.boolean().catch(false), // show confirmation modal before propagating frontmatter changes to category series
		excludedRecurringPropagatedProps: z.string().catch(""), // comma-separated list of frontmatter properties to exclude from propagation
		propagationDebounceMs: z.number().int().min(100).max(10000).catch(3000), // debounce delay in milliseconds before propagating frontmatter changes to instances
		defaultView: CalendarViewTypeSchema.catch("dayGridMonth"),
		defaultMobileView: CalendarViewTypeSchema.catch("dayGridMonth"),
		hideWeekends: z.boolean().catch(false),
		showDecimalHours: z.boolean().catch(false), // Show durations as decimal hours (e.g., 2.5h) instead of formatted (e.g., 2h 30m)
		defaultAggregationMode: z.enum(["name", "category"]).catch("name"), // Default aggregation mode for statistics (name or category)
		capacityTrackingEnabled: z.boolean().catch(true), // Show capacity tracking (used vs remaining hours) in stats and page header
		hourStart: z.number().int().min(0).max(23).catch(7),
		hourEnd: z.number().int().min(1).max(24).catch(23),
		firstDayOfWeek: z.number().int().min(0).max(6).catch(0), // 0 = Sunday, 1 = Monday, etc.
		slotDurationMinutes: z.number().int().min(1).max(60).catch(30), // time slot duration in minutes
		snapDurationMinutes: z.number().int().min(1).max(60).catch(30), // snap duration for dragging/resizing in minutes
		zoomLevels: z.array(z.number().int().min(1).max(60)).catch(DEFAULT_ZOOM_LEVELS.slice()), // available zoom levels for slot duration
		density: z.enum(["comfortable", "compact"]).catch("comfortable"),
		enableEventPreview: z.boolean().catch(true), // Enable hover preview for events
		nowIndicator: z.boolean().catch(true), // Show current time indicator line
		highlightUpcomingEvent: z.boolean().catch(true), // Highlight the next upcoming event
		thickerHourLines: z.boolean().catch(true), // Make full-hour lines thicker in day/week views
		pastEventContrast: z.number().int().min(0).max(100).catch(70), // Contrast of past events in %
		eventOverlap: z.boolean().catch(true), // Allow events to visually overlap (all views)
		slotEventOverlap: z.boolean().catch(true), // Allow events to overlap within the same time slot (timeGrid views only)
		eventMaxStack: z.number().int().min(1).max(10).catch(1), // Maximum number of events to stack before showing "+ more" link
		desktopMaxEventsPerDay: z.number().int().min(0).max(10).catch(0), // Maximum events to show per day on desktop before showing "+more" (0 = unlimited)
		mobileMaxEventsPerDay: z.number().int().min(0).max(10).catch(4), // Maximum events to show per day on mobile before showing "+more"
		showColorDots: z.boolean().catch(true), // Show color indicator dots in monthly view
		skipUnderscoreProperties: z.boolean().catch(true), // Skip displaying properties that start with underscore
		filterPresets: z.array(FilterPresetSchema).catch([]), // Named filter expressions for quick access
		dragEdgeScrollDelayMs: z.number().int().min(50).max(2000).catch(600), // Delay in milliseconds before scrolling when dragging events near edge
		batchActionButtons: z.array(BatchActionButtonSchema).catch([...DEFAULT_BATCH_ACTION_BUTTONS]), // Which batch action buttons to show in batch selection mode toolbar
		toolbarButtons: z.array(ToolbarButtonSchema).catch([...DEFAULT_TOOLBAR_BUTTONS]), // Which buttons to show in the calendar toolbar (desktop)
		mobileToolbarButtons: z.array(ToolbarButtonSchema).catch([...DEFAULT_TOOLBAR_BUTTONS]), // Which buttons to show in the calendar toolbar (mobile)
		stickyDayHeaders: z.boolean().catch(true), // Make day headers sticky during vertical scroll (timegrid views)
		stickyAllDayEvents: z.boolean().catch(true), // Make all-day event section sticky during vertical scroll (timegrid views)
		allDayEventHeight: z.number().int().min(30).max(500).catch(75), // Maximum height in pixels for all-day events section before overflow
		autoAssignCategoryByName: z.boolean().catch(true), // Automatically assign category when event name matches category name (case-insensitive)
		autoAssignCategoryByIncludes: z.boolean().catch(false), // Automatically assign category when event name contains a category name (substring match, case-insensitive)
		titleAutocomplete: z.boolean().catch(true), // Show inline type-ahead suggestions when typing event titles in the create/edit modal
		categoryAssignmentPresets: z.array(CategoryAssignmentPresetSchema).catch([]), // Custom category assignment rules based on event name
		activeTab: TabbedContainerStateSchema.optional().catch(undefined), // Persisted tab state (active tab, visibility, order)
		pageHeaderState: PageHeaderStateSchema.optional().catch(undefined), // Persisted page header button state
		contextMenuItems: z.array(ContextMenuItemSchema).catch([...DEFAULT_CONTEXT_MENU_ITEMS]), // Context menu items to show when right-clicking events
		showSourceRecurringMarker: z.boolean().catch(true), // Show marker indicator on source recurring events
		showPhysicalRecurringMarker: z.boolean().catch(true), // Show marker indicator on physical recurring instance events
		sourceRecurringMarker: z.string().catch(DEFAULT_SOURCE_RECURRING_MARKER), // Symbol/emoji to display on source recurring events
		physicalRecurringMarker: z.string().catch(DEFAULT_PHYSICAL_RECURRING_MARKER), // Symbol/emoji to display on physical recurring instance events
		showDurationInTitle: z.boolean().catch(true), // Show event duration in the event title
		dayCellColoring: z.enum(["off", "uniform", "boundary"]).catch("off" as const), // Day cell background coloring mode: off, uniform single color, or alternating by month boundary
		monthEvenColor: ColorSchema.catch(DEFAULT_MONTH_EVEN_COLOR), // Background color for even months / uniform day background
		monthOddColor: ColorSchema.catch(DEFAULT_MONTH_ODD_COLOR), // Background color for odd months
		eventTextColor: ColorSchema.catch(DEFAULT_EVENT_TEXT_COLOR), // Default text color for events (used when it has sufficient contrast on background)
		eventTextColorAlt: ColorSchema.catch(DEFAULT_EVENT_TEXT_COLOR_ALT), // Alternative text color (used when default has poor contrast)
		connectionColor: ColorSchema.catch(DEFAULT_CONNECTION_COLOR), // Color of prerequisite connection arrows
		connectionStrokeWidth: z.number().int().min(1).max(10).catch(DEFAULT_CONNECTION_STROKE_WIDTH), // Thickness of prerequisite connection arrow lines in pixels
		connectionArrowSize: z.number().int().min(4).max(24).catch(DEFAULT_CONNECTION_ARROW_SIZE), // Size of prerequisite connection arrowheads in pixels
		fileConcurrencyLimit: z.number().int().min(1).max(50).catch(10), // Maximum number of files to modify in parallel during batch operations (recurring propagation, series propagation, file deletions)
	})
	.strip();

const RulesSettingsSchema = z
	.object({
		filterExpressions: z.array(z.string()).catch([]), // JavaScript expressions to filter events based on frontmatter
		untrackedFilterExpressions: z.array(z.string()).catch([]), // JavaScript expressions to filter untracked events based on frontmatter
		defaultNodeColor: ColorSchema.catch(DEFAULT_EVENT_COLOR), // Default purple color
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
		aiBatchExecution: z.boolean().catch(AI_DEFAULTS.DEFAULT_BATCH_EXECUTION),
		aiConfirmExecution: z.boolean().catch(AI_DEFAULTS.DEFAULT_CONFIRM_EXECUTION),
		customPrompts: z.array(CustomPromptSchema).catch([]),
		aiPlanningGapDetection: z.boolean().catch(AI_DEFAULTS.DEFAULT_PLANNING_GAP_DETECTION),
		aiPlanningDayCoverage: z.boolean().catch(AI_DEFAULTS.DEFAULT_PLANNING_DAY_COVERAGE),
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
