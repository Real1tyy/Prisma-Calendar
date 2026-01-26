import type { App } from "obsidian";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import type { AggregationMode, Stats } from "../../utils/weekly-stats";
import { aggregateDailyStats, getDayBounds, getMonthBounds, getWeekBounds } from "../../utils/weekly-stats";
import type { IntervalConfig } from "./interval-stats-modal";
import { IntervalStatsModal } from "./interval-stats-modal";

export class DailyStatsModal extends IntervalStatsModal {
	private calendarViewType?: string;

	protected intervalConfig: IntervalConfig = {
		getBounds: (date: Date) => getDayBounds(date),

		navigateNext: (date: Date) => {
			date.setDate(date.getDate() + 1);
		},

		navigatePrevious: (date: Date) => {
			date.setDate(date.getDate() - 1);
		},

		navigateFastNext: (date: Date) => {
			date.setDate(date.getDate() + 10);
		},

		navigateFastPrevious: (date: Date) => {
			date.setDate(date.getDate() - 10);
		},

		aggregateStats: (
			events: CalendarEvent[],
			date: Date,
			mode: AggregationMode,
			categoryProp: string,
			breakProp?: string
		): Stats => {
			return aggregateDailyStats(events, date, mode, categoryProp, breakProp);
		},

		formatDateRange: (start: Date, _end: Date): string => {
			return start.toLocaleDateString("en-US", {
				weekday: "long",
				month: "short",
				day: "numeric",
				year: "numeric",
			});
		},
	};

	constructor(app: App, bundle: CalendarBundle, initialDate?: Date, calendarViewType?: string) {
		super(app, bundle, initialDate);
		this.calendarViewType = calendarViewType;
		this.initializeDateForCurrentView();
	}

	/**
	 * If in day view, use the exact date passed in.
	 * If in week/month view and today is within that interval, show today.
	 * Otherwise show the first day of the interval.
	 */
	private initializeDateForCurrentView(): void {
		// Day view: use the exact date passed in
		if (this.calendarViewType === "timeGridDay") {
			this.currentDate = new Date(this.currentDate);
			this.currentDate.setHours(0, 0, 0, 0);
			return;
		}

		this.currentDate = this.getTodayOrIntervalStart();
	}

	private getTodayOrIntervalStart(): Date {
		const today = new Date();
		const bounds =
			this.calendarViewType === "dayGridMonth" ? getMonthBounds(this.currentDate) : getWeekBounds(this.currentDate);

		const result = today >= bounds.start && today < bounds.end ? new Date(today) : new Date(bounds.start);
		result.setHours(0, 0, 0, 0);
		return result;
	}

	protected getModalTitle(): string {
		return "Daily Statistics";
	}
}
