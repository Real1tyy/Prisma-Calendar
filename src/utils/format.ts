import { isNotEmpty } from "@real1ty-obsidian-plugins";
import type { DateTime } from "luxon";
import type { Frontmatter } from "../types";
import type { CalendarEvent, CalendarEventData } from "../types/calendar";
import type { SingleCalendarConfig } from "../types/settings";
import { cleanupTitle } from "./event-naming";
import { getInternalProperties } from "./event-frontmatter";
import { extractPropertyText, getDisplayProperties } from "./property-display";

/**
 * Safely converts a value to a string if it's a primitive type.
 * Returns null if value is null/undefined or not a primitive (object/array).
 */
export function toSafeString(value: unknown): string | null {
	if (value == null) return null;
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return null;
}

/**
 * Converts a string to a Date, or returns the Date unchanged if already a Date.
 * Returns null if the input is null/undefined or if the resulting Date is invalid (NaN).
 * @param input - String date or Date object
 * @returns Date object or null if invalid
 */
export function intoDate(input: unknown): Date | null {
	if (input === null || input === undefined) {
		return null;
	}
	const date = typeof input === "string" ? new Date(input) : input instanceof Date ? input : null;
	if (date === null || Number.isNaN(date.getTime())) {
		return null;
	}
	return date;
}

/**
 * Formats a date/datetime for HTML datetime-local input fields.
 * Strips Z suffix to treat as local time and returns YYYY-MM-DDTHH:MM format.
 */
export function formatDateTimeForInput(dateInput: string | Date): string {
	// Strip Z suffix if present to treat as local time
	const dateStr = typeof dateInput === "string" ? dateInput.replace(/Z$/, "") : dateInput;
	const date = intoDate(dateStr);
	if (!date) {
		throw new Error("Invalid date input");
	}

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
	const date = intoDate(dateStr);
	if (!date) {
		throw new Error("Invalid date input");
	}

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

export function calculateDurationMinutes(start: string | Date, end: string | Date): number {
	const startDate = intoDate(start);
	const endDate = intoDate(end);
	if (!startDate || !endDate) {
		return 0;
	}
	const durationMs = endDate.getTime() - startDate.getTime();
	return Math.round(durationMs / (1000 * 60));
}

/**
 * Formats an event's date/time info as a display string appended to the title.
 * All-day: "Title - Wed, Feb 25, 2026"
 * Timed with end: "Title - 02:30 PM - 03:45 PM (1h 15m)"
 * Timed without end: "Title - 02:30 PM"
 */
export function formatEventDateSuffix(start: Date, end: Date | null, allDay: boolean, locale: string): string {
	if (allDay) {
		const dateStr = start.toLocaleDateString(locale, {
			weekday: "short",
			month: "short",
			day: "numeric",
			year: "numeric",
		});
		return ` - ${dateStr}`;
	}

	const startStr = start.toLocaleTimeString(locale, {
		hour: "2-digit",
		minute: "2-digit",
	});

	if (end) {
		const endStr = end.toLocaleTimeString(locale, {
			hour: "2-digit",
			minute: "2-digit",
		});
		const duration = calculateDuration(start, end);
		return ` - ${startStr} - ${endStr} (${duration})`;
	}

	return ` - ${startStr}`;
}

/**
 * Builds a tooltip string for an event, matching the calendar view hover format.
 * Accepts CalendarEvent or CalendarEventData.
 */
export function buildEventTooltip(
	event: CalendarEvent | CalendarEventData,
	settings: Pick<SingleCalendarConfig, "frontmatterDisplayProperties" | "frontmatterDisplayPropertiesAllDay" | "locale">
): string {
	const title = event.title;
	const meta = "meta" in event ? (event.meta ?? {}) : (event.extendedProps?.frontmatterDisplayData ?? {});
	const start = "ref" in event ? new Date(event.start) : event.start;
	const end = "ref" in event ? (event.type === "timed" && event.end ? new Date(event.end) : null) : event.end;
	const allDay = "ref" in event ? event.type === "allDay" : event.allDay;

	if (!start) return cleanupTitle(title);

	const tooltipParts: string[] = [cleanupTitle(title) + formatEventDateSuffix(start, end, allDay, settings.locale)];
	const displayProps = allDay ? settings.frontmatterDisplayPropertiesAllDay : settings.frontmatterDisplayProperties;
	for (const [prop, value] of getDisplayProperties(meta, displayProps)) {
		tooltipParts.push(`${prop}: ${extractPropertyText(value)}`);
	}
	return tooltipParts.join("\n");
}

/**
 * Ensures a datetime string ends with the expected `.000Z` suffix.
 * Handles inputs like "2025-02-18T09:00", "2025-02-18T09:00:00", and already-correct "2025-02-18T09:00:00.000Z".
 * Only processes strings containing "T" (timed values); date-only strings are returned unchanged.
 */
export function ensureISOSuffix(datetime: string): string {
	if (!datetime.includes("T")) return datetime;
	if (datetime.endsWith(".000Z")) return datetime;

	// Strip trailing Z if present (e.g. "...T09:00:00Z")
	const stripped = datetime.endsWith("Z") ? datetime.slice(0, -1) : datetime;

	// Count colon-separated time parts after the T
	const timePart = stripped.split("T")[1];
	const parts = timePart.split(":");

	if (parts.length === 2) {
		// "HH:MM" → "HH:MM:00.000Z"
		return `${stripped}:00.000Z`;
	}
	// "HH:MM:SS" or "HH:MM:SS.xxx" → strip any existing fractional seconds and append .000Z
	const base = stripped.includes(".") ? stripped.split(".")[0] : stripped;
	return `${base}.000Z`;
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
 * Calculates end time by adding duration minutes to a start time.
 * Expects and returns time in format "HH:MM:SS.000Z"
 * @param startTime - Time string in format "HH:MM:SS.000Z"
 * @param durationMinutes - Duration to add in minutes
 * @returns End time string in format "HH:MM:SS.000Z"
 */
export function calculateEndTime(startTime: string, durationMinutes: number): string {
	const timePart = startTime.split(".")[0];
	const [hours, minutes] = timePart.split(":").map(Number);
	const endMinutes = minutes + durationMinutes;
	const endHours = hours + Math.floor(endMinutes / 60);
	const finalMinutes = endMinutes % 60;
	return `${String(endHours).padStart(2, "0")}:${String(finalMinutes).padStart(2, "0")}:00.000Z`;
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
 * Categorizes frontmatter properties into display and other properties based on settings.
 * Filters out internal properties and optionally underscore-prefixed properties.
 * @param allDay - Whether this is an all-day event (determines which display properties list to use)
 */
/**
 * Extracts the first N non-empty, non-whitespace-only lines from note body content.
 * Returns them joined by newlines, or empty string if no lines found.
 */
export function getNotePreviewLines(content: string, lineCount: number): string {
	const lines: string[] = [];
	for (const line of content.split("\n")) {
		if (lines.length >= lineCount) break;
		const trimmed = line.trim();
		if (trimmed) lines.push(trimmed);
	}
	return lines.join("\n");
}

/**
 * Extracts hours and minutes from an ISO datetime string (position 11-16) and converts to total minutes.
 * E.g., "2025-03-15T14:30:00" → 870
 */
export function parseTimeToMins(isoStr: string): number {
	const timePart = isoStr.slice(11, 16);
	const [hours, minutes] = timePart.split(":").map(Number);
	return hours * 60 + minutes;
}

/**
 * Converts total minutes to an "HH:MM" string.
 * E.g., 870 → "14:30"
 */
export function minsToTimeStr(mins: number): string {
	const h = Math.floor(mins / 60)
		.toString()
		.padStart(2, "0");
	const m = (mins % 60).toString().padStart(2, "0");
	return `${h}:${m}`;
}

export function categorizeProperties(
	frontmatter: Frontmatter,
	settings: SingleCalendarConfig,
	allDay?: boolean
): {
	displayProperties: [string, unknown][];
	otherProperties: [string, unknown][];
} {
	const internalProperties = getInternalProperties(settings);
	const displayPropertiesList = allDay
		? settings.frontmatterDisplayPropertiesAllDay
		: settings.frontmatterDisplayProperties;
	const displayPropertyKeys = new Set(displayPropertiesList);

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
