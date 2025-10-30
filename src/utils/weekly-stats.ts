import type { ParsedEvent } from "../core/parser";
import { extractNotesCoreName } from "./calendar-events";

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
export type WeeklyStats = Stats;

/**
 * Calculates the duration of an event in milliseconds.
 * For all-day events without explicit end time, assumes 1 day duration.
 */
export function getEventDuration(event: ParsedEvent): number {
	const start = new Date(event.start);
	let end: Date;

	if (event.end) {
		end = new Date(event.end);
	} else if (event.allDay) {
		// All-day event without explicit end: assume 1 day
		end = new Date(start);
		end.setDate(end.getDate() + 1);
	} else {
		// Non-all-day event without end: assume 0 duration
		return 0;
	}

	return end.getTime() - start.getTime();
}

/**
 * Filters events that fall within a given date range.
 * An event is included if it starts OR ends within the range.
 */
export function getEventsInRange(events: ParsedEvent[], rangeStart: Date, rangeEnd: Date): ParsedEvent[] {
	return events.filter((event) => {
		const start = new Date(event.start);
		const end = event.end ? new Date(event.end) : start;

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
 * Aggregates events for a given date range, grouping by name and calculating total durations.
 *
 * Rules:
 * 1. Only timed events are included (all-day events are skipped)
 * 2. Events are grouped by their cleaned name (with IDs and dates stripped)
 * 3. Both virtual (recurring) and regular events use their actual title
 * 4. Calculates total duration and count for each group
 */
export function aggregateStats(events: ParsedEvent[], periodStart?: Date, periodEnd?: Date): Stats {
	let filteredEvents = events;

	// Filter to date range if provided
	if (periodStart && periodEnd) {
		filteredEvents = getEventsInRange(events, periodStart, periodEnd);
	}

	// Filter to only timed events (skip all-day events)
	const timedEvents = filteredEvents.filter((event) => !event.allDay);

	// Group events
	const groups = new Map<string, { duration: number; count: number; isRecurring: boolean }>();

	for (const event of timedEvents) {
		const groupKey = extractNotesCoreName(event.title);
		const isRecurring = event.isVirtual;

		const duration = getEventDuration(event);
		const existing = groups.get(groupKey);

		if (existing) {
			existing.duration += duration;
			existing.count += 1;
		} else {
			groups.set(groupKey, { duration, count: 1, isRecurring });
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
 * Aggregates events for a given week, grouping by name and calculating total durations.
 */
export function aggregateWeeklyStats(events: ParsedEvent[], weekDate: Date): WeeklyStats {
	const { start, end } = getWeekBounds(weekDate);
	return aggregateStats(events, start, end);
}

/**
 * Aggregates events for a given month, grouping by name and calculating total durations.
 */
export function aggregateMonthlyStats(events: ParsedEvent[], monthDate: Date): Stats {
	const { start, end } = getMonthBounds(monthDate);
	return aggregateStats(events, start, end);
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
 * Formats duration as a percentage of total.
 */
export function formatPercentage(duration: number, total: number): string {
	if (total === 0) return "0%";
	return `${((duration / total) * 100).toFixed(1)}%`;
}
