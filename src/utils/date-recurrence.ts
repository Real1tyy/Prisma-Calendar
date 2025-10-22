import type { DateTime } from "luxon";

export type RecurrenceType = "daily" | "weekly" | "bi-weekly" | "monthly" | "bi-monthly" | "yearly";

export type Weekday = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

export const WEEKDAY_TO_NUMBER: Record<Weekday, number> = {
	sunday: 0,
	monday: 1,
	tuesday: 2,
	wednesday: 3,
	thursday: 4,
	friday: 5,
	saturday: 6,
};

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
 * Finds the next occurrence on specified weekdays
 */
export function getNextWeekdayOccurrence(currentDate: DateTime, weekdays: Weekday[]): DateTime {
	const currentWeekday = currentDate.weekday;
	const luxonWeekdays = weekdays.map((day) => {
		const dayNumber = WEEKDAY_TO_NUMBER[day];
		return dayNumber === 0 ? 7 : dayNumber;
	});

	const futureWeekdays = luxonWeekdays.filter((day) => day > currentWeekday);
	if (futureWeekdays.length > 0) {
		const nextWeekday = Math.min(...futureWeekdays);
		return currentDate.set({ weekday: nextWeekday as 1 | 2 | 3 | 4 | 5 | 6 | 7 });
	}

	const firstWeekday = Math.min(...luxonWeekdays);
	return currentDate.plus({ weeks: 1 }).set({ weekday: firstWeekday as 1 | 2 | 3 | 4 | 5 | 6 | 7 });
}

/**
 * Finds the next bi-weekly occurrence on specified weekdays
 */
export function getNextBiWeeklyOccurrence(currentDate: DateTime, weekdays: Weekday[]): DateTime {
	const nextWeekly = getNextWeekdayOccurrence(currentDate, weekdays);
	return nextWeekly.plus({ weeks: 1 });
}

/**
 * Calculates the next occurrence date based on recurrence type and optional weekdays
 */
export function getNextOccurrence(
	currentDate: DateTime,
	recurrenceType: RecurrenceType,
	weekdays?: Weekday[]
): DateTime {
	switch (recurrenceType) {
		case "daily":
			return currentDate.plus({ days: 1 });
		case "weekly":
			if (weekdays && weekdays.length > 0) {
				return getNextWeekdayOccurrence(currentDate, weekdays);
			}
			return currentDate.plus({ weeks: 1 });
		case "bi-weekly":
			if (weekdays && weekdays.length > 0) {
				return getNextBiWeeklyOccurrence(currentDate, weekdays);
			}
			return currentDate.plus({ weeks: 2 });
		case "monthly":
			return currentDate.plus({ months: 1 });
		case "bi-monthly":
			return currentDate.plus({ months: 2 });
		case "yearly":
			return currentDate.plus({ years: 1 });
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

	if ((rrules.type === "weekly" || rrules.type === "bi-weekly") && rrules.weekdays && rrules.weekdays.length > 0) {
		const weeksFromStart = Math.floor(currentDate.diff(normalizedStart, "weeks").weeks);
		const weekInterval = rrules.type === "bi-weekly" ? 2 : 1;
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
	} else {
		while (currentDate <= normalizedRangeEnd) {
			if (currentDate >= normalizedRangeStart) {
				yield currentDate;
			}

			const nextDate = getNextOccurrence(currentDate, rrules.type, rrules.weekdays);

			if (nextDate <= normalizedRangeEnd) {
				currentDate = nextDate;
			} else {
				break;
			}
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
	return instanceDate.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
}

export function calculateRecurringInstanceDateTime(
	nextInstanceDateTime: DateTime,
	nodeRecuringEventDateTime: DateTime,
	recurrenceType: RecurrenceType,
	allDay?: boolean
): DateTime {
	const originalInTargetZone = nodeRecuringEventDateTime.setZone(nextInstanceDateTime.zone);

	switch (recurrenceType) {
		case "daily":
		case "weekly":
		case "bi-weekly": {
			if (allDay) {
				return nextInstanceDateTime.startOf("day");
			}

			return nextInstanceDateTime.set({
				hour: originalInTargetZone.hour,
				minute: originalInTargetZone.minute,
				second: 0,
				millisecond: 0,
			});
		}

		case "monthly":
		case "bi-monthly": {
			if (allDay) {
				return nextInstanceDateTime.set({ day: originalInTargetZone.day }).startOf("day");
			}

			return nextInstanceDateTime.set({
				day: originalInTargetZone.day,
				hour: originalInTargetZone.hour,
				minute: originalInTargetZone.minute,
				second: 0,
				millisecond: 0,
			});
		}

		case "yearly": {
			if (allDay) {
				return nextInstanceDateTime
					.set({
						month: originalInTargetZone.month,
						day: originalInTargetZone.day,
					})
					.startOf("day");
			}

			return nextInstanceDateTime.set({
				month: originalInTargetZone.month,
				day: originalInTargetZone.day,
				hour: originalInTargetZone.hour,
				minute: originalInTargetZone.minute,
				second: 0,
				millisecond: 0,
			});
		}

		default:
			return nextInstanceDateTime.startOf("day");
	}
}
