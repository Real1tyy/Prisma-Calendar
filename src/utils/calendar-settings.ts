import {
	BASE_NAME,
	type CustomCalendarSettings,
	CustomCalendarSettingsSchema,
	type SingleCalendarConfig,
	SingleCalendarConfigSchema,
} from "src/types";

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

export function getCalendarById(settings: CustomCalendarSettings, id: string): SingleCalendarConfig | undefined {
	return settings.calendars.find((calendar) => calendar.id === id);
}

export function updateCalendarById(
	settings: CustomCalendarSettings,
	id: string,
	updates: Partial<SingleCalendarConfig>
): CustomCalendarSettings {
	return {
		...settings,
		calendars: settings.calendars.map((calendar) => (calendar.id === id ? { ...calendar, ...updates } : calendar)),
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
