import { expect, test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";

// The default vault-seed ships one event with dates that won't match "today",
// so the daily-stats tab is effectively empty for this spec.

test.describe("analytics: stats (empty)", () => {
	test("daily-stats tab renders the empty-state message for a day with no events", async ({ calendar }) => {
		await calendar.switchView("daily-stats");
		await expect(calendar.page.locator(sel("prisma-stats-empty")).first()).toBeVisible();
	});
});
