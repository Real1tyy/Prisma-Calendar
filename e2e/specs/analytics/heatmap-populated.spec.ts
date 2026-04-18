import { todayISO, todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";

// Heatmap (Pro) renders one SVG cell per day of the current period with the
// cell's event count stamped as `data-count`. Seeding three events on today
// means today's cell must surface a count of 3.

test.describe("analytics: heatmap (populated)", () => {
	test("seeded events accumulate on today's cell", async ({ calendar }) => {
		await calendar.seedMany([
			{ title: "Morning Standup", start: todayStamp(9, 0), end: todayStamp(9, 30) },
			{ title: "Design Review", start: todayStamp(13, 0), end: todayStamp(14, 0) },
			{ title: "Workout", start: todayStamp(18, 0), end: todayStamp(19, 0) },
		]);

		await calendar.unlockPro();
		await calendar.switchView("heatmap");

		const container = calendar.page.locator(sel("prisma-heatmap-container")).first();
		await expect(container).toBeVisible();

		const todayCell = container.locator(`${sel("prisma-heatmap-cell")}[data-date="${todayISO()}"]`).first();
		await expect(todayCell).toHaveAttribute("data-count", "3");
	});
});
