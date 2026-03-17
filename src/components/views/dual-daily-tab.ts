import { cls, type TabDefinition } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { createDailyCalendar, type DailyCalendarHandle } from "./daily-calendar";

export function createDualDailyTabDefinition(app: App, bundle: CalendarBundle): TabDefinition {
	let leftCalendar: DailyCalendarHandle | null = null;
	let rightCalendar: DailyCalendarHandle | null = null;

	return {
		id: "dual-daily",
		label: "Dual Daily",
		render: (el) => {
			const wrapper = el.createDiv({ cls: cls("dual-daily-layout") });
			const leftCol = wrapper.createDiv({ cls: cls("dual-daily-left") });
			const rightCol = wrapper.createDiv({ cls: cls("dual-daily-right") });

			leftCalendar = createDailyCalendar(leftCol, app, bundle);
			rightCalendar = createDailyCalendar(rightCol, app, bundle);
		},
		cleanup: () => {
			leftCalendar?.destroy();
			leftCalendar = null;
			rightCalendar?.destroy();
			rightCalendar = null;
		},
	};
}
