import { createGridLayout, type GridLayoutHandle, type TabDefinition } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { createDailyCalendar, type DailyCalendarHandle, type DailyDragState } from "./daily-calendar";

export function createDualDailyTabDefinition(app: App, bundle: CalendarBundle): TabDefinition {
	let gridHandle: GridLayoutHandle | null = null;
	let leftCalendar: DailyCalendarHandle | null = null;
	let rightCalendar: DailyCalendarHandle | null = null;
	let focusedSide: "left" | "right" = "left";
	const sharedDragState: DailyDragState = { current: null };

	function getFocusedCalendar(): DailyCalendarHandle | null {
		return focusedSide === "left" ? leftCalendar : rightCalendar;
	}

	return {
		id: "dual-daily",
		label: "Dual Daily",
		keyHandlers: {
			ArrowLeft: () => getFocusedCalendar()?.prev(),
			ArrowRight: () => getFocusedCalendar()?.next(),
		},
		render: (el) => {
			gridHandle = createGridLayout(el, {
				cssPrefix: "prisma-dual-daily-",
				columns: 2,
				rows: 1,
				gap: "12px",
				dividers: true,
				cells: [
					{
						id: "left-calendar",
						label: "Calendar Left",
						row: 0,
						col: 0,
						render: (cellEl) => {
							leftCalendar = createDailyCalendar(cellEl, app, bundle, { sharedDragState });
							cellEl.addEventListener("pointerdown", () => {
								focusedSide = "left";
							});
						},
						cleanup: () => {
							leftCalendar?.destroy();
							leftCalendar = null;
						},
					},
					{
						id: "right-calendar",
						label: "Calendar Right",
						row: 0,
						col: 1,
						render: (cellEl) => {
							rightCalendar = createDailyCalendar(cellEl, app, bundle, { sharedDragState });
							cellEl.addEventListener("pointerdown", () => {
								focusedSide = "right";
							});
						},
						cleanup: () => {
							rightCalendar?.destroy();
							rightCalendar = null;
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
