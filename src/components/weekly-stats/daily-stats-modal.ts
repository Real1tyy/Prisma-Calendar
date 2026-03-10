import type { App } from "obsidian";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { aggregateDailyStats, getDayBounds, getMonthBounds, getWeekBounds } from "../../utils/weekly-stats";
import type { IntervalConfig } from "./interval-stats-modal";
import { createNavigationConfig, IntervalStatsModal } from "./interval-stats-modal";

export class DailyStatsModal extends IntervalStatsModal {
	private calendarViewType?: string;

	protected intervalConfig: IntervalConfig = {
		...createNavigationConfig(
			(date, dir) => date.setDate(date.getDate() + dir),
			(date, dir) => date.setDate(date.getDate() + 10 * dir)
		),
		getBounds: (date) => getDayBounds(date),
		aggregateStats: (events, date, mode, categoryProp) => aggregateDailyStats(events, date, mode, categoryProp),
		formatDateRange: (start, _end, locale) =>
			start.toLocaleDateString(locale, {
				weekday: "long",
				month: "short",
				day: "numeric",
				year: "numeric",
			}),
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
