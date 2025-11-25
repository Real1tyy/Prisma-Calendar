import type { ParsedEvent } from "../../core/parser";
import type { AggregationMode, Stats } from "../../utils/weekly-stats";
import { aggregateWeeklyStats, getWeekBounds } from "../../utils/weekly-stats";
import type { IntervalConfig } from "./interval-stats-modal";
import { IntervalStatsModal } from "./interval-stats-modal";

export class WeeklyStatsModal extends IntervalStatsModal {
	protected intervalConfig: IntervalConfig = {
		getBounds: (date: Date) => getWeekBounds(date),

		navigateNext: (date: Date) => {
			date.setDate(date.getDate() + 7);
		},

		navigatePrevious: (date: Date) => {
			date.setDate(date.getDate() - 7);
		},

		aggregateStats: (
			events: ParsedEvent[],
			date: Date,
			mode: AggregationMode,
			categoryProp: string,
			breakProp?: string
		): Stats => {
			return aggregateWeeklyStats(events, date, { mode, categoryProp, breakProp });
		},

		formatDateRange: (start: Date, end: Date): string => {
			const formatDate = (date: Date): string => {
				return date.toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
					year: "numeric",
				});
			};
			return `${formatDate(start)} - ${formatDate(end)}`;
		},
	};

	protected getModalTitle(): string {
		return "Weekly Statistics";
	}
}
