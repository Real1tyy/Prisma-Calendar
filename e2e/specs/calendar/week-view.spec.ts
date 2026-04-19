import { eventByTitle } from "../../fixtures/calendar-helpers";
import { anchorISO, fromAnchor } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";

// Anchored to past-Wednesday so the seeded day always lands inside the
// rendered week regardless of what day-of-week the suite runs on — see
// `docs/specs/e2e-date-anchor-robustness.md`.
//
// Uses the UI modal flow (`calendar.createEvent` / `calendar.seedOnDisk`)
// because direct disk writes + `refreshCalendar` don't reliably drive FC to
// paint the new tile inside the test budget; the modal flow is slower but
// deterministic — FC always renders what the plugin just saved.

test.describe("week view", () => {
	test("seeded timed event renders in the anchor day's column", async ({ calendar }) => {
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		await calendar.createEvent({
			title: "Week Timed",
			start: fromAnchor(0, 10, 0),
			end: fromAnchor(0, 11, 0),
		});

		// Week view lays each weekday as a `.fc-timegrid-col[data-date=YYYY-MM-DD]`.
		// The event should live inside the anchor day's column, not a neighbour.
		const anchorCol = calendar.page.locator(`.fc-timegrid-col[data-date="${anchorISO()}"]`).first();
		await expect(anchorCol.locator('[data-event-title="Week Timed"]').first()).toBeVisible();
	});

	test("all-day event renders in the sticky all-day row, not a time column", async ({ calendar }) => {
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		await calendar.seedOnDisk("Week Allday", { Date: anchorISO(), "All Day": true }, { awaitRender: true });

		// All-day events render inside `.fc-daygrid-body` (the sticky band), not
		// inside `.fc-timegrid-col`. Assert the block's ancestry so a regression
		// that routes all-day events into the time grid is caught.
		const block = eventByTitle(calendar.page, "Week Allday");
		await expect(block).toBeVisible();
		const timegridAncestorCount = await block.locator("xpath=ancestor::*[contains(@class, 'fc-timegrid-col')]").count();
		expect(timegridAncestorCount).toBe(0);
		const allDayAncestorCount = await block.locator("xpath=ancestor::*[contains(@class, 'fc-daygrid-body')]").count();
		expect(allDayAncestorCount).toBe(1);
	});
});
