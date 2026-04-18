import { gotoToday, monthCellForDate, todayISO, todayTimedEvent, waitForEvent } from "../../fixtures/calendar-helpers";
import { expect, test } from "../../fixtures/electron";
import { refreshCalendar, seedEvent } from "../../fixtures/seed-events";

test.describe("month view", () => {
	test("seeded event renders in the matching day cell", async ({ calendar }) => {
		const { page, vaultDir } = calendar;
		seedEvent(vaultDir, todayTimedEvent("Month Event", 10, 11));

		await refreshCalendar(page);
		await gotoToday(page);
		await calendar.switchMode("month");
		await waitForEvent(page, "Month Event");

		const cell = monthCellForDate(page, todayISO());
		await expect(cell.locator('[data-event-title="Month Event"]').first()).toBeVisible();
	});

	test("toolbar title switches to a 'Month Year' format", async ({ calendar }) => {
		await gotoToday(calendar.page);

		const header = calendar.page.locator(".fc-toolbar-title").first();
		const dayTitle = ((await header.textContent()) ?? "").trim();
		// Day-view title always embeds a numeric day — e.g. "April 17, 2026".
		expect(dayTitle).toMatch(/\d{1,2}/);

		await calendar.switchMode("month");
		// Month view drops the day number entirely — just "Month Year".
		await expect(header).toHaveText(/^[A-Z][a-z]+\s+\d{4}$/);
	});
});
