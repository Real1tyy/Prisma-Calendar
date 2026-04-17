import { todayStamp } from "../../fixtures/analytics-helpers";
import { expect, test } from "../../fixtures/electron";
import {
	clickContextMenuItem,
	createEventViaUI,
	openCalendarViewViaRibbon,
	rightClickEvent,
} from "../../fixtures/helpers";

test.describe("analytics: event context menu", () => {
	test("right-clicking an event then picking Edit opens the edit modal prefilled with the event's data", async ({
		obsidian,
	}) => {
		await openCalendarViewViaRibbon(obsidian.page);

		await createEventViaUI(obsidian.page, {
			title: "Context Menu Target",
			start: todayStamp(10, 0),
			end: todayStamp(11, 0),
		});

		await rightClickEvent(obsidian.page, { title: "Context Menu Target" });
		await clickContextMenuItem(obsidian.page, "editEvent");

		await expect(obsidian.page.locator('[data-testid="prisma-event-control-title"]').first()).toHaveValue(
			"Context Menu Target",
			{ timeout: 5_000 }
		);

		await obsidian.page.locator('[data-testid="prisma-event-btn-cancel"]').first().click();
	});
});
