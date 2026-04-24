import { parseCategories } from "@real1ty-obsidian-plugins";

import { DEFAULT_CATEGORY_PROP } from "../../constants";
import type { CalendarEvent } from "../../types/calendar";
import { isTimedEvent } from "../../types/calendar";
import { extractNotesCoreName } from "../events/naming";
import { getEventDuration } from "./duration";
import { getDayBounds, getEventsInRange, getMonthBounds, getWeekBounds } from "./periods";

export type AggregationMode = "name" | "category";

export interface StatEntry {
	name: string;
	duration: number; // in milliseconds
	count: number;
	isRecurring: boolean;
}

export interface Stats {
	periodStart?: Date | undefined;
	periodEnd?: Date | undefined;
	entries: StatEntry[];
	totalDuration: number;
}

export type WeeklyStatEntry = StatEntry;

/**
 * Aggregates events for a given date range, grouping by name or category.
 *
 * Rules:
 * 1. Only timed events are included (all-day events are skipped)
 * 2. Events are grouped by their cleaned name (with IDs and dates stripped) or category
 * 3. Both virtual (recurring) and regular events use their actual title/category
 * 4. Calculates total duration and count for each group
 * 5. Events without a category are grouped under "No Category" when mode is "category"
 * 6. Break time is subtracted from duration if event has breakMinutes
 * 7. Events with multiple categories have their time split evenly across categories
 */
export function aggregateStats(
	events: CalendarEvent[],
	periodStart?: Date,
	periodEnd?: Date,
	mode: AggregationMode = "name",
	categoryProp = DEFAULT_CATEGORY_PROP
): Stats {
	let filteredEvents = events;

	if (periodStart && periodEnd) {
		filteredEvents = getEventsInRange(events, periodStart, periodEnd);
	}

	const timedEvents = filteredEvents.filter((event) => isTimedEvent(event));

	const groups = new Map<string, { duration: number; count: number; isRecurring: boolean }>();

	for (const event of timedEvents) {
		const isRecurring = event.virtualKind === "recurring";
		const duration = getEventDuration(event);

		let groupKeys: string[];

		if (mode === "category") {
			const categories = event.metadata?.categories ?? parseCategories(event.meta?.[categoryProp]);
			groupKeys = categories;
		} else {
			groupKeys = [extractNotesCoreName(event.title)];
		}

		const splitDuration = mode === "category" && groupKeys.length > 1 ? duration / groupKeys.length : duration;

		for (const groupKey of groupKeys) {
			const existing = groups.get(groupKey);

			if (existing) {
				existing.duration += splitDuration;
				existing.count += 1;
			} else {
				groups.set(groupKey, { duration: splitDuration, count: 1, isRecurring });
			}
		}
	}

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
	categoryProp = DEFAULT_CATEGORY_PROP
): Stats {
	const { start, end } = getWeekBounds(weekDate);
	return aggregateStats(events, start, end, mode, categoryProp);
}

/**
 * Aggregates events for a given month, grouping by name or category.
 */
export function aggregateMonthlyStats(
	events: CalendarEvent[],
	monthDate: Date,
	mode: AggregationMode = "name",
	categoryProp = DEFAULT_CATEGORY_PROP
): Stats {
	const { start, end } = getMonthBounds(monthDate);
	return aggregateStats(events, start, end, mode, categoryProp);
}

/**
 * Aggregates events for a given day, grouping by name or category.
 */
export function aggregateDailyStats(
	events: CalendarEvent[],
	dayDate: Date,
	mode: AggregationMode = "name",
	categoryProp = DEFAULT_CATEGORY_PROP
): Stats {
	const { start, end } = getDayBounds(dayDate);
	return aggregateStats(events, start, end, mode, categoryProp);
}
