import { todayStamp } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";

// Reassigning a category must propagate to dashboard by-category.
// Seeds via seedMany (UI modal) so all reactive trackers fire.
// After reassigning Alpha from Work → Personal, both Work (from Beta) and
// Personal (from Alpha) must appear in the dashboard ranking.

test.describe("cross-view: category reassignment propagates", () => {
	test("reassigning category surfaces new category in dashboard", async ({ calendar }) => {
		const [alpha] = await calendar.seedMany([
			{ title: "Alpha Task", start: todayStamp(9, 0), end: todayStamp(10, 0), categories: ["Work"] },
			{ title: "Beta Task", start: todayStamp(11, 0), end: todayStamp(12, 0), categories: ["Work"] },
		]);

		await calendar.unlockPro();

		await calendar.expectDashboardItem("dashboard-by-category", "Work");

		await calendar.switchView("calendar");
		await alpha.edit({ categories: ["Personal"] });

		await calendar.expectDashboardItem("dashboard-by-category", "Personal");
		await calendar.expectDashboardItem("dashboard-by-category", "Work");
	});
});
