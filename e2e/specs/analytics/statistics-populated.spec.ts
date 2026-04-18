import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";

test.describe("analytics: stats (populated)", () => {
	test("daily-stats surfaces events created through the UI", async ({ calendar }) => {
		await calendar.seedMany([
			{ title: "Work Session A", start: todayStamp(9, 0), end: todayStamp(10, 0) },
			{ title: "Work Session B", start: todayStamp(14, 0), end: todayStamp(14, 30) },
		]);

		await calendar.switchView("daily-stats");

		await expect(calendar.page.locator(sel("prisma-stats-empty"))).toHaveCount(0);
		await expect(calendar.page.locator(".prisma-stats-content")).toContainText("Work Session A");
		await expect(calendar.page.locator(".prisma-stats-content")).toContainText("Work Session B");
	});
});
