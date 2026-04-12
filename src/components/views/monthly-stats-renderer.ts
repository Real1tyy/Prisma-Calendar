import type { CalendarBundle } from "../../core/calendar-bundle";
import { aggregateMonthlyStats, getMonthBounds } from "../../utils/weekly-stats";
import { type IntervalStatsViewHandle, renderIntervalStatsInto } from "./interval-stats-view";

export type MonthlyStatsHandle = IntervalStatsViewHandle;

/**
 * Renders monthly statistics (pie chart + table) into any container element.
 * The stats update when setDate() is called (e.g., synced to an adjacent heatmap).
 */
export function renderMonthlyStatsInto(container: HTMLElement, bundle: CalendarBundle): MonthlyStatsHandle {
	return renderIntervalStatsInto(container, bundle, {
		getBounds: getMonthBounds,
		aggregateStats: aggregateMonthlyStats,
		formatDate: (date, locale) => date.toLocaleDateString(locale, { month: "long", year: "numeric" }),
		emptyMessage: "No events found for this month.",
	});
}
