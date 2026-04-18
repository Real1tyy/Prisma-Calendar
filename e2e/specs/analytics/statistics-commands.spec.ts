import { expect, test } from "../../fixtures/electron";
import type { ToolbarActionKey } from "../../fixtures/testids";

// Each toolbar stats button opens its stats modal. This is the real user
// path — click the button, assert the modal opens, close with Escape.
const TOOLBAR_BUTTONS: ReadonlyArray<{ id: ToolbarActionKey; label: string }> = [
	{ id: "daily-stats", label: "daily" },
	{ id: "weekly-stats", label: "weekly" },
	{ id: "monthly-stats", label: "monthly" },
	{ id: "alltime-stats", label: "alltime" },
];

test.describe("analytics: stats toolbar buttons", () => {
	for (const { id, label } of TOOLBAR_BUTTONS) {
		test(`${label} stats toolbar button opens a modal`, async ({ calendar }) => {
			await calendar.clickToolbar(id);

			await expect(calendar.page.locator(".modal").first()).toBeVisible();

			await calendar.page.keyboard.press("Escape");
			await expect(calendar.page.locator(".modal")).toHaveCount(0);
		});
	}
});
