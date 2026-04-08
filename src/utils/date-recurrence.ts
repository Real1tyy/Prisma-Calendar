import type { DateTime } from "luxon";

import type { RecurrenceType } from "../types/recurring-event";
import { parseRecurrenceType } from "../types/recurring-event";
import type { Weekday } from "../types/weekday";
import { WEEKDAY_TO_NUMBER } from "../types/weekday";

export type { Weekday } from "../types/weekday";
export { WEEKDAY_TO_NUMBER };
export type { RecurrenceType };

/**
 * Checks if a given date matches any of the specified weekdays
 */
export function isDateOnWeekdays(date: DateTime, weekdays: Weekday[]): boolean {
	const dateWeekday = date.weekday;
	const luxonWeekdays = weekdays.map((day) => {
		const dayNumber = WEEKDAY_TO_NUMBER[day];
		return dayNumber === 0 ? 7 : dayNumber; // Convert Sunday from 0 to 7 for Luxon
	});

	return luxonWeekdays.includes(dateWeekday);
}

/**
 * Finds the next N-weekly occurrence on specified weekdays.
 * Returns next matching weekday in current week, OR first matching weekday N weeks later.
 */
export function getNextNWeeklyOccurrence(currentDate: DateTime, weekdays: Weekday[], weekInterval: number): DateTime {
	const currentWeekday = currentDate.weekday;
	const luxonWeekdays = weekdays.map((day) => {
		const dayNumber = WEEKDAY_TO_NUMBER[day];
		return dayNumber === 0 ? 7 : dayNumber;
	});

	// Check if there's a matching weekday later in the current week
	const futureWeekdays = luxonWeekdays.filter((day) => day > currentWeekday);
	if (futureWeekdays.length > 0) {
		// Stay in same cycle - return next matching weekday this week
		const nextWeekday = Math.min(...futureWeekdays);
		return currentDate.set({
			weekday: nextWeekday as 1 | 2 | 3 | 4 | 5 | 6 | 7,
		});
	}

	// No more matching weekdays this week, jump to next cycle (N weeks later)
	const firstWeekday = Math.min(...luxonWeekdays);
	return currentDate.plus({ weeks: weekInterval }).set({ weekday: firstWeekday as 1 | 2 | 3 | 4 | 5 | 6 | 7 });
}

/**
 * Finds the next bi-weekly occurrence on specified weekdays.
 * Thin wrapper around getNextNWeeklyOccurrence for backward compatibility.
 */
export function getNextBiWeeklyOccurrence(currentDate: DateTime, weekdays: Weekday[]): DateTime {
	return getNextNWeeklyOccurrence(currentDate, weekdays, 2);
}

/**
 * Calculates the next occurrence date based on recurrence type and optional weekdays
 */
export function getNextOccurrence(
	currentDate: DateTime,
	recurrenceType: RecurrenceType,
	weekdays?: Weekday[]
): DateTime {
	const parsed = parseRecurrenceType(recurrenceType);
	if (!parsed) return currentDate.plus({ days: 1 });

	switch (parsed.freq) {
		case "DAILY":
			return currentDate.plus({ days: parsed.interval });
		case "WEEKLY":
			if (weekdays && weekdays.length > 0) {
				return getNextNWeeklyOccurrence(currentDate, weekdays, parsed.interval);
			}
			return currentDate.plus({ weeks: parsed.interval });
		case "MONTHLY":
			return currentDate.plus({ months: parsed.interval });
		case "YEARLY":
			return currentDate.plus({ years: parsed.interval });
		default:
			return currentDate.plus({ days: 1 });
	}
}

/**
 * Iterates through occurrences in a given date range based on recurrence rules
 */
export function* iterateOccurrencesInRange(
	startDate: DateTime,
	rrules: { type: RecurrenceType; weekdays?: Weekday[] },
	rangeStart: DateTime,
	rangeEnd: DateTime
): Generator<DateTime, void, unknown> {
	const normalizedStart = startDate.startOf("day");
	const normalizedRangeStart = rangeStart.startOf("day");
	const normalizedRangeEnd = rangeEnd.startOf("day");

	let currentDate = normalizedStart >= normalizedRangeStart ? normalizedStart : normalizedRangeStart;

	const parsed = parseRecurrenceType(rrules.type);

	if (parsed && parsed.freq === "WEEKLY" && rrules.weekdays && rrules.weekdays.length > 0) {
		const weeksFromStart = Math.floor(currentDate.diff(normalizedStart, "weeks").weeks);
		const weekInterval = parsed.interval;
		const weekOffset = weeksFromStart % weekInterval;

		if (weekOffset !== 0) {
			currentDate = currentDate.plus({ weeks: weekInterval - weekOffset });
		}

		while (currentDate <= normalizedRangeEnd) {
			for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
				const checkDate = currentDate.plus({ days: dayOffset });

				if (
					checkDate >= normalizedRangeStart &&
					checkDate <= normalizedRangeEnd &&
					isDateOnWeekdays(checkDate, rrules.weekdays)
				) {
					yield checkDate;
				}
			}

			currentDate = currentDate.plus({ weeks: weekInterval });
		}
	} else if (parsed && parsed.freq === "MONTHLY") {
		const monthInterval = parsed.interval;

		// If currentDate is past the source, align it to the next occurrence in the cycle
		if (currentDate > normalizedStart) {
			const monthsFromStart = Math.floor(currentDate.diff(normalizedStart, "months").months);
			const cycleOffset = monthsFromStart % monthInterval;

			if (cycleOffset !== 0) {
				// Align to next cycle boundary
				currentDate = normalizedStart.plus({
					months: monthsFromStart + (monthInterval - cycleOffset),
				});
			} else {
				// Already aligned, use the current cycle position
				currentDate = normalizedStart.plus({ months: monthsFromStart });
			}
		}

		while (currentDate <= normalizedRangeEnd) {
			if (currentDate >= normalizedRangeStart) {
				yield currentDate;
			}

			currentDate = currentDate.plus({ months: monthInterval });
		}
	} else {
		// Align to the recurrence cycle when currentDate > normalizedStart.
		// Without this, yearly or custom-interval daily events would yield
		// rangeStart directly, which is almost never a valid occurrence date.
		if (parsed && currentDate > normalizedStart) {
			const unit = parsed.freq === "DAILY" ? "days" : "years";
			const diff = Math.floor(currentDate.diff(normalizedStart, unit)[unit]);
			const cycleOffset = diff % parsed.interval;

			if (cycleOffset !== 0) {
				currentDate = normalizedStart.plus({ [unit]: diff + (parsed.interval - cycleOffset) });
			} else {
				currentDate = normalizedStart.plus({ [unit]: diff });
			}
		}

		while (currentDate <= normalizedRangeEnd) {
			if (currentDate >= normalizedRangeStart) {
				yield currentDate;
			}

			const nextDate = getNextOccurrence(currentDate, rrules.type, rrules.weekdays);

			if (nextDate <= currentDate) {
				break;
			}

			currentDate = nextDate;
		}
	}
}

/**
 * Calculates a DateTime for a specific date with optional time
 */
export function calculateInstanceDateTime(instanceDate: DateTime, timeString?: string): DateTime {
	if (!timeString) {
		return instanceDate.startOf("day");
	}

	const [hours, minutes] = timeString.split(":").map(Number);
	return instanceDate.set({
		hour: hours,
		minute: minutes,
		second: 0,
		millisecond: 0,
	});
}
