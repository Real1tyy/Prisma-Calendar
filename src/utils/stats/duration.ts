import type { CalendarEvent } from "../../types/calendar";
import { isAllDayEvent, isTimedEvent } from "../../types/calendar";

/**
 * Calculates the duration of an event in milliseconds.
 * For all-day events without explicit end time, assumes 1 day duration.
 * If the event has a breakMinutes value, it's subtracted from the duration.
 */
export function getEventDuration(event: CalendarEvent): number {
	const start = new Date(event.start);
	let end: Date;

	if (isTimedEvent(event)) {
		end = new Date(event.end);
	} else if (isAllDayEvent(event)) {
		end = new Date(start);
		end.setDate(end.getDate() + 1);
	} else {
		return 0;
	}

	// Clamp malformed events (end < start) to 0 instead of letting a negative duration
	// poison aggregate totals, percentages, and capacity math. Happens in practice when
	// an import or stopwatch save records a crossing-midnight event without advancing
	// the end date (e.g. start 23:00, end 01:00 same day).
	let duration = Math.max(0, end.getTime() - start.getTime());

	const breakMinutes = event.metadata.breakMinutes;
	if (typeof breakMinutes === "number" && breakMinutes > 0) {
		const breakMs = breakMinutes * 60 * 1000;
		duration = Math.max(0, duration - breakMs);
	}

	return duration;
}

/**
 * Formats duration in milliseconds to a human-readable string.
 * Examples: "2h 30m", "45m", "1d 4h"
 */
export function formatDuration(ms: number): string {
	if (ms === 0) return "0m";

	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	const parts: string[] = [];

	if (days > 0) {
		parts.push(`${days}d`);
	}
	if (hours % 24 > 0) {
		parts.push(`${hours % 24}h`);
	}
	if (minutes % 60 > 0) {
		parts.push(`${minutes % 60}m`);
	}

	return parts.join(" ") || "0m";
}

/**
 * Formats duration in milliseconds to decimal hours.
 * Example: 90000000ms (25 hours) -> "25.0h"
 */
export function formatDurationAsDecimalHours(ms: number): string {
	const hours = ms / (1000 * 60 * 60);
	return `${hours.toFixed(1)}h`;
}

/**
 * Formats duration as a percentage of total.
 */
export function formatPercentage(duration: number, total: number): string {
	if (total === 0) return "0%";
	return `${((duration / total) * 100).toFixed(1)}%`;
}
