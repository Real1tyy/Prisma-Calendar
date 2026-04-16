import { expect, test } from "../../fixtures/electron";
import { openCalendarViewViaRibbon, switchView } from "../../fixtures/helpers";

// Electron fixture fails the test on any renderer console.error / pageerror,
// so the "no errors" side is implicit — this spec just confirms the timeline
// tab becomes the active one after the user clicks it.
test.describe("analytics: timeline (empty)", () => {
	test("timeline tab becomes active on empty vault", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);
		await switchView(obsidian.page, "timeline");

		await expect(obsidian.page.locator('[data-testid="prisma-view-tab-timeline"]')).toHaveClass(/prisma-tab-active/, {
			timeout: 5_000,
		});
	});
});
