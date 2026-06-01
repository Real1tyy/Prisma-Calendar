import { isAllDayEvent, isTimedEvent, type CalendarEvent } from "../../types/calendar";

/**
 * Resolves the absolute [start, end) span of an event in epoch milliseconds.
 * All-day events without an explicit end assume a 1-day span. Returns null for
 * events that are neither timed nor all-day.
 */
function getEventSpan(event: CalendarEvent): { startMs: number; endMs: number } | null {
	const start = new Date(event.start);

	if (isTimedEvent(event)) {
		return { startMs: start.getTime(), endMs: new Date(event.end).getTime() };
	}
	if (isAllDayEvent(event)) {
		const end = new Date(start);
		end.setDate(end.getDate() + 1);
		return { startMs: start.getTime(), endMs: end.getTime() };
	}
	return null;
}

/**
 * Subtracts break time from a duration. When the event is only partially inside
 * the period it's being attributed to, `fractionOfSpan` scales the break so the
 * deduction is apportioned to the same slice (a crossing-midnight event with a
 * 30m break splits both work time and break time across the two days).
 */
function subtractBreak(durationMs: number, fractionOfSpan: number, breakMinutes: number | undefined): number {
	if (typeof breakMinutes === "number" && breakMinutes > 0) {
		const breakMs = breakMinutes * 60 * 1000 * fractionOfSpan;
		return Math.max(0, durationMs - breakMs);
	}
	return durationMs;
}

/**
 * Calculates the duration of an event in milliseconds.
 * For all-day events without explicit end time, assumes 1 day duration.
 * If the event has a breakMinutes value, it's subtracted from the duration.
 */
export function getEventDuration(event: CalendarEvent): number {
	const span = getEventSpan(event);
	if (!span) return 0;

	// Clamp malformed events (end < start) to 0 instead of letting a negative duration
	// poison aggregate totals, percentages, and capacity math. Happens in practice when
	// an import or stopwatch save records a crossing-midnight event without advancing
	// the end date (e.g. start 23:00, end 01:00 same day).
	const duration = Math.max(0, span.endMs - span.startMs);

	return subtractBreak(duration, 1, event.metadata.breakMinutes);
}

/**
 * Calculates the portion of an event's duration that falls inside the half-open
 * period [rangeStart, rangeEnd), in milliseconds. A crossing-midnight event
 * (e.g. 22:00–00:15) attributes only its in-day slice to each day instead of its
 * full span to both — keeping daily/weekly/monthly stats and capacity accurate.
 * Break time is apportioned to the in-range slice (see `subtractBreak`).
 */
export function getEventDurationInRange(event: CalendarEvent, rangeStart: Date, rangeEnd: Date): number {
	const span = getEventSpan(event);
	if (!span) return 0;

	const fullSpan = span.endMs - span.startMs;
	if (fullSpan <= 0) return 0;

	const overlapStart = Math.max(span.startMs, rangeStart.getTime());
	const overlapEnd = Math.min(span.endMs, rangeEnd.getTime());
	const overlap = overlapEnd - overlapStart;
	if (overlap <= 0) return 0;

	return subtractBreak(overlap, overlap / fullSpan, event.metadata.breakMinutes);
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

export type DurationFormatter = (ms: number) => string;

export function pickDurationFormatter(settings: { showDecimalHours: boolean }): DurationFormatter {
	return settings.showDecimalHours ? formatDurationAsDecimalHours : formatDuration;
}
