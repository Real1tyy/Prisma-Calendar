import { DateTime } from "luxon";
import { formatDurationHumanReadable } from "./format";

/**
 * Format milliseconds as HH:MM:SS (e.g., "01:23:45").
 */
export function formatMsToHHMMSS(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Format milliseconds as MM:SS (e.g., "23:45").
 */
export function formatMsToMMSS(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function formatEventTimeInfo(event: { start: string; end?: string; allDay: boolean }): string {
	const startTime = DateTime.fromISO(event.start, { zone: "utc" });
	if (event.allDay) {
		return `All Day - ${startTime.toFormat("MMM d, yyyy")}`;
	}
	const endTime = event.end ? DateTime.fromISO(event.end, { zone: "utc" }) : null;
	if (endTime) {
		const durationText = formatDurationHumanReadable(startTime, endTime);
		return `${startTime.toFormat("MMM d, yyyy - h:mm a")} (${durationText})`;
	}
	return startTime.toFormat("MMM d, yyyy - h:mm a");
}

/**
 * Parse date string and treat it as local time, ignoring any timezone information.
 * This ensures events are processed based on local time regardless of how they're stored in UTC.
 *
 * @param dateString ISO date string, potentially with timezone info (e.g., "2024-01-15T10:00:00Z")
 * @returns Date object in local timezone, or null if parsing fails
 *
 * @example
 * parseAsLocalDate("2024-01-15T15:00:00Z") // Returns Date with 15:00 in LOCAL time (ignores Z)
 * parseAsLocalDate("2024-01-15T15:00:00+01:00") // Returns Date with 15:00 in LOCAL time (ignores +01:00)
 * parseAsLocalDate("2024-01-15") // Returns Date with 00:00 in LOCAL time
 */
export function parseAsLocalDate(dateString: string): Date | null {
	try {
		// Remove timezone indicators: Z, +00:00, -05:00, +0000, -0500, etc.
		// This regex matches timezone suffixes at the end of ISO strings
		const localDateString = String(dateString)
			.trim()
			.replace(/([+-]\d{2}:?\d{2}|Z)$/i, "");

		const date = new Date(localDateString);

		// Validate the date
		if (Number.isNaN(date.getTime())) {
			return null;
		}

		return date;
	} catch {
		return null;
	}
}
