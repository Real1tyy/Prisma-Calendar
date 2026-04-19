import { aggregateWeeklyStats, getWeekBounds } from "../../utils/stats";
import type { IntervalConfig } from "./interval-stats-modal";
import { createNavigationConfig, IntervalStatsModal } from "./interval-stats-modal";

export class WeeklyStatsModal extends IntervalStatsModal {
	protected intervalConfig: IntervalConfig = {
		...createNavigationConfig(
			(date: Date, dir: number) => date.setDate(date.getDate() + 7 * dir),
			(date: Date, dir: number) => date.setDate(date.getDate() + 28 * dir)
		),
		getBounds: (date) => getWeekBounds(date),
		aggregateStats: (events, date, mode, categoryProp) => aggregateWeeklyStats(events, date, mode, categoryProp),
		formatDateRange: (start, end, locale) => {
			const fmt = (d: Date): string =>
				d.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
			return `${fmt(start)} - ${fmt(end)}`;
		},
	};

	protected getModalTitle(): string {
		return "Weekly Statistics";
	}
}
