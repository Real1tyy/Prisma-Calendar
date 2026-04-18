import { test } from "../../fixtures/electron";
import { formatLocalDate } from "./events-helpers";

// Deleting a non-recurring event goes straight through — right-click the block,
// hit "Delete event" in the context menu, and the file is trashed immediately.
// No confirmation modal gates this path (that only exists for recurring sources
// with physical instances), so the file flip is the only signal to assert on.
test.describe("delete event", () => {
	test("right-click → Delete event removes file and block", async ({ calendar }) => {
		const today = formatLocalDate(new Date());
		const evt = await calendar.seedOnDisk("Delete Me", {
			"Start Date": `${today}T09:00`,
			"End Date": `${today}T10:00`,
		});

		await evt.expectVisible();
		await evt.rightClick("deleteEvent");

		await evt.expectExists(false);
		await evt.expectVisible(false);
	});
});
