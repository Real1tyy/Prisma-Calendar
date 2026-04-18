import { expect, test } from "../../fixtures/electron";
import { sel, TID } from "../../fixtures/testids";

// Electron fixture fails the test on any renderer console.error / pageerror,
// so the "no errors" side is implicit — this spec just confirms the timeline
// tab becomes the active one after the user clicks it.
test.describe("analytics: timeline (empty)", () => {
	test("timeline tab becomes active on empty vault", async ({ calendar }) => {
		await calendar.switchView("timeline");
		await expect(calendar.page.locator(sel(TID.viewTab("timeline")))).toHaveClass(/prisma-tab-active/);
	});
});
