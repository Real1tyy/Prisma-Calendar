import { expect, test } from "../../fixtures/electron";
import {
	EVENT_MODAL_SELECTOR,
	formatLocalDate,
	openCalendarReady,
	switchToMonthView,
	switchToWeekView,
} from "./events-helpers";

// Round 4 — "user single-clicks" creation paths. Drag-create is already
// covered by create-from-calendar-click.spec.ts; this file covers the simpler
// click-without-drag flows in the month and week views. Assertions are
// precise (exact start/end strings), so hitbox drift would fail the test
// rather than silently loosen coverage.

test.describe("event creation paths", () => {
	test("single click on an empty month-view day opens create modal with all-day + Date prefilled", async ({
		obsidian,
	}) => {
		await openCalendarReady(obsidian.page);
		await switchToMonthView(obsidian.page);

		// Pick today's month-view cell — guaranteed visible after switch because
		// FullCalendar defaults the month grid around `now`.
		const today = formatLocalDate(new Date());
		const dayCell = obsidian.page.locator(`.fc-daygrid-day[data-date="${today}"]`).first();
		await dayCell.waitFor({ state: "visible", timeout: 15_000 });

		// `.fc-daygrid-day-frame` is the clickable surface — clicking the
		// cell's outer wrapper can land on the number or on an event stripe.
		await dayCell.locator(".fc-daygrid-day-frame").first().click();

		await obsidian.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible", timeout: 10_000 });

		// All Day should be on, Date should be today, Start/End should be hidden.
		const allDay = obsidian.page.locator('[data-testid="prisma-event-control-allDay"]').first();
		await expect(allDay).toBeChecked();
		await expect(obsidian.page.locator('[data-testid="prisma-event-control-date"]').first()).toHaveValue(today);
	});

	test("single click on a week-view 10:00 slot opens create modal with Start=10:00 and End=11:00", async ({
		obsidian,
	}) => {
		await openCalendarReady(obsidian.page);
		await switchToWeekView(obsidian.page);

		// Target the 10:00 slot in today's column so the test is date-deterministic.
		const today = formatLocalDate(new Date());
		const slotLane = obsidian.page.locator('.fc-timegrid-slot-lane[data-time="10:00:00"]').first();
		const todayCol = obsidian.page.locator(`.fc-timegrid-col[data-date="${today}"]`).first();
		await slotLane.waitFor({ state: "visible", timeout: 15_000 });
		await todayCol.waitFor({ state: "visible", timeout: 15_000 });

		const slotBox = await slotLane.boundingBox();
		const colBox = await todayCol.boundingBox();
		if (!slotBox || !colBox) throw new Error("slot or column not on screen");

		// Click at the TOP of the 10:00 slot so FC's `dateClick` rounds to 10:00
		// rather than halfway through (which would yield 10:30).
		await obsidian.page.mouse.click(colBox.x + colBox.width / 2, slotBox.y + 1);

		await obsidian.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible", timeout: 10_000 });

		const start = await obsidian.page.locator('[data-testid="prisma-event-control-start"]').first().inputValue();
		const end = await obsidian.page.locator('[data-testid="prisma-event-control-end"]').first().inputValue();

		// Precise assertions — any hitbox drift that shifts the clicked slot
		// off 10:00 would fail this test rather than silently go unnoticed.
		expect(start).toBe(`${today}T10:00`);
		expect(end).toBe(`${today}T11:00`);
	});
});
