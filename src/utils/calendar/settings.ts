import { BASE_NAME } from "../../constants";
import { SingleCalendarConfigSchema, type CustomCalendarSettings, type SingleCalendarConfig } from "../../types";

const fields = <const T extends readonly (keyof SingleCalendarConfig)[]>(...keys: T): T => keys;

// Field groups mirror the Properties settings tab sections.
export const TIMING_FIELDS = fields("startProp", "endProp", "dateProp", "allDayProp");
export const IDENTITY_FIELDS = fields("titleProp", "calendarTitleProp", "zettelIdProp", "skipProp", "iconProp");
export const RECURRENCE_FIELDS = fields(
	"rruleProp",
	"rruleSpecProp",
	"rruleUntilProp",
	"rruleIdProp",
	"sourceProp",
	"instanceDateProp",
	"futureInstancesCountProp",
	"generatePastEventsProp"
);
export const STATUS_FIELDS = fields(
	"statusProperty",
	"doneValue",
	"notDoneValue",
	"customDoneProperty",
	"customUndoneProperty"
);
export const METADATA_FIELDS = fields(
	"categoryProp",
	"locationProp",
	"participantsProp",
	"breakProp",
	"prerequisiteProp"
);
export const NOTIFICATION_PROP_FIELDS = fields("minutesBeforeProp", "daysBeforeProp", "alreadyNotifiedProp");
export const DISPLAY_FIELDS = fields(
	"frontmatterDisplayProperties",
	"frontmatterDisplayPropertiesAllDay",
	"frontmatterDisplayPropertiesUntracked",
	"frontmatterDisplayPropertiesHeatmap"
);

/**
 * Settings whose change alters how an already-indexed note parses into a
 * `CalendarEvent` — its temporal type, metadata, recurring shape, or
 * tracked/untracked classification. Changing any of these re-runs the parser
 * over the existing rows so the EventStore cache reflects the new mapping
 * immediately — without this, "I changed the <X> property and nothing happened"
 * stays true until an Obsidian reload.
 *
 * Derived by spreading the property-mapping groups rather than hand-listing keys,
 * so the set cannot silently drift behind the parser: the mapped frontmatter
 * schema (`createMappedSchema` over `EventFrontmatterShape`) reads *every*
 * `${field}Prop` mapping, so every mapping key is parse-affecting by construction.
 *
 * Deliberately excluded:
 * - {@link DISPLAY_FIELDS} — render-only. An unchanged event is just re-drawn;
 *   that path is the rendering keys ({@link getCalendarRenderingKey} et al.), not
 *   a re-parse.
 * - `directory` / `indexSubdirectories` — these change *which* files are indexed
 *   and go through the table-rebuild path, not a re-emit.
 */
export const PARSE_AFFECTING_KEYS = fields(
	...TIMING_FIELDS,
	...IDENTITY_FIELDS,
	...RECURRENCE_FIELDS,
	...STATUS_FIELDS,
	...METADATA_FIELDS,
	...NOTIFICATION_PROP_FIELDS,
	"sortingStrategy",
	"sortDateProp",
	"filterExpressions"
);

export function parseAffectingSettingsChanged(prev: SingleCalendarConfig, next: SingleCalendarConfig): boolean {
	return PARSE_AFFECTING_KEYS.some((key) => JSON.stringify(prev[key]) !== JSON.stringify(next[key]));
}

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
		directory: "", // Don't duplicate directory - each calendar should have its own
	});
}

export function getCalendarById(settings: CustomCalendarSettings, id: string): SingleCalendarConfig | undefined {
	return settings.calendars.find((calendar) => calendar.id === id);
}

function getSharedRenderingFields(settings: SingleCalendarConfig): unknown[] {
	return [
		settings.colorRules,
		settings.defaultNodeColor,
		settings.colorMode,
		settings.showEventColorDots,
		settings.eventTextColor,
		settings.eventTextColorAlt,
		settings.caldavProp,
		settings.icsSubscriptionProp,
		settings.skipProp,
		settings.titleProp,
		settings.calendarTitleProp,
		settings.filterExpressions,
		settings.untrackedFilterExpressions,
		settings.showColorDots,
	];
}

export function getCalendarRenderingKey(settings: SingleCalendarConfig): string {
	return JSON.stringify([
		...getSharedRenderingFields(settings),
		settings.frontmatterDisplayProperties,
		settings.frontmatterDisplayPropertiesAllDay,
		settings.showDurationInTitle,
		settings.showSourceRecurringMarker,
		settings.showPhysicalRecurringMarker,
		settings.sourceRecurringMarker,
		settings.physicalRecurringMarker,
		settings.pastEventContrast,
		settings.eventOverlap,
		settings.slotEventOverlap,
		settings.eventMaxStack,
		settings.desktopMaxEventsPerDay,
		settings.mobileMaxEventsPerDay,
	]);
}

export function getTimelineRenderingKey(settings: SingleCalendarConfig): string {
	return JSON.stringify([
		...getSharedRenderingFields(settings),
		settings.frontmatterDisplayProperties,
		settings.frontmatterDisplayPropertiesAllDay,
		settings.locale,
	]);
}

export function getHeatmapRenderingKey(settings: SingleCalendarConfig): string {
	return JSON.stringify([...getSharedRenderingFields(settings), settings.frontmatterDisplayPropertiesHeatmap]);
}

export function getGanttRenderingKey(settings: SingleCalendarConfig): string {
	return JSON.stringify(getSharedRenderingFields(settings));
}

export function generateUniqueCalendarId(settings: Pick<CustomCalendarSettings, "calendars">): string {
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

export function friendlyCalendarName(url: string): string {
	const segment = url.replace(/\/+$/, "").split("/").pop() ?? url;
	return segment.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
