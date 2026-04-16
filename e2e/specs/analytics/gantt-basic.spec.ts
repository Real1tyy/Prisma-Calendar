import { expect, test } from "../../fixtures/electron";
import { openCalendarViewViaRibbon, switchView, unlockPro } from "../../fixtures/helpers";

// Gantt filters events to only those connected in the prerequisite graph
// (`normalize-events.ts`: `tracker.isConnected(filePath)`), so standalone
// events never produce bars. Exercising that happy path requires driving
// the "Assign prerequisites" picker modal — left for a phase-2 spec.
//
// For now this smoke just asserts that when Pro is unlocked and the user
// switches to Gantt, the Gantt chrome (Create button) renders instead of
// the upgrade banner — i.e. the Pro gate and the tab wiring both work.

test.describe("analytics: gantt basic", () => {
	test("gantt toolbar renders when Pro is unlocked", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);
		await unlockPro(obsidian.page);
		await switchView(obsidian.page, "gantt");

		await expect(obsidian.page.locator('[data-testid="prisma-gantt-create"]').first()).toBeVisible({
			timeout: 5_000,
		});
		await expect(obsidian.page.locator('[data-testid="prisma-pro-gate-GANTT"]')).toHaveCount(0);
	});
});
