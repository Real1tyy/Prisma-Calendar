import {
	eventByTitle,
	gotoToday,
	switchToView,
	todayISO,
	todayTimedEvent,
	waitForEvent,
} from "../../fixtures/calendar-helpers";
import { expect, test } from "../../fixtures/electron";
import { openCalendar } from "../../fixtures/helpers";
import { refreshCalendar, seedEvent } from "../../fixtures/seed-events";

test.describe("week view", () => {
	test("seeded timed event renders in today's column", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;
		seedEvent(vaultDir, todayTimedEvent("Week Timed", 10, 11));

		await openCalendar(page);
		await refreshCalendar(page);
		await gotoToday(page);
		await switchToView(page, "week");
		await waitForEvent(page, "Week Timed");

		// Week view lays each weekday as a `.fc-timegrid-col[data-date=YYYY-MM-DD]`.
		// The event should live inside today's column, not a neighbour.
		const todayCol = page.locator(`.fc-timegrid-col[data-date="${todayISO()}"]`).first();
		await expect(todayCol.locator('[data-event-title="Week Timed"]').first()).toBeVisible();
	});

	test("all-day event renders in the sticky all-day row, not a time column", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;
		seedEvent(vaultDir, { title: "Week Allday", date: todayISO(), allDay: true });

		await openCalendar(page);
		await refreshCalendar(page);
		await gotoToday(page);
		await switchToView(page, "week");
		await waitForEvent(page, "Week Allday");

		// All-day events render inside `.fc-daygrid-body` (the sticky band), not
		// inside `.fc-timegrid-col`. Assert the block's ancestry so a regression
		// that routes all-day events into the time grid is caught.
		const block = eventByTitle(page, "Week Allday");
		await expect(block).toBeVisible();
		const timegridAncestorCount = await block.locator("xpath=ancestor::*[contains(@class, 'fc-timegrid-col')]").count();
		expect(timegridAncestorCount).toBe(0);
		const allDayAncestorCount = await block.locator("xpath=ancestor::*[contains(@class, 'fc-daygrid-body')]").count();
		expect(allDayAncestorCount).toBe(1);
	});
});
