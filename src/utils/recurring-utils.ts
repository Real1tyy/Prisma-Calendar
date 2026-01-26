import { parsePositiveInt } from "@real1ty-obsidian-plugins";
import type { DateTime } from "luxon";
import type { RRuleFrontmatter } from "../types/recurring-event";
import { iterateOccurrencesInRange } from "./date-recurrence";

/**
 * Calculates the target number of physical instances to maintain for a recurring event.
 * For weekly/bi-weekly events, multiplies intervals by the number of weekdays.
 */
export function calculateTargetInstanceCount(
	rrules: RRuleFrontmatter,
	futureInstancesCountOverride: unknown,
	defaultFutureInstancesCount: number
): number {
	const intervals = parsePositiveInt(futureInstancesCountOverride, defaultFutureInstancesCount);

	const { type, weekdays } = rrules;

	if (type === "weekly" || type === "bi-weekly") {
		return (weekdays?.length || 1) * intervals;
	}
	return intervals;
}

/**
 * Extracts the appropriate start DateTime from RRule frontmatter.
 * Returns the date for all-day events, or startTime for timed events.
 */
export function getStartDateTime(rrules: RRuleFrontmatter): DateTime {
	return rrules.allDay ? rrules.date! : rrules.startTime!;
}

/**
 * Finds the first valid occurrence date for a recurring event.
 * For weekly/bi-weekly events with weekday rules, the start date might not match
 * the weekday rule, so we iterate to find the first valid occurrence.
 * For other recurrence types, the start date IS the first occurrence.
 */
export function findFirstValidStartDate(rrules: RRuleFrontmatter): DateTime {
	const startDateTime = getStartDateTime(rrules);

	// For weekly/bi-weekly, the start date might not match the weekday rule.
	// We must find the first date that IS a valid weekday on or after the start time.
	if ((rrules.type === "weekly" || rrules.type === "bi-weekly") && rrules.weekdays?.length) {
		// Use the iterator to find the true first occurrence.
		const iterator = iterateOccurrencesInRange(
			startDateTime,
			rrules,
			startDateTime, // Start searching from the start time
			startDateTime.plus({ years: 1 }) // Search a year ahead
		);
		const result = iterator.next();
		// If the iterator finds a value, that's our true start. Otherwise, fall back to the original start time.
		if (!result.done) {
			return result.value;
		}
	}

	// For all other types (daily, monthly, etc.), the start time IS the first occurrence.
	return startDateTime;
}
