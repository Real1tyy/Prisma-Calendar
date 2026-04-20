import { gotoToday, monthCellForDate, todayISO, todayTimedEvent, waitForEvent } from "../../fixtures/calendar-helpers";
import { expect, test } from "../../fixtures/electron";
import { refreshCalendar, seedEvent } from "../../fixtures/seed-events";

test.describe("year view", () => {
	test("seeded event renders in the matching day cell across all twelve months", async ({ calendar }) => {
		const { page, vaultDir } = calendar;
		seedEvent(vaultDir, todayTimedEvent("Year Event", 10, 11));

		await refreshCalendar(page);
		await gotoToday(page);
		await calendar.switchMode("year");
		await waitForEvent(page, "Year Event");

		const cell = monthCellForDate(page, todayISO());
		await expect(cell.locator('[data-event-title="Year Event"]').first()).toBeVisible();

		const months = page.locator(".fc-multimonth-month");
		await expect(months).toHaveCount(12);
	});

	test("toolbar title switches to the year", async ({ calendar }) => {
		await gotoToday(calendar.page);

		await calendar.switchMode("year");
		const header = calendar.page.locator(".fc-toolbar-title").first();
		await expect(header).toHaveText(/^\d{4}$/);
	});

	test("color dots render in year view day cells", async ({ calendar }) => {
		const { page, vaultDir } = calendar;
		seedEvent(vaultDir, todayTimedEvent("Dots Event", 9, 10));

		await refreshCalendar(page);
		await gotoToday(page);
		await calendar.switchMode("year");
		await waitForEvent(page, "Dots Event");

		const cell = monthCellForDate(page, todayISO());
		const dots = cell.locator(".prisma-day-color-dots");
		await expect(dots.first()).toBeVisible();
	});

	test("clicking +more popover reveals hidden events", async ({ calendar }) => {
		const { page, vaultDir } = calendar;

		for (let i = 1; i <= 5; i++) {
			seedEvent(vaultDir, todayTimedEvent(`Popover Event ${i}`, 8 + i, 9 + i));
		}

		await refreshCalendar(page);
		await gotoToday(page);
		await calendar.switchMode("year");

		const cell = monthCellForDate(page, todayISO());
		const moreLink = cell.locator(".fc-daygrid-more-link");
		await expect(moreLink).toBeVisible();
		await moreLink.click();

		const popover = page.locator(".fc-popover");
		await expect(popover).toBeVisible();
		await expect(popover.locator('[data-event-title="Popover Event 1"]').first()).toBeVisible();
	});
});
