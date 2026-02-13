import type { DateTime } from "luxon";

export interface EventStatistics {
	total: number;
	past: number;
	skipped: number;
	completed: number;
	completedPercentage: string;
	thisYear: number;
	thisMonth: number;
	thisWeek: number;
	frequency: string;
}

export interface EventItem {
	date: DateTime;
	skipped: boolean;
}

/**
 * Calculate comprehensive statistics for a list of events including
 * time-based breakdowns and frequency analysis.
 */
export function calculateEventStatistics(items: EventItem[], now: DateTime): EventStatistics {
	const startOfDay = now.startOf("day");
	const startOfYear = now.startOf("year");
	const startOfMonth = now.startOf("month");
	const startOfWeek = now.startOf("week");

	// Basic statistics
	const pastItems = items.filter((item) => item.date < startOfDay);
	const total = items.length;
	const past = pastItems.length;
	const skipped = pastItems.filter((item) => item.skipped).length;
	const completed = past - skipped;
	const completedPercentage = past > 0 ? ((completed / past) * 100).toFixed(1) : "0.0";

	// Time-based breakdowns
	const thisYear = pastItems.filter((item) => item.date >= startOfYear).length;
	const thisMonth = pastItems.filter((item) => item.date >= startOfMonth).length;
	const thisWeek = pastItems.filter((item) => item.date >= startOfWeek).length;

	return {
		total,
		past,
		skipped,
		completed,
		completedPercentage,
		thisYear,
		thisMonth,
		thisWeek,
		frequency: calculateFrequency(pastItems),
	};
}

/**
 * Calculate the frequency of events based on past event history.
 * Returns a human-readable frequency string (e.g., "3.2x/week", "1.5x/month").
 * Requires at least 2 past events to calculate meaningful frequency.
 */
function calculateFrequency(pastItems: EventItem[]): string {
	if (pastItems.length < 2) {
		return "";
	}

	// Sort by date to find first and last events
	const sortedPast = [...pastItems].sort((a, b) => a.date.toMillis() - b.date.toMillis());
	const firstEvent = sortedPast[0].date;
	const lastEvent = sortedPast[sortedPast.length - 1].date;

	// Calculate time span and average frequency
	const daysBetween = lastEvent.diff(firstEvent, "days").days;
	const weeksBetween = Math.max(daysBetween / 7, 1);
	const eventsPerWeek = pastItems.length / weeksBetween;

	// Format based on frequency magnitude
	if (eventsPerWeek >= 7) {
		// Multiple times per day
		const eventsPerDay = eventsPerWeek / 7;
		return `${eventsPerDay.toFixed(1)}x/day`;
	}

	if (eventsPerWeek >= 1) {
		// Multiple times per week
		return `${eventsPerWeek.toFixed(1)}x/week`;
	}

	// Less than once per week
	const weeksPerEvent = 1 / eventsPerWeek;
	if (weeksPerEvent >= 4) {
		// Monthly or less frequent
		const eventsPerMonth = weeksPerEvent / 4;
		return `${eventsPerMonth.toFixed(1)}x/month`;
	}

	// Between weekly and monthly
	return `${weeksPerEvent.toFixed(1)}x/week`;
}
