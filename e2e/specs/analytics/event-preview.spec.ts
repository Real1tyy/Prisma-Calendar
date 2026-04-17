import { todayStamp } from "../../fixtures/analytics-helpers";
import { expect, test } from "../../fixtures/electron";
import {
	clickContextMenuItem,
	createEventViaUI,
	openCalendarViewViaRibbon,
	rightClickEvent,
	waitForNoticesClear,
} from "../../fixtures/helpers";

// The "Enlarge" context-menu item opens a read-only preview modal via
// `showEventPreviewModal` (the "Preview" item is Obsidian's hover card,
// a different code path). The modal stamps `prisma-event-preview-modal`
// on its root and `prisma-event-preview-title` on the <h2> so specs
// don't depend on CSS class names.

test.describe("event preview modal", () => {
	test("right-click → Enlarge opens a modal with the event title", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);

		await createEventViaUI(obsidian.page, {
			title: "Preview Target",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
		});
		await waitForNoticesClear(obsidian.page);

		await rightClickEvent(obsidian.page, { title: "Preview Target" });
		await clickContextMenuItem(obsidian.page, "enlarge");

		const modal = obsidian.page.locator('[data-testid="prisma-event-preview-modal"]').first();
		await expect(modal).toBeVisible();
		await expect(modal.locator('[data-testid="prisma-event-preview-title"]')).toHaveText("Preview Target");
	});
});
