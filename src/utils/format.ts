import type { DateTime } from "luxon";
import { INTERNAL_FRONTMATTER_PROPERTIES } from "../constants";
import type { SingleCalendarConfig } from "../types/settings";
import { isNotEmpty } from "./value-checks";

/**
 * Formats a date/datetime for HTML datetime-local input fields.
 * Strips Z suffix to treat as local time and returns YYYY-MM-DDTHH:MM format.
 */
export function formatDateTimeForInput(dateInput: string | Date): string {
	// Strip Z suffix if present to treat as local time
	const dateStr = typeof dateInput === "string" ? dateInput.replace(/Z$/, "") : dateInput;
	const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;

	// Extract local time components (no UTC conversion)
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");

	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Formats a date for HTML date input fields.
 * Strips Z suffix to treat as local time and returns YYYY-MM-DD format.
 */
export function formatDateOnly(dateInput: string | Date): string {
	// Strip Z suffix if present to treat as local time
	const dateStr = typeof dateInput === "string" ? dateInput.replace(/Z$/, "") : dateInput;
	const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;

	// Use local time components
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * Converts datetime-local input value to ISO string with Z suffix (treating as local time).
 * Takes "2025-10-03T17:30" and returns "2025-10-03T17:30:00.000Z"
 */
export function inputValueToISOString(inputValue: string): string {
	// Append seconds and Z to maintain consistent format (Z is ignored, time is treated as local)
	return `${inputValue}:00.000Z`;
}

export function formatDurationHumanReadable(start: DateTime, end: DateTime): string {
	const durationMs = end.diff(start).toMillis();
	const hours = Math.floor(durationMs / (1000 * 60 * 60));
	const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

	if (hours === 0) {
		return `${minutes} minute${minutes === 1 ? "" : "s"}`;
	}
	if (minutes === 0) {
		return `${hours} hour${hours === 1 ? "" : "s"}`;
	}
	return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function calculateDuration(start: Date, end: Date): string {
	const durationMs = end.getTime() - start.getTime();
	const hours = Math.floor(durationMs / (1000 * 60 * 60));
	const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

	if (hours === 0) {
		return `${minutes}m`;
	}
	if (minutes === 0) {
		return `${hours}h`;
	}
	return `${hours}h ${minutes}m`;
}

export function toLocalISOString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	const seconds = String(date.getSeconds()).padStart(2, "0");
	const ms = String(date.getMilliseconds()).padStart(3, "0");

	return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}Z`;
}

/**
 * Rounds a date to the nearest hour.
 * Minutes < 30: rounds down to current hour
 * Minutes >= 30: rounds up to next hour
 */
export function roundToNearestHour(date: Date): Date {
	const rounded = new Date(date);
	const minutes = rounded.getMinutes();

	if (minutes >= 30) {
		rounded.setHours(rounded.getHours() + 1);
	}

	rounded.setMinutes(0);
	rounded.setSeconds(0);
	rounded.setMilliseconds(0);

	return rounded;
}

/**
 * Copies time components from sourceDateTime to instanceDate WITHOUT any timezone conversion.
 * This directly copies the hour/minute/second values regardless of timezone.
 */
export function applySourceTimeToInstanceDate(instanceDate: DateTime, sourceDateTime: DateTime): DateTime {
	return instanceDate.set({
		hour: sourceDateTime.hour,
		minute: sourceDateTime.minute,
		second: sourceDateTime.second,
		millisecond: sourceDateTime.millisecond,
	});
}

/**
 * Returns a Set of internal properties that should not be displayed in UI.
 * Includes calendar-specific property names and global internal properties.
 */
export function getInternalProperties(settings: SingleCalendarConfig): Set<string> {
	const properties = [
		settings.startProp,
		settings.endProp,
		settings.dateProp,
		settings.allDayProp,
		settings.skipProp,
		settings.rruleProp,
		settings.rruleSpecProp,
		settings.rruleIdProp,
		settings.titleProp,
		settings.zettelIdProp,
		...INTERNAL_FRONTMATTER_PROPERTIES,
	].filter((prop): prop is string => prop !== undefined);

	return new Set(properties);
}

/**
 * Categorizes frontmatter properties into display and other properties based on settings.
 * Filters out internal properties and optionally underscore-prefixed properties.
 */
export function categorizeProperties(
	frontmatter: Record<string, unknown>,
	settings: SingleCalendarConfig
): {
	displayProperties: [string, unknown][];
	otherProperties: [string, unknown][];
} {
	const internalProperties = getInternalProperties(settings);
	const displayPropertyKeys = new Set(settings.frontmatterDisplayProperties);

	const displayProperties: [string, unknown][] = [];
	const otherProperties: [string, unknown][] = [];

	for (const [key, value] of Object.entries(frontmatter)) {
		// Skip internal properties and empty values
		if (internalProperties.has(key) || !isNotEmpty(value)) {
			continue;
		}

		// Skip properties starting with underscore if configured
		if (settings.skipUnderscoreProperties && key.startsWith("_")) {
			continue;
		}

		if (displayPropertyKeys.has(key)) {
			displayProperties.push([key, value]);
		} else {
			otherProperties.push([key, value]);
		}
	}

	return { displayProperties, otherProperties };
}
