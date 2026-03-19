import { createGridLayout, type GridLayoutHandle, type TabDefinition } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { createDailyCalendar, type DailyCalendarHandle } from "./daily-calendar";
import { type DailyStatsHandle, renderDailyStatsInto } from "./daily-stats-renderer";

export function createDailyStatsTabDefinition(app: App, bundle: CalendarBundle): TabDefinition {
	let gridHandle: GridLayoutHandle | null = null;
	let calendarHandle: DailyCalendarHandle | null = null;
	let statsHandle: DailyStatsHandle | null = null;

	return {
		id: "daily-stats",
		label: "Daily + Stats",
		keyHandlers: {
			ArrowLeft: () => calendarHandle?.prev(),
			ArrowRight: () => calendarHandle?.next(),
		},
		render: (el) => {
			gridHandle = createGridLayout(el, {
				cssPrefix: "prisma-daily-stats-",
				columns: 2,
				rows: 1,
				gap: "12px",
				dividers: true,
				cells: [
					{
						id: "calendar",
						label: "Calendar",
						row: 0,
						col: 0,
						render: (cellEl) => {
							calendarHandle = createDailyCalendar(cellEl, app, bundle, {
								onDateChange: (date) => statsHandle?.setDate(date),
							});
						},
						cleanup: () => {
							calendarHandle?.destroy();
							calendarHandle = null;
						},
					},
					{
						id: "stats",
						label: "Statistics",
						row: 0,
						col: 1,
						render: (cellEl) => {
							statsHandle = renderDailyStatsInto(cellEl, bundle);
						},
						cleanup: () => {
							statsHandle?.destroy();
							statsHandle = null;
						},
					},
				],
			});
		},
		cleanup: () => {
			gridHandle?.destroy();
			gridHandle = null;
		},
	};
}
