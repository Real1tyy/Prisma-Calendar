import { z } from "zod";
import { ColorSchema, timezoneSchema } from "./validation-schemas";
import { CalendarViewTypeSchema } from "./view-schemas";

export const DEFAULT_EVENT_COLOR = "hsl(270, 70%, 50%)";
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
	allDayProp: z.string().default("All Day"),
	titleProp: z.string().optional(), // optional; fallback to file name
	timezoneProp: z.string().optional(), // optional; default calendar TZ
	zettelIdProp: z.string().optional(), // optional; property name for ZettelID generation
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
	zoomLevels: z
		.array(z.number().int().min(1).max(60))
		.default([1, 2, 3, 5, 10, 15, 20, 30, 45, 60]), // available zoom levels for slot duration
	density: z.enum(["comfortable", "compact"]).default("comfortable"),
	enableEventPreview: z.boolean().default(true), // Enable hover preview for events
	nowIndicator: z.boolean().default(true), // Show current time indicator line
	pastEventContrast: z.number().int().min(0).max(100).default(70), // Contrast of past events in %
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

export function createDefaultCalendarConfig(id: string, name: string): SingleCalendarConfig {
	return SingleCalendarConfigSchema.parse({
		id,
		name,
		enabled: true,
	});
}

export function duplicateCalendarConfig(
	source: SingleCalendarConfig,
	newId: string,
	newName: string
): SingleCalendarConfig {
	return SingleCalendarConfigSchema.parse({
		...source,
		id: newId,
		name: newName,
	});
}

export function validatePartialSettings(settings: unknown): Partial<CustomCalendarSettings> {
	return CustomCalendarSettingsSchema.partial().parse(settings);
}

export function getCalendarById(
	settings: CustomCalendarSettings,
	id: string
): SingleCalendarConfig | undefined {
	return settings.calendars.find((calendar) => calendar.id === id);
}

export function updateCalendarById(
	settings: CustomCalendarSettings,
	id: string,
	updates: Partial<SingleCalendarConfig>
): CustomCalendarSettings {
	return {
		...settings,
		calendars: settings.calendars.map((calendar) =>
			calendar.id === id ? { ...calendar, ...updates } : calendar
		),
	};
}

export function generateUniqueCalendarId(settings: CustomCalendarSettings): string {
	const existingIds = new Set(settings.calendars.map((calendar) => calendar.id));

	if (!existingIds.has(BASE_NAME)) {
		return BASE_NAME;
	}

	let counter = 2;
	while (existingIds.has(`${BASE_NAME}-${counter}`)) {
		counter++;
	}

	return `${BASE_NAME}-${counter}`;
}
