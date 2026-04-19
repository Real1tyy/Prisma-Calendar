import type { CalendarEvent } from "../../types/calendar";
import { isTimedEvent } from "../../types/calendar";

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
