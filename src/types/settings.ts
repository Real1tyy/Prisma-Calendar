import { z } from "zod";
import { SETTINGS_DEFAULTS } from "../constants";
import { ColorSchema } from "../utils/validation";
import { CalendarViewTypeSchema } from "./view";

export const GeneralSettingsSchema = z.object({
	directory: z.string().default(""),
	defaultDurationMinutes: z.number().int().positive().default(SETTINGS_DEFAULTS.DEFAULT_DURATION_MINUTES),
	showDurationField: z.boolean().default(SETTINGS_DEFAULTS.DEFAULT_SHOW_DURATION_FIELD), // show duration in minutes field in event modal for quick editing
	templatePath: z.string().optional(), // path to Templater template for new events
	markPastInstancesAsDone: z.boolean().default(false), // automatically mark past events as done on startup
});

export const PropsSettingsSchema = z.object({
	startProp: z.string().default(SETTINGS_DEFAULTS.DEFAULT_START_PROP),
	endProp: z.string().default(SETTINGS_DEFAULTS.DEFAULT_END_PROP),
	dateProp: z.string().default(SETTINGS_DEFAULTS.DEFAULT_DATE_PROP), // property name for all-day events (date only, no time)
	allDayProp: z.string().default(SETTINGS_DEFAULTS.DEFAULT_ALL_DAY_PROP),
	titleProp: z.string().optional(), // optional; fallback to file name
	zettelIdProp: z.string().optional(), // optional; property name for ZettelID generation
	skipProp: z.string().default(SETTINGS_DEFAULTS.DEFAULT_SKIP_PROP), // property name to skip/hide event from calendar
	rruleProp: z.string().default(SETTINGS_DEFAULTS.DEFAULT_RRULE_PROP), // property name for RRule type (daily, weekly, etc.)
	rruleSpecProp: z.string().default(SETTINGS_DEFAULTS.DEFAULT_RRULE_SPEC_PROP), // property name for RRule specification (weekdays, etc.)
	rruleIdProp: z.string().default(SETTINGS_DEFAULTS.DEFAULT_RRULE_ID_PROP), // property name for recurring event ID
	sourceProp: z.string().default(SETTINGS_DEFAULTS.DEFAULT_SOURCE_PROP), // property name for linking physical instances to their source recurring event
	frontmatterDisplayProperties: z.array(z.string()).default([]), // frontmatter properties to display inside event chips
	statusProperty: z.string().default(SETTINGS_DEFAULTS.DEFAULT_STATUS_PROPERTY), // property name to manage event status
	doneValue: z.string().default(SETTINGS_DEFAULTS.DEFAULT_DONE_VALUE), // value to set when marking event as done
	categoryProp: z.string().default(SETTINGS_DEFAULTS.DEFAULT_CATEGORY_PROP), // property name for event categories used in statistics
	futureInstancesCountProp: z.string().default(SETTINGS_DEFAULTS.DEFAULT_FUTURE_INSTANCES_COUNT_PROP), // property name for per-event override of future instances count
});

export const NotificationsSettingsSchema = z.object({
	enableNotifications: z.boolean().default(SETTINGS_DEFAULTS.DEFAULT_ENABLE_NOTIFICATIONS),
	notificationSound: z.boolean().default(SETTINGS_DEFAULTS.DEFAULT_NOTIFICATION_SOUND), // whether to play sound with notifications
	snoozeMinutes: z.number().int().positive().default(SETTINGS_DEFAULTS.DEFAULT_SNOOZE_MINUTES), // how many minutes to snooze notifications
	defaultMinutesBefore: z.number().int().nonnegative().optional(), // minutes before event to notify, undefined = no default notification
	minutesBeforeProp: z.string().default(SETTINGS_DEFAULTS.DEFAULT_MINUTES_BEFORE_PROP), // frontmatter property to read per-event notification times
	defaultDaysBefore: z.number().int().nonnegative().optional(), // days before all-day event to notify, undefined = no default notification
	daysBeforeProp: z.string().default(SETTINGS_DEFAULTS.DEFAULT_DAYS_BEFORE_PROP), // frontmatter property to read per-event notification days for all-day events
	alreadyNotifiedProp: z.string().default(SETTINGS_DEFAULTS.DEFAULT_ALREADY_NOTIFIED_PROP), // frontmatter property to mark events as already notified
});

export const FilterPresetSchema = z.object({
	name: z.string(),
	expression: z.string(),
});

export const CalendarSettingsSchema = z.object({
	futureInstancesCount: z.number().int().min(1).max(52).default(SETTINGS_DEFAULTS.DEFAULT_FUTURE_INSTANCES_COUNT), // how many future instances to generate for recurring events
	defaultView: CalendarViewTypeSchema.default(SETTINGS_DEFAULTS.DEFAULT_DEFAULT_VIEW),
	hideWeekends: z.boolean().default(false),
	hourStart: z.number().int().min(0).max(23).default(SETTINGS_DEFAULTS.DEFAULT_HOUR_START),
	hourEnd: z.number().int().min(1).max(24).default(SETTINGS_DEFAULTS.DEFAULT_HOUR_END),
	firstDayOfWeek: z.number().int().min(0).max(6).default(SETTINGS_DEFAULTS.DEFAULT_FIRST_DAY_OF_WEEK), // 0 = Sunday, 1 = Monday, etc.
	slotDurationMinutes: z.number().int().min(1).max(60).default(SETTINGS_DEFAULTS.DEFAULT_SLOT_DURATION_MINUTES), // time slot duration in minutes
	snapDurationMinutes: z.number().int().min(1).max(60).default(SETTINGS_DEFAULTS.DEFAULT_SNAP_DURATION_MINUTES), // snap duration for dragging/resizing in minutes
	zoomLevels: z.array(z.number().int().min(1).max(60)).default(SETTINGS_DEFAULTS.DEFAULT_ZOOM_LEVELS.slice()), // available zoom levels for slot duration
	density: z.enum(["comfortable", "compact"]).default(SETTINGS_DEFAULTS.DEFAULT_DENSITY),
	enableEventPreview: z.boolean().default(SETTINGS_DEFAULTS.DEFAULT_ENABLE_EVENT_PREVIEW), // Enable hover preview for events
	nowIndicator: z.boolean().default(SETTINGS_DEFAULTS.DEFAULT_NOW_INDICATOR), // Show current time indicator line
	highlightUpcomingEvent: z.boolean().default(SETTINGS_DEFAULTS.DEFAULT_HIGHLIGHT_UPCOMING_EVENT), // Highlight the next upcoming event
	pastEventContrast: z.number().int().min(0).max(100).default(SETTINGS_DEFAULTS.DEFAULT_PAST_EVENT_CONTRAST), // Contrast of past events in %
	eventOverlap: z.boolean().default(SETTINGS_DEFAULTS.DEFAULT_EVENT_OVERLAP), // Allow events to visually overlap (all views)
	slotEventOverlap: z.boolean().default(SETTINGS_DEFAULTS.DEFAULT_SLOT_EVENT_OVERLAP), // Allow events to overlap within the same time slot (timeGrid views only)
	eventMaxStack: z.number().int().min(1).max(10).default(SETTINGS_DEFAULTS.DEFAULT_EVENT_MAX_STACK), // Maximum number of events to stack before showing "+ more" link
	skipUnderscoreProperties: z.boolean().default(SETTINGS_DEFAULTS.DEFAULT_SKIP_UNDERSCORE_PROPERTIES), // Skip displaying properties that start with underscore
	filterPresets: z.array(FilterPresetSchema).default([]), // Named filter expressions for quick access
});

export const RulesSettingsSchema = z.object({
	filterExpressions: z.array(z.string()).default([]), // JavaScript expressions to filter events based on frontmatter
	defaultEventColor: ColorSchema.default(SETTINGS_DEFAULTS.DEFAULT_EVENT_COLOR), // Default purple color
	colorRules: z
		.array(
			z.object({
				id: z.string(),
				expression: z.string(), // JavaScript expression to evaluate against frontmatter
				color: ColorSchema, // Color to apply if expression evaluates to true
				enabled: z.boolean().default(true),
			})
		)
		.default([]),
});

export const SingleCalendarConfigSchema = GeneralSettingsSchema.extend(PropsSettingsSchema.shape)
	.extend(CalendarSettingsSchema.shape)
	.extend(RulesSettingsSchema.shape)
	.extend(NotificationsSettingsSchema.shape)
	.extend({
		id: z.string(),
		name: z.string().default(SETTINGS_DEFAULTS.DEFAULT_CALENDAR_NAME),
		enabled: z.boolean().default(true),
	});

export const CustomCalendarSettingsSchema = z.object({
	version: z.number().int().positive().default(1),
	calendars: z
		.array(SingleCalendarConfigSchema)
		.min(1)
		.max(SETTINGS_DEFAULTS.MAX_CALENDARS)
		.default([
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
});

export type FilterPreset = z.infer<typeof FilterPresetSchema>;
export type SingleCalendarConfig = z.infer<typeof SingleCalendarConfigSchema>;
export type CustomCalendarSettings = z.infer<typeof CustomCalendarSettingsSchema>;
