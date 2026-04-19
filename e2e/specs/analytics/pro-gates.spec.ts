import { expect, test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";

// Heatmap / Heatmap Monthly + Stats / Gantt / Dashboard are Pro-gated. One
// spec walks them in sequence on an unlicensed vault — each should swap its
// UI for the upgrade banner. Gating is cheap logic (`isPro ? render :
// banner`) and is covered unit-level in `pro-gated-content.test.ts`; this
// spec is the last-resort E2E that proves the real user path still surfaces
// the gate.

test.describe("analytics: pro gates (unlicensed)", () => {
	test("every pro-gated analytics view shows its upgrade banner", async ({ calendar }) => {
		await calendar.switchView("heatmap");
		await expect(calendar.page.locator(sel("prisma-pro-gate-HEATMAP")).first()).toBeVisible();

		await calendar.switchView("gantt");
		await expect(calendar.page.locator(sel("prisma-pro-gate-GANTT")).first()).toBeVisible();

		await calendar.switchToGroupChild("dashboard", "dashboard-by-name");
		await expect(calendar.page.locator(sel("prisma-pro-gate-DASHBOARD")).first()).toBeVisible();
	});
});
