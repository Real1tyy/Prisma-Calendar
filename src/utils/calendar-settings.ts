import { BASE_NAME } from "../constants";
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
	];
}

export function getCalendarRenderingKey(settings: SingleCalendarConfig): string {
	return JSON.stringify([
		...getSharedRenderingFields(settings),
		settings.filterExpressions,
		settings.untrackedFilterExpressions,
		settings.frontmatterDisplayProperties,
		settings.frontmatterDisplayPropertiesAllDay,
		settings.showDurationInTitle,
		settings.showSourceRecurringMarker,
		settings.showPhysicalRecurringMarker,
		settings.sourceRecurringMarker,
		settings.physicalRecurringMarker,
		settings.showColorDots,
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
