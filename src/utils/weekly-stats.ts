import type { ParsedEvent } from "../core/parser";
import { removeZettelId } from "./calendar-events";

export interface WeeklyStatEntry {
	name: string;
	duration: number; // in milliseconds
	count: number;
	isRecurring: boolean;
}

export interface WeeklyStats {
	weekStart: Date;
	weekEnd: Date;
	entries: WeeklyStatEntry[];
	totalDuration: number;
}

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
 * Filters events that fall within a given week.
 * An event is included if it starts OR ends within the week range.
 */
export function getEventsInWeek(events: ParsedEvent[], weekStart: Date, weekEnd: Date): ParsedEvent[] {
	return events.filter((event) => {
		const start = new Date(event.start);
		const end = event.end ? new Date(event.end) : start;

		// Event overlaps with week if it starts before week ends AND ends after week starts
		return start < weekEnd && end > weekStart;
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
 * Aggregates events for a given week, grouping by name and calculating total durations.
 *
 * Rules:
 * 1. Only timed events are included (all-day events are skipped)
 * 2. All recurring events are grouped together under "Recurring Events"
 * 3. Non-recurring events are grouped by name (with IDs stripped)
 * 4. Calculates total duration and count for each group
 */
export function aggregateWeeklyStats(events: ParsedEvent[], weekDate: Date): WeeklyStats {
	const { start: weekStart, end: weekEnd } = getWeekBounds(weekDate);
	const weekEvents = getEventsInWeek(events, weekStart, weekEnd);

	// Filter to only timed events (skip all-day events)
	const timedEvents = weekEvents.filter((event) => !event.allDay);

	// Group events
	const groups = new Map<string, { duration: number; count: number; isRecurring: boolean }>();

	for (const event of timedEvents) {
		let groupKey: string;
		let isRecurring: boolean;

		if (event.isVirtual) {
			groupKey = "Recurring Events";
			isRecurring = true;
		} else {
			groupKey = removeZettelId(event.title);
			isRecurring = false;
		}

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
	const entries: WeeklyStatEntry[] = Array.from(groups.entries())
		.map(([name, { duration, count, isRecurring }]) => ({
			name,
			duration,
			count,
			isRecurring,
		}))
		.sort((a, b) => b.duration - a.duration);

	const totalDuration = entries.reduce((sum, entry) => sum + entry.duration, 0);

	return {
		weekStart,
		weekEnd,
		entries,
		totalDuration,
	};
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
