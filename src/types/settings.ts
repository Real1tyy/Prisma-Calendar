import { z } from "zod";
import { SETTINGS_DEFAULTS } from "../constants";
import { ColorSchema } from "../utils/validation";
import { CalendarViewTypeSchema } from "./view";

export const GeneralSettingsSchema = z.object({
	directory: z.string().default(""),
	defaultDurationMinutes: z.number().int().positive().default(SETTINGS_DEFAULTS.DEFAULT_DURATION_MINUTES),
	templatePath: z.string().optional(), // path to Templater template for new events
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
	pastEventContrast: z.number().int().min(0).max(100).default(SETTINGS_DEFAULTS.DEFAULT_PAST_EVENT_CONTRAST), // Contrast of past events in %
	eventOverlap: z.boolean().default(SETTINGS_DEFAULTS.DEFAULT_EVENT_OVERLAP), // Allow events to visually overlap (all views)
	slotEventOverlap: z.boolean().default(SETTINGS_DEFAULTS.DEFAULT_SLOT_EVENT_OVERLAP), // Allow events to overlap within the same time slot (timeGrid views only)
	eventMaxStack: z.number().int().min(1).max(10).default(SETTINGS_DEFAULTS.DEFAULT_EVENT_MAX_STACK), // Maximum number of events to stack before showing "+ more" link
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
			},
		]),
});

export type SingleCalendarConfig = z.infer<typeof SingleCalendarConfigSchema>;
export type CustomCalendarSettings = z.infer<typeof CustomCalendarSettingsSchema>;
