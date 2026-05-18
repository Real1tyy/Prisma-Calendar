import { isTimedEvent, type CalendarEvent } from "../../types/calendar";

/**
 * Filters events that fall within a given date range. All-day events have no
 * `end`, so they're matched by their `start` falling inside the period; timed
 * events overlap-check against `start`/`end`.
 */
export function getEventsInRange(events: CalendarEvent[], rangeStart: Date, rangeEnd: Date): CalendarEvent[] {
	return events.filter((event) => {
		const start = new Date(event.start);
		if (!isTimedEvent(event)) {
			return start >= rangeStart && start <= rangeEnd;
		}
		const end = new Date(event.end);
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

export type StatsInterval = "day" | "week" | "month";

export function boundsByInterval(date: Date, interval: StatsInterval): { start: Date; end: Date } {
	switch (interval) {
		case "day":
			return getDayBounds(date);
		case "month":
			return getMonthBounds(date);
		case "week":
			return getWeekBounds(date);
	}
}
