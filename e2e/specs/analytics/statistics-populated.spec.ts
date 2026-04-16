import { expect, test } from "../../fixtures/electron";
import { createEventViaUI, openCalendarViewViaRibbon, switchView } from "../../fixtures/helpers";

function todayStamp(hours: number, minutes = 0): string {
	const d = new Date();
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	const hh = String(hours).padStart(2, "0");
	const mi = String(minutes).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

test.describe("analytics: stats (populated)", () => {
	test("daily-stats surfaces events created through the UI", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);

		await createEventViaUI(obsidian.page, {
			title: "Work Session A",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
		});
		await createEventViaUI(obsidian.page, {
			title: "Work Session B",
			start: todayStamp(14, 0),
			end: todayStamp(14, 30),
		});

		await switchView(obsidian.page, "daily-stats");

		await expect(obsidian.page.locator('[data-testid="prisma-stats-empty"]')).toHaveCount(0, { timeout: 5_000 });
		await expect(obsidian.page.locator(".prisma-stats-content")).toContainText("Work Session A", { timeout: 5_000 });
		await expect(obsidian.page.locator(".prisma-stats-content")).toContainText("Work Session B");
	});
});
