import { todayStamp } from "../../fixtures/analytics-helpers";
import { expect, test } from "../../fixtures/electron";
import { openCalendarViewViaRibbon, seedEvents, switchView, unlockPro } from "../../fixtures/helpers";

// Heatmap (Pro) renders one SVG cell per day of the current period with the
// cell's event count stamped as `data-count`. Seeding three events on today
// means today's cell must surface a count of 3.

function todayDateKey(): string {
	return todayStamp(0, 0).slice(0, 10);
}

test.describe("analytics: heatmap (populated)", () => {
	test("seeded events accumulate on today's cell", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);

		await seedEvents(obsidian.page, [
			{ title: "Morning Standup", start: todayStamp(9, 0), end: todayStamp(9, 30) },
			{ title: "Design Review", start: todayStamp(13, 0), end: todayStamp(14, 0) },
			{ title: "Workout", start: todayStamp(18, 0), end: todayStamp(19, 0) },
		]);

		await unlockPro(obsidian.page);
		await switchView(obsidian.page, "heatmap");

		const container = obsidian.page.locator('[data-testid="prisma-heatmap-container"]').first();
		await expect(container).toBeVisible({ timeout: 10_000 });

		const todayCell = container.locator(`[data-testid="prisma-heatmap-cell"][data-date="${todayDateKey()}"]`).first();
		await expect(todayCell).toHaveAttribute("data-count", "3", { timeout: 15_000 });
	});
});
