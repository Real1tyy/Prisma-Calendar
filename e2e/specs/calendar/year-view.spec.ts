import { gotoToday, monthCellForDate, todayISO, todayTimedEvent } from "../../fixtures/calendar-helpers";
import { anchorDayISO, fromAnchor } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { refreshCalendar, seedEvent, updateCalendarSettings } from "../../fixtures/seed-events";

test.describe("year view", () => {
	test("seeded event renders in the matching day cell across all twelve months", async ({ calendar }) => {
		const { page, vaultDir } = calendar;
		seedEvent(vaultDir, { title: "Year Event", startDate: fromAnchor(0, 10, 0), endDate: fromAnchor(0, 11, 0) });

		await refreshCalendar(page);
		await calendar.goToAnchor();
		await calendar.switchMode("year");

		// Year view uses compact cells with dayMaxEvents — the event may be
		// behind a +more popover, so assert DOM attachment in the correct cell
		// rather than CSS visibility.
		const cell = monthCellForDate(page, anchorDayISO(0));
		await expect(cell.locator('[data-event-title="Year Event"]').first()).toBeAttached();

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
		await updateCalendarSettings(page, {
			colorRules: [
				{ id: "rule-dots", expression: "Category === 'Work'", color: "#ff0000", enabled: true },
				{ id: "rule-dots-2", expression: "Category === 'Work'", color: "#00ff00", enabled: true },
			],
		});
		seedEvent(vaultDir, { ...todayTimedEvent("Dots Event", 9, 10), category: "Work" });

		await refreshCalendar(page);
		await gotoToday(page);
		await calendar.switchMode("year");

		const cell = monthCellForDate(page, todayISO());
		const dots = cell.locator(".prisma-day-color-dots:not(.prisma-event-color-dots)");
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
