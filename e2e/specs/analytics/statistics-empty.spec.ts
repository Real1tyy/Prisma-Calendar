import { expect, test } from "../../fixtures/electron";
import { openCalendarViewViaRibbon, switchView } from "../../fixtures/helpers";

// The default vault-seed ships one event with dates that won't match "today",
// so the daily-stats tab is effectively empty for this spec.

test.describe("analytics: stats (empty)", () => {
	test("daily-stats tab renders the empty-state message for a day with no events", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);
		await switchView(obsidian.page, "daily-stats");

		await expect(obsidian.page.locator('[data-testid="prisma-stats-empty"]').first()).toBeVisible({
			timeout: 5_000,
		});
	});
});
