import { z } from "zod";
import { ColorSchema, timezoneSchema } from "./validation-schemas";
import { CalendarViewTypeSchema } from "./view-schemas";

export const DEFAULT_EVENT_COLOR = "hsl(270, 70%, 50%)";
export const COMMANDS_HISTORY_LIMIT = 50;
export const MAX_CALENDARS = 10;
export const BASE_NAME = "calendar";

export const GeneralSettingsSchema = z.object({
	directory: z.string().default(""),
	timezone: timezoneSchema.default("system"),
	defaultDurationMinutes: z.number().int().positive().default(60),
	templatePath: z.string().optional(), // path to Templater template for new events
});

export const PropsSettingsSchema = z.object({
	startProp: z.string().default("Start Date"),
	endProp: z.string().default("End Date"),
	dateProp: z.string().default("Date"), // property name for all-day events (date only, no time)
	allDayProp: z.string().default("All Day"),
	titleProp: z.string().optional(), // optional; fallback to file name
	timezoneProp: z.string().optional(), // optional; default calendar TZ
	zettelIdProp: z.string().optional(), // optional; property name for ZettelID generation
	skipProp: z.string().default("Skip"), // property name to skip/hide event from calendar
	rruleProp: z.string().default("RRule"), // property name for RRule type (daily, weekly, etc.)
	rruleSpecProp: z.string().default("RRuleSpec"), // property name for RRule specification (weekdays, etc.)
	rruleIdProp: z.string().default("RRuleID"), // property name for recurring event ID
	sourceProp: z.string().default("Source"), // property name for linking physical instances to their source recurring event
	frontmatterDisplayProperties: z.array(z.string()).default([]), // frontmatter properties to display inside event chips
});

export const CalendarSettingsSchema = z.object({
	futureInstancesCount: z.number().int().min(1).max(52).default(2), // how many future instances to generate for recurring events
	defaultView: CalendarViewTypeSchema.default("dayGridMonth"),
	hideWeekends: z.boolean().default(false),
	hourStart: z.number().int().min(0).max(23).default(7),
	hourEnd: z.number().int().min(1).max(24).default(23),
	firstDayOfWeek: z.number().int().min(0).max(6).default(0), // 0 = Sunday, 1 = Monday, etc.
	slotDurationMinutes: z.number().int().min(1).max(60).default(10), // time slot duration in minutes
	snapDurationMinutes: z.number().int().min(1).max(60).default(10), // snap duration for dragging/resizing in minutes
	zoomLevels: z.array(z.number().int().min(1).max(60)).default([1, 2, 3, 5, 10, 15, 20, 30, 45, 60]), // available zoom levels for slot duration
	density: z.enum(["comfortable", "compact"]).default("comfortable"),
	enableEventPreview: z.boolean().default(true), // Enable hover preview for events
	nowIndicator: z.boolean().default(true), // Show current time indicator line
	pastEventContrast: z.number().int().min(0).max(100).default(70), // Contrast of past events in %
	eventOverlap: z.boolean().default(true), // Allow events to visually overlap (all views)
	slotEventOverlap: z.boolean().default(true), // Allow events to overlap within the same time slot (timeGrid views only)
	eventMaxStack: z.number().int().min(1).max(10).default(3), // Maximum number of events to stack before showing "+ more" link
});

export const RulesSettingsSchema = z.object({
	filterExpressions: z.array(z.string()).default([]), // JavaScript expressions to filter events based on frontmatter
	defaultEventColor: ColorSchema.default(DEFAULT_EVENT_COLOR), // Default purple color
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
		name: z.string().default("Calendar"),
		enabled: z.boolean().default(true),
	});

export const CustomCalendarSettingsSchema = z.object({
	version: z.number().int().positive().default(1),
	calendars: z
		.array(SingleCalendarConfigSchema)
		.min(1)
		.max(MAX_CALENDARS)
		.default([
			{
				id: "default",
				name: "Main Calendar",
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
