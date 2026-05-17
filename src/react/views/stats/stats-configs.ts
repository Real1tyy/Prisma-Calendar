import type { IntervalStatsConfig } from "./interval-stats-view";

export const DAILY_STATS_CONFIG: IntervalStatsConfig = {
	interval: "day",
	formatDate: (date, locale) =>
		date.toLocaleDateString(locale, {
			weekday: "long",
			month: "short",
			day: "numeric",
			year: "numeric",
		}),
	emptyMessage: "No events found for this day.",
	includeCapacity: true,
};

export const MONTHLY_STATS_CONFIG: IntervalStatsConfig = {
	interval: "month",
	formatDate: (date, locale) => date.toLocaleDateString(locale, { month: "long", year: "numeric" }),
	emptyMessage: "No events found for this month.",
};
