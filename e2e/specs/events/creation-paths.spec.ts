import { expect, test } from "../../fixtures/electron";
import { sel, TID } from "../../fixtures/testids";
import { EVENT_MODAL_SELECTOR, formatLocalDate } from "./events-helpers";

// Round 4 — "user single-clicks" creation paths. Drag-create is already
// covered by create-from-calendar-click.spec.ts; this file covers the simpler
// click-without-drag flows in the month and week views. Assertions are
// precise (exact start/end strings), so hitbox drift would fail the test
// rather than silently loosen coverage.

test.describe("event creation paths", () => {
	test("single click on an empty month-view day opens create modal with all-day + Date prefilled", async ({
		calendar,
	}) => {
		await calendar.switchMode("month");

		// Pick today's month-view cell — guaranteed visible after switch because
		// FullCalendar defaults the month grid around `now`.
		const today = formatLocalDate(new Date());
		const dayCell = calendar.page.locator(`.fc-daygrid-day[data-date="${today}"]`).first();
		await dayCell.waitFor({ state: "visible" });

		// `.fc-daygrid-day-frame` is the clickable surface — clicking the
		// cell's outer wrapper can land on the number or on an event stripe.
		await dayCell.locator(".fc-daygrid-day-frame").first().click();

		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });

		// All Day should be on, Date should be today, Start/End should be hidden.
		await expect(calendar.page.locator(sel(TID.event.control("allDay"))).first()).toBeChecked();
		await expect(calendar.page.locator(sel(TID.event.control("date"))).first()).toHaveValue(today);
	});

	test("single click on a week-view 10:00 slot opens create modal with Start=10:00 and End=11:00", async ({
		calendar,
	}) => {
		await calendar.switchMode("week");

		// Target the 10:00 slot in today's column so the test is date-deterministic.
		const today = formatLocalDate(new Date());
		const slotLane = calendar.page.locator('.fc-timegrid-slot-lane[data-time="10:00:00"]').first();
		const todayCol = calendar.page.locator(`.fc-timegrid-col[data-date="${today}"]`).first();
		await slotLane.waitFor({ state: "visible" });
		await todayCol.waitFor({ state: "visible" });

		const slotBox = await slotLane.boundingBox();
		const colBox = await todayCol.boundingBox();
		if (!slotBox || !colBox) throw new Error("slot or column not on screen");

		// Click at the TOP of the 10:00 slot so FC's `dateClick` rounds to 10:00
		// rather than halfway through (which would yield 10:30).
		await calendar.page.mouse.click(colBox.x + colBox.width / 2, slotBox.y + 1);

		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });

		const start = await calendar.page
			.locator(sel(TID.event.control("start")))
			.first()
			.inputValue();
		const end = await calendar.page
			.locator(sel(TID.event.control("end")))
			.first()
			.inputValue();

		// Precise assertions — any hitbox drift that shifts the clicked slot
		// off 10:00 would fail this test rather than silently go unnoticed.
		expect(start).toBe(`${today}T10:00`);
		expect(end).toBe(`${today}T11:00`);
	});
});
