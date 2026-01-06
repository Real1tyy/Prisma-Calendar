import { z } from "zod";
import { BATCH_BUTTON_IDS, DEFAULT_BATCH_ACTION_BUTTONS, SETTINGS_DEFAULTS } from "../constants";
import { CalDAVSettingsSchema } from "../core/integrations/caldav";
import { ColorSchema } from "../utils/validation";
import { CalendarViewTypeSchema } from "./view";

const EventPresetSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		title: z.string().optional(), // Event title to pre-fill
		allDay: z.boolean().optional(), // Whether this is an all-day event
		categories: z.string().optional(), // Event categories (comma-separated string)
		breakMinutes: z.number().nonnegative().optional(), // Break time in minutes to subtract from duration
		notifyBefore: z.number().int().nonnegative().optional(), // Override notification timing (minutes for timed, days for all-day)
		markAsDone: z.boolean().optional(), // Mark event as done
		skip: z.boolean().optional(), // Skip/hide event from calendar
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
		directory: z.string().catch(""),
		defaultDurationMinutes: z.number().int().positive().catch(SETTINGS_DEFAULTS.DEFAULT_DURATION_MINUTES),
		showDurationField: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_SHOW_DURATION_FIELD), // show duration in minutes field in event modal for quick editing
		showStopwatch: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_SHOW_STOPWATCH), // show stopwatch in event modal for precise time tracking
		showStopwatchStartWithoutFill: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_SHOW_STOPWATCH_START_WITHOUT_FILL), // show "start without fill" button that starts tracking without updating start date
		showRibbonIcon: z.boolean().catch(SETTINGS_DEFAULTS.SHOW_RIBBON_ICON), // show ribbon icon in left sidebar to open calendar
		templatePath: z.string().optional(), // path to Templater template for new events
		markPastInstancesAsDone: z.boolean().catch(false), // automatically mark past events as done on startup
		eventPresets: z.array(EventPresetSchema).catch([]), // Event creation presets with pre-filled values
		defaultPresetId: z.string().optional(), // ID of default preset to auto-fill on create modal open
		exportFolder: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_EXPORT_FOLDER), // folder for ICS exports
		enableKeyboardNavigation: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_ENABLE_KEYBOARD_NAVIGATION), // enable arrow key navigation for calendar intervals
	})
	.strip();

const PropsSettingsSchema = z
	.object({
		startProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_START_PROP),
		endProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_END_PROP),
		dateProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_DATE_PROP), // property name for all-day events (date only, no time)
		allDayProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_ALL_DAY_PROP),
		normalizeDateProperty: z
			.enum(["none", "startDate", "endDate"])
			.catch(SETTINGS_DEFAULTS.DEFAULT_NORMALIZE_DATE_PROPERTY), // copy start/end date to date property for sorting
		titleProp: z.string().optional(), // optional; fallback to file name
		zettelIdProp: z.string().optional(), // optional; property name for ZettelID generation
		skipProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_SKIP_PROP), // property name to skip/hide event from calendar
		rruleProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_RRULE_PROP), // property name for RRule type (daily, weekly, etc.)
		rruleSpecProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_RRULE_SPEC_PROP), // property name for RRule specification (weekdays, etc.)
		rruleIdProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_RRULE_ID_PROP), // property name for recurring event ID
		sourceProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_SOURCE_PROP), // property name for linking physical instances to their source recurring event
		instanceDateProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_INSTANCE_DATE_PROP), // property name for recurring event instance date
		frontmatterDisplayProperties: z.array(z.string()).catch([]), // frontmatter properties to display inside timed event chips
		frontmatterDisplayPropertiesAllDay: z.array(z.string()).catch([]), // frontmatter properties to display inside all-day event chips
		statusProperty: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_STATUS_PROPERTY), // property name to manage event status
		doneValue: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_DONE_VALUE), // value to set when marking event as done
		notDoneValue: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_NOT_DONE_VALUE), // value to set when marking event as not done
		categoryProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_CATEGORY_PROP), // property name for event categories used in statistics
		breakProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_BREAK_PROP), // property name for break time in minutes (subtracted from duration in statistics)
		futureInstancesCountProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_FUTURE_INSTANCES_COUNT_PROP), // property name for per-event override of future instances count
		generatePastEventsProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_GENERATE_PAST_EVENTS_PROP), // property name for generating past recurring instances from source event start date
		ignoreRecurringProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_IGNORE_RECURRING_PROP), // property name for ignoring duplicated recurring events from future instance generation
		caldavProp: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_CALDAV_PROP), // property name for CalDAV sync metadata
		basesViewProperties: z.array(z.string()).catch([]), // comma-separated list of properties to include in bases view for category events
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

const BatchActionButtonSchema = z.enum(BATCH_BUTTON_IDS as [string, ...string[]]);

const CalendarSettingsSchema = z
	.object({
		futureInstancesCount: z.number().int().min(1).max(52).catch(SETTINGS_DEFAULTS.DEFAULT_FUTURE_INSTANCES_COUNT), // how many future instances to generate for recurring events
		propagateFrontmatterToInstances: z.boolean().catch(SETTINGS_DEFAULTS.PROPAGATE_FRONTMATTER_TO_INSTANCES), // automatically propagate non-Prisma frontmatter changes from source to physical instances
		askBeforePropagatingFrontmatter: z.boolean().catch(SETTINGS_DEFAULTS.ASK_BEFORE_PROPAGATING_FRONTMATTER), // show confirmation modal before propagating frontmatter changes
		excludedRecurringPropagatedProps: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_EXCLUDED_RECURRING_PROPAGATED_PROPS), // comma-separated list of frontmatter properties to exclude from propagation to recurring instances
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
		stickyDayHeaders: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_STICKY_DAY_HEADERS), // Make day headers sticky during vertical scroll (timegrid views)
		stickyAllDayEvents: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_STICKY_ALL_DAY_EVENTS), // Make all-day event section sticky during vertical scroll (timegrid views)
	})
	.strip();

const RulesSettingsSchema = z
	.object({
		filterExpressions: z.array(z.string()).catch([]), // JavaScript expressions to filter events based on frontmatter
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

export const SingleCalendarConfigSchema = GeneralSettingsSchema.extend(PropsSettingsSchema.shape)
	.extend(CalendarSettingsSchema.shape)
	.extend(RulesSettingsSchema.shape)
	.extend(NotificationsSettingsSchema.shape)
	.extend({
		id: z.string(),
		name: z.string().catch(SETTINGS_DEFAULTS.DEFAULT_CALENDAR_NAME),
		enabled: z.boolean().catch(true),
	})
	.strip();

export const CustomCalendarSettingsSchema = z
	.object({
		version: z.number().int().positive().catch(1),
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
				},
			]),
		caldav: CalDAVSettingsSchema.catch(CalDAVSettingsSchema.parse({})),
	})
	.strip();

export type FilterPreset = z.infer<typeof FilterPresetSchema>;
export type EventPreset = z.infer<typeof EventPresetSchema>;
export type SingleCalendarConfig = z.infer<typeof SingleCalendarConfigSchema>;
export type CustomCalendarSettings = z.infer<typeof CustomCalendarSettingsSchema>;
