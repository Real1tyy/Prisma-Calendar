import { todayISO, todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";

// After creating an event on the calendar, switching to every other view tab
// must show that event — proving the RxJS event-store subscription pipeline
// fans out correctly to all consumers.
//
// Uses todayStamp so every view (timeline, heatmap, stats) shows the event
// without extra navigation — each defaults to "today". Seeds via seedMany
// (UI modal) so all reactive trackers (name, category) are populated.

test.describe("cross-view: event creation propagates to all views", () => {
	test("event created on calendar appears in timeline, heatmap, and dashboard", async ({ calendar }) => {
		await calendar.seedMany([
			{ title: "Cross View Alpha", start: todayStamp(10, 0), end: todayStamp(11, 0), categories: ["Work"] },
		]);

		await calendar.unlockPro();

		await calendar.switchView("timeline");
		await calendar.expectTimelineItem("Cross View Alpha");

		await calendar.switchView("heatmap");
		await calendar.expectHeatmapCount(todayISO(), 1);

		await calendar.expectDashboardItem("dashboard-by-category", "Work");
	});

	test("event created on calendar appears in list view with correct title", async ({ calendar }) => {
		await calendar.seedMany([{ title: "List View Event", start: todayStamp(14, 0), end: todayStamp(15, 0) }]);

		await calendar.switchMode("list");
		const listRow = calendar.page.locator(".fc-list-event").filter({ hasText: "List View Event" });
		await expect(listRow.first()).toBeVisible();
	});

	test("event created on calendar appears in daily-stats content", async ({ calendar }) => {
		await calendar.seedMany([{ title: "Stats Visible", start: todayStamp(8, 0), end: todayStamp(10, 0) }]);

		await calendar.switchView("daily-stats");
		await expect(calendar.page.locator(sel("prisma-stats-empty"))).toHaveCount(0);
		await expect(calendar.page.locator(".prisma-stats-content").first()).toContainText("Stats Visible");
	});
});
