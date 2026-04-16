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

export function calculateEventStatistics(items: EventItem[], now: DateTime): EventStatistics {
	const startOfDay = now.startOf("day");
	const startOfYear = now.startOf("year");
	const startOfMonth = now.startOf("month");
	const startOfWeek = now.startOf("week");

	const pastItems = items.filter((item) => item.date < startOfDay);
	const total = items.length;
	const past = pastItems.length;
	const skipped = pastItems.filter((item) => item.skipped).length;
	const completed = past - skipped;
	const completedPercentage = past > 0 ? ((completed / past) * 100).toFixed(1) : "0.0";

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

function calculateFrequency(pastItems: EventItem[]): string {
	if (pastItems.length < 2) return "";

	const sortedPast = [...pastItems].sort((a, b) => a.date.toMillis() - b.date.toMillis());
	const firstEvent = sortedPast[0].date;
	const lastEvent = sortedPast[sortedPast.length - 1].date;

	const daysBetween = lastEvent.diff(firstEvent, "days").days;
	const weeksBetween = Math.max(daysBetween / 7, 1);
	const eventsPerWeek = pastItems.length / weeksBetween;

	if (eventsPerWeek >= 7) {
		const eventsPerDay = eventsPerWeek / 7;
		return `${eventsPerDay.toFixed(1)}x/day`;
	}

	if (eventsPerWeek >= 1) return `${eventsPerWeek.toFixed(1)}x/week`;

	const weeksPerEvent = 1 / eventsPerWeek;
	if (weeksPerEvent >= 4) {
		const eventsPerMonth = weeksPerEvent / 4;
		return `${eventsPerMonth.toFixed(1)}x/month`;
	}

	return `${weeksPerEvent.toFixed(1)}x/week`;
}
