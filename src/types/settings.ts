import { normalizeDirectoryPath } from "@real1ty-obsidian-plugins";
import { z } from "zod";
import {
	BATCH_BUTTON_IDS,
	DEFAULT_BATCH_ACTION_BUTTONS,
	DEFAULT_CONTEXT_MENU_ITEMS,
	DEFAULT_TOOLBAR_BUTTONS,
	SETTINGS_DEFAULTS,
} from "../constants";
import { AI_DEFAULTS } from "../core/ai";
import { CalDAVSettingsSchema } from "../core/integrations/caldav";
import { ICSSubscriptionSettingsSchema } from "../core/integrations/ics-subscription";
import { ColorSchema } from "../utils/validation";
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
		defaultDurationMinutes: z.number().int().positive().catch(SETTINGS_DEFAULTS.DEFAULT_DURATION_MINUTES),
		showDurationField: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_SHOW_DURATION_FIELD), // show duration in minutes field in event modal for quick editing
		showStopwatch: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_SHOW_STOPWATCH), // show stopwatch in event modal for precise time tracking
		showStopwatchStartWithoutFill: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_SHOW_STOPWATCH_START_WITHOUT_FILL), // show "continue" button that continues tracking from existing start time without creating a new one
		showRibbonIcon: z.boolean().catch(SETTINGS_DEFAULTS.SHOW_RIBBON_ICON), // show ribbon icon in left sidebar to open calendar
		templatePath: z.string().optional(), // path to Templater template for new events
		markPastInstancesAsDone: z.boolean().catch(false), // automatically mark past events as done on startup
		eventPresets: z.array(EventPresetSchema).catch([]), // Event creation presets with pre-filled values
		defaultPresetId: z.string().optional(), // ID of default preset to auto-fill on create modal open
		exportFolder: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_EXPORT_FOLDER), // folder for ICS exports
		enableKeyboardNavigation: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_ENABLE_KEYBOARD_NAVIGATION), // enable arrow key navigation for calendar intervals
		autoAssignZettelId: z
			.enum(["disabled", "calendarEvents", "allEvents"])
			.catch(SETTINGS_DEFAULTS.DEFAULT_AUTO_ASSIGN_ZETTEL_ID), // automatically assign ZettelID to files in calendar directory: disabled, calendar events only (timed + all-day), or all events (including untracked)
	})
	.strip();

const PropsSettingsSchema = z
	.object({
		startProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_START_PROP),
		endProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_END_PROP),
		dateProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_DATE_PROP), // property name for all-day events (date only, no time)
		allDayProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_ALL_DAY_PROP),
		sortingStrategy: z
			.enum(["none", "startDate", "endDate", "allDayOnly", "allStartDate", "allEndDate"])
			.catch(SETTINGS_DEFAULTS.DEFAULT_SORTING_STRATEGY), // sorting normalization strategy: write normalized datetime to sort date property
		sortDateProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_SORT_DATE_PROP), // dedicated sort date property for normalized datetime values
		titleProp: z.string().optional(), // optional; fallback to file name
		calendarTitleProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_CALENDAR_TITLE_PROP), // auto-computed display title (wiki link with zettel ID stripped) for clean rendering in calendar and Bases views
		zettelIdProp: z.string().optional(), // optional; property name for ZettelID generation
		skipProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_SKIP_PROP), // property name to skip/hide event from calendar
		rruleProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_RRULE_PROP), // property name for RRule type (daily, weekly, etc.)
		rruleSpecProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_RRULE_SPEC_PROP), // property name for RRule specification (weekdays, etc.)
		rruleIdProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_RRULE_ID_PROP), // property name for recurring event ID
		sourceProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_SOURCE_PROP), // property name for linking physical instances to their source recurring event
		instanceDateProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_INSTANCE_DATE_PROP), // property name for recurring event instance date
		frontmatterDisplayProperties: z.array(z.string()).catch([]), // frontmatter properties to display inside timed event chips
		frontmatterDisplayPropertiesAllDay: z.array(z.string()).catch([]), // frontmatter properties to display inside all-day event chips
		frontmatterDisplayPropertiesUntracked: z.array(z.string()).catch([]), // frontmatter properties to display inside untracked event chips
		statusProperty: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_STATUS_PROPERTY), // property name to manage event status
		doneValue: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_DONE_VALUE), // value to set when marking event as done
		notDoneValue: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_NOT_DONE_VALUE), // value to set when marking event as not done
		customDoneProperty: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_CUSTOM_DONE_PROPERTY), // DSL expression for additional property to set when marking as done (format: "propertyName value")
		customUndoneProperty: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_CUSTOM_UNDONE_PROPERTY), // DSL expression for additional property to set when marking as undone (format: "propertyName value"), requires customDoneProperty
		categoryProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_CATEGORY_PROP), // property name for event categories used in statistics
		locationProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_LOCATION_PROP), // property name for event location (single string)
		participantsProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_PARTICIPANTS_PROP), // property name for event participants (array of strings)
		breakProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_BREAK_PROP), // property name for break time in minutes (subtracted from duration in statistics)
		futureInstancesCountProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_FUTURE_INSTANCES_COUNT_PROP), // property name for per-event override of future instances count
		generatePastEventsProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_GENERATE_PAST_EVENTS_PROP), // property name for generating past recurring instances from source event start date
		ignoreRecurringProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_IGNORE_RECURRING_PROP), // property name for ignoring duplicated recurring events from future instance generation
		caldavProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_CALDAV_PROP), // property name for CalDAV sync metadata
		icsSubscriptionProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_ICS_SUBSCRIPTION_PROP), // property name for ICS subscription sync metadata
		iconProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_ICON_PROP), // property name for event icon override (emoji or text, takes precedence over integration icons)
		basesViewProperties: z.array(z.string()).catch([]), // comma-separated list of properties to include in bases view for category events
		basesViewType: z.enum(["table", "cards", "list"]).catch(SETTINGS_DEFAULTS.DEFAULT_BASES_VIEW_TYPE), // view type for bases views (table, cards, or list)
	})
	.strip();

const NotificationsSettingsSchema = z
	.object({
		enableNotifications: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_ENABLE_NOTIFICATIONS),
		notificationSound: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_NOTIFICATION_SOUND), // whether to play sound with notifications
		snoozeMinutes: z.number().int().positive().catch(SETTINGS_DEFAULTS.DEFAULT_SNOOZE_MINUTES), // how many minutes to snooze notifications
		skipNewlyCreatedNotifications: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_SKIP_NEWLY_CREATED_NOTIFICATIONS), // skip notifications for events created within the last minute
		defaultMinutesBefore: z.number().int().nonnegative().optional(), // minutes before event to notify, undefined = no default notification
		minutesBeforeProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_MINUTES_BEFORE_PROP), // frontmatter property to read per-event notification times
		defaultDaysBefore: z.number().int().nonnegative().optional(), // days before all-day event to notify, undefined = no default notification
		daysBeforeProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_DAYS_BEFORE_PROP), // frontmatter property to read per-event notification days for all-day events
		alreadyNotifiedProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_ALREADY_NOTIFIED_PROP), // frontmatter property to mark events as already notified
	})
	.strip();

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
		futureInstancesCount: z.number().int().min(1).max(52).catch(SETTINGS_DEFAULTS.DEFAULT_FUTURE_INSTANCES_COUNT), // how many future instances to generate for recurring events
		propagateFrontmatterToInstances: z.boolean().catch(SETTINGS_DEFAULTS.PROPAGATE_FRONTMATTER_TO_INSTANCES), // automatically propagate non-Prisma frontmatter changes from source to physical instances
		askBeforePropagatingFrontmatter: z.boolean().catch(SETTINGS_DEFAULTS.ASK_BEFORE_PROPAGATING_FRONTMATTER), // show confirmation modal before propagating frontmatter changes
		enableNameSeriesTracking: z.boolean().catch(SETTINGS_DEFAULTS.ENABLE_NAME_SERIES_TRACKING), // enable name-based series tracking (groups events by title for propagation and series views)
		propagateFrontmatterToNameSeries: z.boolean().catch(SETTINGS_DEFAULTS.PROPAGATE_FRONTMATTER_TO_NAME_SERIES), // automatically propagate frontmatter changes across name-based series (events sharing the same title)
		askBeforePropagatingToNameSeries: z.boolean().catch(SETTINGS_DEFAULTS.ASK_BEFORE_PROPAGATING_TO_NAME_SERIES), // show confirmation modal before propagating frontmatter changes to name series
		propagateFrontmatterToCategorySeries: z.boolean().catch(SETTINGS_DEFAULTS.PROPAGATE_FRONTMATTER_TO_CATEGORY_SERIES), // automatically propagate frontmatter changes across category-based series (events sharing the same category)
		askBeforePropagatingToCategorySeries: z
			.boolean()
			.catch(SETTINGS_DEFAULTS.ASK_BEFORE_PROPAGATING_TO_CATEGORY_SERIES), // show confirmation modal before propagating frontmatter changes to category series
		excludedRecurringPropagatedProps: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_EXCLUDED_RECURRING_PROPAGATED_PROPS), // comma-separated list of frontmatter properties to exclude from propagation
		propagationDebounceMs: z
			.number()
			.int()
			.min(100)
			.max(10000)
			.catch(SETTINGS_DEFAULTS.DEFAULT_PROPAGATION_DEBOUNCE_MS), // debounce delay in milliseconds before propagating frontmatter changes to instances
		defaultView: CalendarViewTypeSchema.catch(SETTINGS_DEFAULTS.DEFAULT_DEFAULT_VIEW),
		defaultMobileView: CalendarViewTypeSchema.catch(SETTINGS_DEFAULTS.DEFAULT_DEFAULT_VIEW),
		hideWeekends: z.boolean().catch(false),
		showDecimalHours: z.boolean().catch(false), // Show durations as decimal hours (e.g., 2.5h) instead of formatted (e.g., 2h 30m)
		defaultAggregationMode: z.enum(["name", "category"]).catch(SETTINGS_DEFAULTS.DEFAULT_AGGREGATION_MODE), // Default aggregation mode for statistics (name or category)
		hourStart: z.number().int().min(0).max(23).catch(SETTINGS_DEFAULTS.DEFAULT_HOUR_START),
		hourEnd: z.number().int().min(1).max(24).catch(SETTINGS_DEFAULTS.DEFAULT_HOUR_END),
		firstDayOfWeek: z.number().int().min(0).max(6).catch(SETTINGS_DEFAULTS.DEFAULT_FIRST_DAY_OF_WEEK), // 0 = Sunday, 1 = Monday, etc.
		slotDurationMinutes: z.number().int().min(1).max(60).catch(SETTINGS_DEFAULTS.DEFAULT_SLOT_DURATION_MINUTES), // time slot duration in minutes
		snapDurationMinutes: z.number().int().min(1).max(60).catch(SETTINGS_DEFAULTS.DEFAULT_SNAP_DURATION_MINUTES), // snap duration for dragging/resizing in minutes
		zoomLevels: z.array(z.number().int().min(1).max(60)).catch(SETTINGS_DEFAULTS.DEFAULT_ZOOM_LEVELS.slice()), // available zoom levels for slot duration
		density: z.enum(["comfortable", "compact"]).catch(SETTINGS_DEFAULTS.DEFAULT_DENSITY),
		enableEventPreview: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_ENABLE_EVENT_PREVIEW), // Enable hover preview for events
		nowIndicator: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_NOW_INDICATOR), // Show current time indicator line
		highlightUpcomingEvent: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_HIGHLIGHT_UPCOMING_EVENT), // Highlight the next upcoming event
		thickerHourLines: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_THICKER_HOUR_LINES), // Make full-hour lines thicker in day/week views
		pastEventContrast: z.number().int().min(0).max(100).catch(SETTINGS_DEFAULTS.DEFAULT_PAST_EVENT_CONTRAST), // Contrast of past events in %
		eventOverlap: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_EVENT_OVERLAP), // Allow events to visually overlap (all views)
		slotEventOverlap: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_SLOT_EVENT_OVERLAP), // Allow events to overlap within the same time slot (timeGrid views only)
		eventMaxStack: z.number().int().min(1).max(10).catch(SETTINGS_DEFAULTS.DEFAULT_EVENT_MAX_STACK), // Maximum number of events to stack before showing "+ more" link
		desktopMaxEventsPerDay: z.number().int().min(0).max(10).catch(SETTINGS_DEFAULTS.DEFAULT_DESKTOP_MAX_EVENTS_PER_DAY), // Maximum events to show per day on desktop before showing "+more" (0 = unlimited)
		mobileMaxEventsPerDay: z.number().int().min(0).max(10).catch(SETTINGS_DEFAULTS.DEFAULT_MOBILE_MAX_EVENTS_PER_DAY), // Maximum events to show per day on mobile before showing "+more"
		showColorDots: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_SHOW_COLOR_DOTS), // Show color indicator dots in monthly view
		skipUnderscoreProperties: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_SKIP_UNDERSCORE_PROPERTIES), // Skip displaying properties that start with underscore
		filterPresets: z.array(FilterPresetSchema).catch([]), // Named filter expressions for quick access
		dragEdgeScrollDelayMs: z
			.number()
			.int()
			.min(50)
			.max(2000)
			.catch(SETTINGS_DEFAULTS.DEFAULT_DRAG_EDGE_SCROLL_DELAY_MS), // Delay in milliseconds before scrolling when dragging events near edge
		batchActionButtons: z.array(BatchActionButtonSchema).catch([...DEFAULT_BATCH_ACTION_BUTTONS]), // Which batch action buttons to show in batch selection mode toolbar
		toolbarButtons: z.array(ToolbarButtonSchema).catch([...DEFAULT_TOOLBAR_BUTTONS]), // Which buttons to show in the calendar toolbar (desktop)
		mobileToolbarButtons: z.array(ToolbarButtonSchema).catch([...DEFAULT_TOOLBAR_BUTTONS]), // Which buttons to show in the calendar toolbar (mobile)
		stickyDayHeaders: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_STICKY_DAY_HEADERS), // Make day headers sticky during vertical scroll (timegrid views)
		stickyAllDayEvents: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_STICKY_ALL_DAY_EVENTS), // Make all-day event section sticky during vertical scroll (timegrid views)
		allDayEventHeight: z.number().int().min(30).max(500).catch(SETTINGS_DEFAULTS.DEFAULT_ALL_DAY_EVENT_HEIGHT), // Maximum height in pixels for all-day events section before overflow
		autoAssignCategoryByName: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_AUTO_ASSIGN_CATEGORY_BY_NAME), // Automatically assign category when event name matches category name (case-insensitive)
		detectEventNameTypos: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_DETECT_EVENT_NAME_TYPOS), // Show fuzzy match suggestion when event name is close to a known category, preset, or name series
		categoryAssignmentPresets: z.array(CategoryAssignmentPresetSchema).catch([]), // Custom category assignment rules based on event name
		contextMenuItems: z.array(ContextMenuItemSchema).catch([...DEFAULT_CONTEXT_MENU_ITEMS]), // Context menu items to show when right-clicking events
		showSourceRecurringMarker: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_SHOW_SOURCE_RECURRING_MARKER), // Show marker indicator on source recurring events
		showPhysicalRecurringMarker: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_SHOW_PHYSICAL_RECURRING_MARKER), // Show marker indicator on physical recurring instance events
		sourceRecurringMarker: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_SOURCE_RECURRING_MARKER), // Symbol/emoji to display on source recurring events
		physicalRecurringMarker: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_PHYSICAL_RECURRING_MARKER), // Symbol/emoji to display on physical recurring instance events
		showDurationInTitle: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_SHOW_DURATION_IN_TITLE), // Show event duration in the event title
		eventTextColor: ColorSchema.catch(SETTINGS_DEFAULTS.DEFAULT_EVENT_TEXT_COLOR), // Default text color for events (used when it has sufficient contrast on background)
		eventTextColorAlt: ColorSchema.catch(SETTINGS_DEFAULTS.DEFAULT_EVENT_TEXT_COLOR_ALT), // Alternative text color (used when default has poor contrast)
		fileConcurrencyLimit: z.number().int().min(1).max(50).catch(SETTINGS_DEFAULTS.DEFAULT_FILE_CONCURRENCY_LIMIT), // Maximum number of files to modify in parallel during batch operations (recurring propagation, series propagation, file deletions)
	})
	.strip();

const RulesSettingsSchema = z
	.object({
		filterExpressions: z.array(z.string()).catch([]), // JavaScript expressions to filter events based on frontmatter
		untrackedFilterExpressions: z.array(z.string()).catch([]), // JavaScript expressions to filter untracked events based on frontmatter
		defaultNodeColor: ColorSchema.catch(SETTINGS_DEFAULTS.DEFAULT_EVENT_COLOR), // Default purple color
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
		customPrompts: z.array(CustomPromptSchema).catch([]),
	})
	.strip();

export const SingleCalendarConfigSchema = GeneralSettingsSchema.extend(PropsSettingsSchema.shape)
	.extend(CalendarSettingsSchema.shape)
	.extend(RulesSettingsSchema.shape)
	.extend(NotificationsSettingsSchema.shape)
	.extend({
		id: z.string(),
		name: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_CALENDAR_NAME),
		enabled: z.boolean().catch(true),
		holidays: HolidaySettingsSchema.catch(HolidaySettingsSchema.parse({})),
	})
	.strip();

export const CustomCalendarSettingsSchema = z
	.object({
		version: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_VERSION),
		calendars: z
			.array(SingleCalendarConfigSchema)
			.min(1)
			.max(SETTINGS_DEFAULTS.MAX_CALENDARS)
			.catch([
				{
					id: "default",
					name: SETTINGS_DEFAULTS.DEFAULT_CALENDAR_NAME,
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
export type AISettings = z.infer<typeof AISettingsSchema>;
export type FilterPreset = z.infer<typeof FilterPresetSchema>;
export type CategoryAssignmentPreset = z.infer<typeof CategoryAssignmentPresetSchema>;
export type EventPreset = z.infer<typeof EventPresetSchema>;
export type HolidaySettings = z.infer<typeof HolidaySettingsSchema>;
export type HolidayType = z.infer<typeof HolidayTypeSchema>;
export type SingleCalendarConfig = z.infer<typeof SingleCalendarConfigSchema>;
export type CustomCalendarSettings = z.infer<typeof CustomCalendarSettingsSchema>;
