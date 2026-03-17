import { cls, type TabDefinition } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { createDailyCalendar, type DailyCalendarHandle } from "./daily-calendar";
import { type DailyStatsHandle, renderDailyStatsInto } from "./daily-stats-renderer";

export function createDailyStatsTabDefinition(app: App, bundle: CalendarBundle): TabDefinition {
	let calendarHandle: DailyCalendarHandle | null = null;
	let statsHandle: DailyStatsHandle | null = null;

	return {
		id: "daily-stats",
		label: "Daily + Stats",
		render: (el) => {
			const wrapper = el.createDiv({ cls: cls("daily-stats-layout") });
			const leftCol = wrapper.createDiv({ cls: cls("daily-stats-left") });
			const rightCol = wrapper.createDiv({ cls: cls("daily-stats-right") });

			statsHandle = renderDailyStatsInto(rightCol, bundle);

			calendarHandle = createDailyCalendar(leftCol, app, bundle, {
				onDateChange: (date) => {
					statsHandle?.setDate(date);
				},
			});
		},
		cleanup: () => {
			statsHandle?.destroy();
			statsHandle = null;
			calendarHandle?.destroy();
			calendarHandle = null;
		},
	};
}
