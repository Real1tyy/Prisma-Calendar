import { todayStamp } from "../../fixtures/analytics-helpers";
import { expect, test } from "../../fixtures/electron";
import { openCalendarViewViaRibbon, seedEvents, switchView } from "../../fixtures/helpers";

test.describe("analytics: stats (populated)", () => {
	test("daily-stats surfaces events created through the UI", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);

		await seedEvents(obsidian.page, [
			{ title: "Work Session A", start: todayStamp(9, 0), end: todayStamp(10, 0) },
			{ title: "Work Session B", start: todayStamp(14, 0), end: todayStamp(14, 30) },
		]);

		await switchView(obsidian.page, "daily-stats");

		await expect(obsidian.page.locator('[data-testid="prisma-stats-empty"]')).toHaveCount(0, { timeout: 5_000 });
		await expect(obsidian.page.locator(".prisma-stats-content")).toContainText("Work Session A", { timeout: 5_000 });
		await expect(obsidian.page.locator(".prisma-stats-content")).toContainText("Work Session B");
	});
});
