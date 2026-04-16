import { expect, test } from "../../fixtures/electron";
import { openCalendarViewViaRibbon, switchToGroupChild, switchView } from "../../fixtures/helpers";

// Heatmap / Gantt / Dashboard are Pro-gated. One spec walks all three in
// sequence on an unlicensed vault — each should swap its UI for the upgrade
// banner. Heatmap-monthly-stats shares the HEATMAP banner so it isn't
// revisited here. Gating is cheap logic (`isPro ? render : banner`) and is
// covered unit-level in `pro-gated-content.test.ts`; this spec is the
// last-resort E2E that proves the real user path still surfaces the gate.

test.describe("analytics: pro gates (unlicensed)", () => {
	test("every pro-gated analytics view shows its upgrade banner", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);

		await switchView(obsidian.page, "heatmap");
		await expect(obsidian.page.locator('[data-testid="prisma-pro-gate-HEATMAP"]').first()).toBeVisible({
			timeout: 5_000,
		});

		await switchView(obsidian.page, "gantt");
		await expect(obsidian.page.locator('[data-testid="prisma-pro-gate-GANTT"]').first()).toBeVisible({
			timeout: 5_000,
		});

		await switchToGroupChild(obsidian.page, "dashboard", "dashboard-by-name");
		await expect(obsidian.page.locator('[data-testid="prisma-pro-gate-DASHBOARD"]').first()).toBeVisible({
			timeout: 5_000,
		});
	});
});
