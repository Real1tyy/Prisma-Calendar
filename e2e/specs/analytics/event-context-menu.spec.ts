import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { sel, TID } from "../../fixtures/testids";

test.describe("analytics: event context menu", () => {
	test("right-clicking an event then picking Edit opens the edit modal prefilled with the event's data", async ({
		calendar,
	}) => {
		const evt = await calendar.createEvent({
			title: "Context Menu Target",
			start: todayStamp(10, 0),
			end: todayStamp(11, 0),
		});

		await evt.rightClick("editEvent");

		await expect(calendar.page.locator(sel(TID.event.control("title"))).first()).toHaveValue("Context Menu Target");

		await calendar.page
			.locator(sel(TID.event.btn("cancel")))
			.first()
			.click();
	});
});
