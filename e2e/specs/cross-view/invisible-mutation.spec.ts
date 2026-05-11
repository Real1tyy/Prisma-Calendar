import type { Page } from "@playwright/test";

import { expectBackgroundColor } from "../../fixtures/color-assertions";
import { todayISO, todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { updateCalendarSettings } from "../../fixtures/seed-events";
import { sel } from "../../fixtures/testids";

// Tabs are lazy-mounted once on first activation (tabbed-container.ts uses
// `rendered.add`), so a tab opened for the first time AFTER a mutation must
// read current state, not rely on a missed subscription event. Three flavors:
// (1) never-opened analytics tab sees prior creates, (2) calendar reflects
// creates made while it was the inactive tab, (3) color rule changed while
// calendar was inactive takes effect on first paint after reactivation.

const CATEGORY = "InvisibleMut";
const COLOR_BEFORE = "#ff5533";
const COLOR_AFTER = "#33ccff";
const DEFAULT_NODE = "#cccccc";

async function setColorRule(page: Page, color: string, enabled: boolean): Promise<void> {
	await updateCalendarSettings(page, {
		defaultNodeColor: DEFAULT_NODE,
		colorRules: [{ id: "rule-invisible", expression: `Category.includes('${CATEGORY}')`, color, enabled }],
	});
}

test.describe("cross-view: mutations while view is hidden propagate on next activate", () => {
	test("first mount of a never-opened tab reads current state, not a missed-subscription snapshot", async ({
		calendar,
	}) => {
		await calendar.unlockPro();
		// seedAndStabilize (vault.create) — the calendar toolbar's Create button is
		// hidden behind tab-panel-hidden as soon as we leave calendar, so any
		// "mutate while on another tab" path must bypass the UI.
		await calendar.seedAndStabilize([
			{ title: "Hidden Mutation A", startDate: todayStamp(10, 0), endDate: todayStamp(11, 0), category: CATEGORY },
		]);

		await calendar.switchView("heatmap");
		await calendar.expectHeatmapCount(todayISO(), 1);

		await calendar.seedAndStabilize([
			{ title: "Hidden Mutation B", startDate: todayStamp(13, 0), endDate: todayStamp(14, 0), category: CATEGORY },
		]);

		await calendar.switchView("timeline");
		await calendar.expectTimelineItem("Hidden Mutation A");
		await calendar.expectTimelineItem("Hidden Mutation B");
	});

	test("calendar reflects events created while it was the inactive tab", async ({ calendar }) => {
		await calendar.unlockPro();
		await calendar.seedAndStabilize([
			{ title: "Visible First", startDate: todayStamp(9, 0), endDate: todayStamp(10, 0), category: CATEGORY },
		]);
		await calendar.switchMode("week");

		await calendar.switchView("heatmap");
		await calendar.seedAndStabilize([
			{
				title: "Created While Calendar Hidden",
				startDate: todayStamp(15, 0),
				endDate: todayStamp(16, 0),
				category: CATEGORY,
			},
		]);

		await calendar.switchView("calendar");
		await expect(
			calendar.page.locator(sel("prisma-cal-event")).filter({ hasText: "Created While Calendar Hidden" }).first()
		).toBeVisible();
		await expect(
			calendar.page.locator(sel("prisma-cal-event")).filter({ hasText: "Visible First" }).first()
		).toBeVisible();
	});

	test("color rule changed while calendar is inactive takes effect on reactivation", async ({ calendar }) => {
		await setColorRule(calendar.page, COLOR_BEFORE, true);
		await calendar.unlockPro();

		const events = await calendar.seedOnDiskMany([
			{ title: "Invisible Repaint", start: todayStamp(10, 0), end: todayStamp(11, 0), category: CATEGORY },
		]);
		await calendar.switchMode("week");

		const tile = calendar.page.locator(sel("prisma-cal-event")).filter({ hasText: events[0]!.title }).first();
		await expectBackgroundColor(tile, COLOR_BEFORE);

		await calendar.switchView("timeline");
		await setColorRule(calendar.page, COLOR_AFTER, true);

		await calendar.switchView("calendar");
		const tileAfter = calendar.page.locator(sel("prisma-cal-event")).filter({ hasText: events[0]!.title }).first();
		await expectBackgroundColor(tileAfter, COLOR_AFTER);
	});
});
