import { todayISO, todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";

test.describe("analytics: stats (populated)", () => {
	test("daily-stats surfaces events created through the UI", async ({ calendar }) => {
		await calendar.seedOnDiskMany([
			{ title: "Work Session A", start: todayStamp(9, 0), end: todayStamp(10, 0) },
			{ title: "Work Session B", start: todayStamp(14, 0), end: todayStamp(14, 30) },
		]);

		await calendar.switchView("daily-stats");

		await expect(calendar.page.locator(sel("prisma-stats-empty"))).toHaveCount(0);
		await expect(calendar.page.locator(".prisma-stats-content")).toContainText("Work Session A");
		await expect(calendar.page.locator(".prisma-stats-content")).toContainText("Work Session B");
	});

	test("daily-stats lists both the all-day event and the timed event", async ({ calendar }) => {
		await calendar.seedOnDiskMany([
			{ title: "Holiday", date: todayISO(), allDay: true },
			{ title: "Team Meeting", start: todayStamp(9, 0), end: todayStamp(10, 0) },
		]);

		await calendar.switchView("daily-stats");

		await expect(calendar.page.locator(sel("prisma-stats-empty"))).toHaveCount(0);
		const table = calendar.page.locator(sel("prisma-stats-table")).first();
		await table.waitFor({ state: "visible" });
		await expect(table.locator(sel("prisma-stats-entry-Holiday")).first()).toBeVisible();
		await expect(table.locator(sel("prisma-stats-entry-Team Meeting")).first()).toBeVisible();
		// The all-day event contributes 0 duration but bumps the entry count.
		await expect(calendar.page.locator(sel("prisma-stats-entry-count-Holiday")).first()).toHaveText("1");
	});
});
