import { expect, test } from "../../fixtures/electron";
import {
	clickContextMenuItem,
	createEventViaUI,
	openCalendarViewViaRibbon,
	rightClickEvent,
} from "../../fixtures/helpers";

function todayStamp(hours: number, minutes = 0): string {
	const d = new Date();
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	const hh = String(hours).padStart(2, "0");
	const mi = String(minutes).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

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
