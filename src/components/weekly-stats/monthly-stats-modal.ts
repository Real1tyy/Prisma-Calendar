import type { ParsedEvent } from "../../core/parser";
import type { Stats } from "../../utils/weekly-stats";
import { aggregateMonthlyStats, getMonthBounds } from "../../utils/weekly-stats";
import type { IntervalConfig } from "./interval-stats-modal";
import { IntervalStatsModal } from "./interval-stats-modal";

export class MonthlyStatsModal extends IntervalStatsModal {
	protected intervalConfig: IntervalConfig = {
		getBounds: (date: Date) => getMonthBounds(date),

		navigateNext: (date: Date) => {
			date.setMonth(date.getMonth() + 1);
		},

		navigatePrevious: (date: Date) => {
			date.setMonth(date.getMonth() - 1);
		},

		aggregateStats: (events: ParsedEvent[], date: Date): Stats => {
			return aggregateMonthlyStats(events, date);
		},

		formatDateRange: (start: Date, _end: Date): string => {
			return start.toLocaleDateString("en-US", {
				month: "long",
				year: "numeric",
			});
		},
	};

	protected getModalTitle(): string {
		return "Monthly Statistics";
	}
}
