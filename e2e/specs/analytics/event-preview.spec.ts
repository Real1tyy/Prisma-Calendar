import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";

// The "Enlarge" context-menu item opens a read-only preview modal via
// `showEventPreviewModal` (the "Preview" item is Obsidian's hover card,
// a different code path). The modal stamps `prisma-event-preview-modal`
// on its root and `prisma-event-preview-title` on the <h2> so specs
// don't depend on CSS class names.

test.describe("event preview modal", () => {
	test("right-click → Enlarge opens a modal with the event title", async ({ calendar }) => {
		const evt = await calendar.createEvent({
			title: "Preview Target",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
		});
		await calendar.waitForNoticesClear();

		await evt.rightClick("enlarge");

		const modal = calendar.page.locator(sel("prisma-event-preview-modal")).first();
		await expect(modal).toBeVisible();
		await expect(modal.locator(sel("prisma-event-preview-title"))).toHaveText("Preview Target");
	});
});
