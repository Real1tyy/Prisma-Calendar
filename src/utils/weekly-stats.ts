import { parseCategories } from "@real1ty-obsidian-plugins";
import type { CalendarEvent } from "../types/calendar";
import { isAllDayEvent, isTimedEvent } from "../types/calendar";
import { extractNotesCoreName } from "./calendar-events";

export type AggregationMode = "name" | "category";

export interface StatEntry {
	name: string;
	duration: number; // in milliseconds
	count: number;
	isRecurring: boolean;
}

export interface Stats {
	periodStart?: Date;
	periodEnd?: Date;
	entries: StatEntry[];
	totalDuration: number;
}

export type WeeklyStatEntry = StatEntry;

/**
 * Calculates the duration of an event in milliseconds.
 * For all-day events without explicit end time, assumes 1 day duration.
 * If breakProp is provided and the event has a break value, it's subtracted from the duration.
 */
export function getEventDuration(event: CalendarEvent, breakProp?: string): number {
	const start = new Date(event.start);
	let end: Date;

	if (isTimedEvent(event)) {
		end = new Date(event.end);
	} else if (isAllDayEvent(event)) {
		// All-day event without explicit end: assume 1 day
		end = new Date(start);
		end.setDate(end.getDate() + 1);
	} else {
		// Non-all-day event without end: assume 0 duration
		return 0;
	}

	let duration = end.getTime() - start.getTime();

	// Subtract break time if breakProp is configured and event has a break value
	if (breakProp && event.meta?.[breakProp]) {
		const breakMinutes = Number(event.meta[breakProp]);
		if (!Number.isNaN(breakMinutes) && breakMinutes > 0) {
			const breakMs = breakMinutes * 60 * 1000;
			duration = Math.max(0, duration - breakMs);
		}
	}

	return duration;
}

/**
 * Filters events that fall within a given date range.
 * An event is included if it starts OR ends within the range.
 */
export function getEventsInRange(events: CalendarEvent[], rangeStart: Date, rangeEnd: Date): CalendarEvent[] {
	return events.filter((event) => {
		const start = new Date(event.start);
		const end = isTimedEvent(event) ? new Date(event.end) : start;

		// Event overlaps with range if it starts before range ends AND ends after range starts
		return start < rangeEnd && end > rangeStart;
	});
}

/**
 * Gets the start and end of the week (Monday - Sunday) for a given date.
 */
export function getWeekBounds(date: Date): { start: Date; end: Date } {
	const start = new Date(date);
	const day = start.getDay();
	const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday

	start.setDate(start.getDate() + diff);
	start.setHours(0, 0, 0, 0);

	const end = new Date(start);
	end.setDate(end.getDate() + 7);

	return { start, end };
}

/**
 * Gets the start and end of the month for a given date.
 */
export function getMonthBounds(date: Date): { start: Date; end: Date } {
	const start = new Date(date);
	start.setDate(1);
	start.setHours(0, 0, 0, 0);

	const end = new Date(start);
	end.setMonth(end.getMonth() + 1);

	return { start, end };
}

/**
 * Gets the start and end of the day for a given date.
 */
export function getDayBounds(date: Date): { start: Date; end: Date } {
	const start = new Date(date);
	start.setHours(0, 0, 0, 0);

	const end = new Date(start);
	end.setDate(end.getDate() + 1);

	return { start, end };
}

/**
 * Parses a category value that may contain multiple comma-separated categories.
 * Returns an array of trimmed category names, or ["No Category"] if empty/undefined.
 */
/**
 * Aggregates events for a given date range, grouping by name or category.
 *
 * Rules:
 * 1. Only timed events are included (all-day events are skipped)
 * 2. Events are grouped by their cleaned name (with IDs and dates stripped) or category
 * 3. Both virtual (recurring) and regular events use their actual title/category
 * 4. Calculates total duration and count for each group
 * 5. Events without a category are grouped under "No Category" when mode is "category"
 * 6. Break time is subtracted from duration if breakProp is configured
 * 7. Events with multiple comma-separated categories are counted under EACH category
 */
export function aggregateStats(
	events: CalendarEvent[],
	periodStart?: Date,
	periodEnd?: Date,
	mode: AggregationMode = "name",
	categoryProp = "Category",
	breakProp?: string
): Stats {
	let filteredEvents = events;

	// Filter to date range if provided
	if (periodStart && periodEnd) {
		filteredEvents = getEventsInRange(events, periodStart, periodEnd);
	}

	// Filter to only timed events (skip all-day events)
	const timedEvents = filteredEvents.filter((event) => isTimedEvent(event));

	// Group events
	const groups = new Map<string, { duration: number; count: number; isRecurring: boolean }>();

	for (const event of timedEvents) {
		const isRecurring = event.isVirtual;
		const duration = getEventDuration(event, breakProp);

		// Get all group keys for this event (may be multiple for category mode)
		let groupKeys: string[];

		if (mode === "category") {
			// Parse comma-separated categories - event is counted under each category
			groupKeys = parseCategories(event.meta?.[categoryProp]);
		} else {
			// Group by cleaned event name (default behavior)
			groupKeys = [extractNotesCoreName(event.title)];
		}

		// Add this event's duration and count to each group
		for (const groupKey of groupKeys) {
			const existing = groups.get(groupKey);

			if (existing) {
				existing.duration += duration;
				existing.count += 1;
			} else {
				groups.set(groupKey, { duration, count: 1, isRecurring });
			}
		}
	}

	// Convert to array and sort by duration (descending)
	const entries: StatEntry[] = Array.from(groups.entries())
		.map(([name, { duration, count, isRecurring }]) => ({
			name,
			duration,
			count,
			isRecurring,
		}))
		.sort((a, b) => b.duration - a.duration);

	const totalDuration = entries.reduce((sum, entry) => sum + entry.duration, 0);

	return {
		periodStart,
		periodEnd,
		entries,
		totalDuration,
	};
}

/**
 * Aggregates events for a given week, grouping by name or category.
 */
export function aggregateWeeklyStats(
	events: CalendarEvent[],
	weekDate: Date,
	mode: AggregationMode = "name",
	categoryProp = "Category",
	breakProp?: string
): Stats {
	const { start, end } = getWeekBounds(weekDate);
	return aggregateStats(events, start, end, mode, categoryProp, breakProp);
}

/**
 * Aggregates events for a given month, grouping by name or category.
 */
export function aggregateMonthlyStats(
	events: CalendarEvent[],
	monthDate: Date,
	mode: AggregationMode = "name",
	categoryProp = "Category",
	breakProp?: string
): Stats {
	const { start, end } = getMonthBounds(monthDate);
	return aggregateStats(events, start, end, mode, categoryProp, breakProp);
}

/**
 * Aggregates events for a given day, grouping by name or category.
 */
export function aggregateDailyStats(
	events: CalendarEvent[],
	dayDate: Date,
	mode: AggregationMode = "name",
	categoryProp = "Category",
	breakProp?: string
): Stats {
	const { start, end } = getDayBounds(dayDate);
	return aggregateStats(events, start, end, mode, categoryProp, breakProp);
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
