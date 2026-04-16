import { expect, test } from "../../fixtures/electron";
import { openCalendarViewViaRibbon, switchToGroupChild, unlockPro } from "../../fixtures/helpers";

// Dashboard is a group tab: the top-level `dashboard` button opens a dropdown
// of children (`dashboard-by-name` / `-by-category` / `-recurring`). Only the
// child panels actually render the 2x2 grid of cells — so we drill into the
// first child to assert the layout. Dashboard is also Pro-gated: the license
// must be unlocked before the content renders.

test.describe("analytics: dashboard layout", () => {
	test("dashboard 'By Name' child renders the chart / ranking / table cells when Pro is unlocked", async ({
		obsidian,
	}) => {
		await openCalendarViewViaRibbon(obsidian.page);
		await unlockPro(obsidian.page);
		await switchToGroupChild(obsidian.page, "dashboard", "dashboard-by-name");

		await expect(obsidian.page.locator('[data-testid="prisma-dashboard-cell-chart"]').first()).toBeVisible({
			timeout: 5_000,
		});
		await expect(obsidian.page.locator('[data-testid="prisma-dashboard-cell-ranking"]').first()).toBeVisible();
		await expect(obsidian.page.locator('[data-testid="prisma-dashboard-cell-table"]').first()).toBeVisible();
	});
});
