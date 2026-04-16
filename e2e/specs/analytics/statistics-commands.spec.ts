import { expect, test } from "../../fixtures/electron";
import { clickToolbar, openCalendarViewViaRibbon } from "../../fixtures/helpers";

// Each toolbar stats button opens its stats modal. This is the real user
// path — click the button, assert the modal opens, close with Escape.
const TOOLBAR_BUTTONS = [
	{ id: "daily-stats", label: "daily" },
	{ id: "weekly-stats", label: "weekly" },
	{ id: "monthly-stats", label: "monthly" },
	{ id: "alltime-stats", label: "alltime" },
] as const;

test.describe("analytics: stats toolbar buttons", () => {
	for (const { id, label } of TOOLBAR_BUTTONS) {
		test(`${label} stats toolbar button opens a modal`, async ({ obsidian }) => {
			await openCalendarViewViaRibbon(obsidian.page);

			await clickToolbar(obsidian.page, id);

			await expect(obsidian.page.locator(".modal").first()).toBeVisible({ timeout: 5_000 });

			await obsidian.page.keyboard.press("Escape");
			await expect(obsidian.page.locator(".modal")).toHaveCount(0, { timeout: 5_000 });
		});
	}
});
