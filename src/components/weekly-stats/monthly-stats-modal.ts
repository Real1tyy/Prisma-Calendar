import { aggregateMonthlyStats, getMonthBounds } from "../../utils/stats";
import type { IntervalConfig } from "./interval-stats-modal";
import { createNavigationConfig, IntervalStatsModal } from "./interval-stats-modal";

export class MonthlyStatsModal extends IntervalStatsModal {
	protected intervalConfig: IntervalConfig = {
		...createNavigationConfig(
			(date, dir) => date.setMonth(date.getMonth() + dir),
			(date, dir) => date.setFullYear(date.getFullYear() + dir)
		),
		getBounds: (date) => getMonthBounds(date),
		aggregateStats: (events, date, mode, categoryProp) => aggregateMonthlyStats(events, date, mode, categoryProp),
		formatDateRange: (start, _end, locale) => start.toLocaleDateString(locale, { month: "long", year: "numeric" }),
	};

	protected getModalTitle(): string {
		return "Monthly Statistics";
	}
}
