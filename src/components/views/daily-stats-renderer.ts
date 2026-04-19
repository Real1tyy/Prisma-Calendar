import type { CalendarBundle } from "../../core/calendar-bundle";
import { aggregateDailyStats, getDayBounds } from "../../utils/stats";
import { type IntervalStatsViewHandle, renderIntervalStatsInto } from "./interval-stats-view";

export type DailyStatsHandle = IntervalStatsViewHandle;

/**
 * Renders daily statistics (pie chart + table) into any container element.
 * The stats update when setDate() is called (e.g., synced to an adjacent calendar).
 */
export function renderDailyStatsInto(container: HTMLElement, bundle: CalendarBundle): DailyStatsHandle {
	return renderIntervalStatsInto(container, bundle, {
		getBounds: getDayBounds,
		aggregateStats: aggregateDailyStats,
		formatDate: (date, locale) =>
			date.toLocaleDateString(locale, {
				weekday: "long",
				month: "short",
				day: "numeric",
				year: "numeric",
			}),
		emptyMessage: "No events found for this day.",
		includeCapacity: true,
	});
}
