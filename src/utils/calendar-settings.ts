import { SETTINGS_DEFAULTS } from "../constants";
import { type CustomCalendarSettings, type SingleCalendarConfig, SingleCalendarConfigSchema } from "../types";

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

/**
 * Builds a stable key from the subset of settings that affect how events are rendered.
 * When this key changes, a full event refresh is needed.
 */
export function getEventRenderingKey(settings: SingleCalendarConfig): string {
	return JSON.stringify([
		settings.colorRules,
		settings.defaultNodeColor,
		settings.filterExpressions,
		settings.untrackedFilterExpressions,
		settings.caldavProp,
		settings.icsSubscriptionProp,
		settings.frontmatterDisplayProperties,
		settings.frontmatterDisplayPropertiesAllDay,
		settings.showDurationInTitle,
		settings.showSourceRecurringMarker,
		settings.showPhysicalRecurringMarker,
		settings.sourceRecurringMarker,
		settings.physicalRecurringMarker,
		settings.showColorDots,
		settings.pastEventContrast,
		settings.eventTextColor,
		settings.eventTextColorAlt,
		settings.skipProp,
		settings.titleProp,
		settings.calendarTitleProp,
	]);
}

export function generateUniqueCalendarId(settings: CustomCalendarSettings): string {
	const existingIds = new Set(settings.calendars.map((calendar) => calendar.id));

	if (!existingIds.has(SETTINGS_DEFAULTS.BASE_NAME)) {
		return SETTINGS_DEFAULTS.BASE_NAME;
	}

	let counter = 2;
	while (existingIds.has(`${SETTINGS_DEFAULTS.BASE_NAME}-${counter}`)) {
		counter++;
	}

	return `${SETTINGS_DEFAULTS.BASE_NAME}-${counter}`;
}
