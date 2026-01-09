import type { App } from "obsidian";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import type { AggregationMode, Stats } from "../../utils/weekly-stats";
import { aggregateDailyStats, getDayBounds, getMonthBounds, getWeekBounds } from "../../utils/weekly-stats";
import type { IntervalConfig } from "./interval-stats-modal";
import { IntervalStatsModal } from "./interval-stats-modal";

export class DailyStatsModal extends IntervalStatsModal {
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

	constructor(app: App, bundle: CalendarBundle, initialDate?: Date) {
		super(app, bundle, initialDate);
		this.initializeDateForCurrentView();
	}

	/**
	 * If today is within the current calendar view interval (week/month),
	 * show today. Otherwise show the first day of that interval.
	 */
	private initializeDateForCurrentView(): void {
		const today = new Date();
		const calendarDate = this.currentDate;

		const weekBounds = getWeekBounds(calendarDate);
		if (today >= weekBounds.start && today < weekBounds.end) {
			this.currentDate = new Date(today);
			this.currentDate.setHours(0, 0, 0, 0);
			return;
		}

		const monthBounds = getMonthBounds(calendarDate);
		if (today >= monthBounds.start && today < monthBounds.end) {
			this.currentDate = new Date(today);
			this.currentDate.setHours(0, 0, 0, 0);
			return;
		}

		this.currentDate = new Date(weekBounds.start);
	}

	protected getModalTitle(): string {
		return "Daily Statistics";
	}
}
