import { expect, test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";

// Dashboard is a group tab: the top-level `dashboard` button opens a dropdown
// of children (`dashboard-by-name` / `-by-category` / `-recurring`). Only the
// child panels actually render the 2x2 grid of cells — so we drill into the
// first child to assert the layout. Dashboard is also Pro-gated: the license
// must be unlocked before the content renders.

test.describe("analytics: dashboard layout", () => {
	test("dashboard 'By Name' child renders the chart / ranking / table cells when Pro is unlocked", async ({
		calendar,
	}) => {
		await calendar.unlockPro();
		await calendar.switchToGroupChild("dashboard", "dashboard-by-name");

		await expect(calendar.page.locator(sel("prisma-dashboard-cell-chart")).first()).toBeVisible();
		await expect(calendar.page.locator(sel("prisma-dashboard-cell-ranking")).first()).toBeVisible();
		await expect(calendar.page.locator(sel("prisma-dashboard-cell-table")).first()).toBeVisible();
	});
});
