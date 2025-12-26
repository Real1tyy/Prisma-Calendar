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
