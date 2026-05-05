import type { Page } from "@playwright/test";

import { expectGanttBarBackgroundHex, expectTimelineItemsBackgroundHex } from "../../fixtures/color-assertions";
import { fromAnchor, todayStamp } from "../../fixtures/dates";
import { expectAllColors } from "../../fixtures/dsl";
import { test } from "../../fixtures/electron";
import { assignPrerequisiteViaUI, ganttBarLocator } from "../../fixtures/helpers";
import { updateCalendarSettings } from "../../fixtures/seed-events";

// Settings mutations (color rules) must propagate to ALL views WITHOUT a
// page reload or manual tab switch. Path:
//   updateSettings → settingsStore RxJS subject emits
//     → ColorEvaluator recalculates
//     → Calendar: diffEvents fingerprint changes → tile re-mount → --event-color
//     → Timeline: vis-timeline redraws items → inline background-color
//     → Heatmap: cell counts unchanged but detail rows pick up new color

const CATEGORY = "Reactive";
const INITIAL_COLOR = "#ff5533";
const UPDATED_COLOR = "#33ccff";
const DEFAULT_NODE = "#cccccc";

async function setColorRule(page: Page, id: string, color: string, enabled: boolean): Promise<void> {
	await updateCalendarSettings(page, {
		defaultNodeColor: DEFAULT_NODE,
		colorRules: [{ id, expression: `Category.includes('${CATEGORY}')`, color, enabled }],
	});
}

test.describe("cross-view: settings changes propagate to all views", () => {
	test("changing a color rule repaints calendar tiles AND timeline items", async ({ calendar }) => {
		await setColorRule(calendar.page, "rule-reactive", INITIAL_COLOR, true);

		const events = await calendar.seedOnDiskMany([
			{ title: "Reactive One", start: todayStamp(9, 0), end: todayStamp(10, 0), category: CATEGORY },
			{ title: "Reactive Two", start: todayStamp(11, 0), end: todayStamp(12, 0), category: CATEGORY },
			{ title: "Reactive Three", start: todayStamp(14, 0), end: todayStamp(15, 0), category: CATEGORY },
		]);

		await calendar.switchMode("week");

		await expectAllColors(events, INITIAL_COLOR);

		await setColorRule(calendar.page, "rule-reactive", UPDATED_COLOR, true);
		await expectAllColors(events, UPDATED_COLOR);

		await calendar.switchView("timeline");
		await expectTimelineItemsBackgroundHex(
			calendar.page,
			events.map((e) => e.title),
			UPDATED_COLOR
		);

		await calendar.switchView("calendar");
		await calendar.switchMode("month");
		await calendar.goToAnchor();
		await calendar.seedMany([
			{
				title: "Gantt Upstream Reactive",
				start: fromAnchor(0, 9, 0),
				end: fromAnchor(0, 10, 0),
				categories: [CATEGORY],
			},
			{
				title: "Gantt Downstream Reactive",
				start: fromAnchor(10, 14, 0),
				end: fromAnchor(10, 15, 0),
				categories: [CATEGORY],
			},
		]);
		await assignPrerequisiteViaUI(calendar.page, "Gantt Downstream Reactive", "Gantt Upstream Reactive");
		await calendar.unlockPro();
		await calendar.switchView("gantt");
		for (const title of ["Gantt Upstream Reactive", "Gantt Downstream Reactive"]) {
			await expectGanttBarBackgroundHex(ganttBarLocator(calendar.page, title), UPDATED_COLOR);
		}
	});

	test("disabling a color rule drops calendar tiles to defaultNodeColor", async ({ calendar }) => {
		await setColorRule(calendar.page, "rule-disable", INITIAL_COLOR, true);

		const events = await calendar.seedOnDiskMany([
			{ title: "Disable Color A", start: todayStamp(10, 0), end: todayStamp(11, 0), category: CATEGORY },
			{ title: "Disable Color B", start: todayStamp(13, 0), end: todayStamp(14, 0), category: CATEGORY },
		]);

		await calendar.switchMode("week");
		await expectAllColors(events, INITIAL_COLOR);

		await setColorRule(calendar.page, "rule-disable", INITIAL_COLOR, false);
		await expectAllColors(events, DEFAULT_NODE);

		await calendar.switchView("timeline");
		await expectTimelineItemsBackgroundHex(
			calendar.page,
			events.map((e) => e.title),
			DEFAULT_NODE
		);
	});

	test("re-enabling a color rule repaints tiles from default back to the rule color", async ({ calendar }) => {
		await setColorRule(calendar.page, "rule-toggle", INITIAL_COLOR, false);

		const events = await calendar.seedOnDiskMany([
			{ title: "Toggle Color X", start: todayStamp(9, 0), end: todayStamp(10, 0), category: CATEGORY },
			{ title: "Toggle Color Y", start: todayStamp(15, 0), end: todayStamp(16, 0), category: CATEGORY },
		]);

		await calendar.switchMode("week");
		await expectAllColors(events, DEFAULT_NODE);

		await setColorRule(calendar.page, "rule-toggle", INITIAL_COLOR, true);
		await expectAllColors(events, INITIAL_COLOR);

		await calendar.switchView("timeline");
		await expectTimelineItemsBackgroundHex(
			calendar.page,
			events.map((e) => e.title),
			INITIAL_COLOR
		);
	});
});
