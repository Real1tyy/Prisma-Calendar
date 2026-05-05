import { todayStamp } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";

// Editing an event (title change + reschedule) must propagate to every view.
// Seeds via seedMany (UI modal) so all reactive trackers fire.

test.describe("cross-view: event edit propagates to all views", () => {
	test("editing title and time updates calendar and timeline", async ({ calendar }) => {
		const [evt] = await calendar.seedMany([
			{ title: "Original Title", start: todayStamp(9, 0), end: todayStamp(10, 0) },
		]);

		await evt.edit({ title: "Renamed Event", start: todayStamp(14, 0), end: todayStamp(15, 0) });

		const renamed = await calendar.eventByTitle("Renamed Event");
		await renamed.expectVisible();
		await renamed.expectFrontmatter("Start Date", (v) => String(v ?? "").includes("T14:00"));

		await calendar.switchView("timeline");
		await calendar.expectTimelineItem("Renamed Event");
		await calendar.expectTimelineItem("Original Title", false);
	});

	test("changing category surfaces new category in dashboard", async ({ calendar }) => {
		const [evt] = await calendar.seedMany([
			{ title: "Category Shift", start: todayStamp(11, 0), end: todayStamp(12, 0), categories: ["Work"] },
		]);

		await calendar.unlockPro();

		await calendar.expectDashboardItem("dashboard-by-category", "Work");

		await calendar.switchView("calendar");
		await evt.edit({ categories: ["Personal"] });

		await calendar.expectDashboardItem("dashboard-by-category", "Personal");
	});
});
