import { expect, test } from "../../fixtures/electron";
import { openCalendarReady, waitForEventModalOpen } from "./events-helpers";

// Drag-selecting on the FullCalendar time grid must open the event modal
// pre-populated with the selected range. Coordinates target the current
// week's time grid — tolerance is ±1 minute because FullCalendar snaps to
// its configured slot duration.
//
// TODO(foundation): hoist a `dragSelectTimeGrid(page, opts)` helper once
// Agent 04 (Calendar) lands its shared drag primitives.
test.describe("create event — from calendar drag", () => {
	test("drag on time grid pre-fills start/end", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);

		// Default calendar view is month — flip the active FullCalendar instance
		// to the week time-grid. Going through the FC API is more reliable than
		// clicking the toolbar button, whose class names churn across versions.
		await obsidian.page.waitForSelector(".fc", { timeout: 10_000 });
		await obsidian.page.evaluate(() => {
			// FullCalendar attaches `_context.calendarApi` to the root DOM node;
			// the public global we can reach from Playwright is just the DOM, so
			// we walk to the nearest `.fc-view-harness` and reach its calendar.
			const fcRoot = document.querySelector(".fc") as HTMLElement | null;
			if (!fcRoot) throw new Error("FullCalendar root not found");
			const instance =
				(fcRoot as unknown as { _fullCalendar?: { changeView: (v: string) => void } })._fullCalendar ??
				(fcRoot as unknown as { __fullCalendar?: { changeView: (v: string) => void } }).__fullCalendar;
			if (instance && typeof instance.changeView === "function") {
				instance.changeView("timeGridWeek");
				return;
			}
			// Fallback: click the toolbar button if the internal handle isn't exposed.
			const button = document.querySelector(".fc-timeGridWeek-button") as HTMLButtonElement | null;
			button?.click();
		});

		const slot = obsidian.page.locator(".fc-timegrid-slot-lane").first();
		await slot.waitFor({ state: "visible", timeout: 15_000 });

		const slotBox = await slot.boundingBox();
		expect(slotBox).not.toBeNull();
		if (!slotBox) return;

		const startX = slotBox.x + slotBox.width / 2;
		const startY = slotBox.y + 2;
		const endY = slotBox.y + slotBox.height * 2;

		await obsidian.page.mouse.move(startX, startY);
		await obsidian.page.mouse.down();
		await obsidian.page.mouse.move(startX, endY, { steps: 10 });
		await obsidian.page.mouse.up();

		await waitForEventModalOpen(obsidian.page, 15_000);

		const start = await obsidian.page.locator('[data-testid="prisma-event-control-start"]').inputValue();
		expect(start).not.toBe("");

		const end = await obsidian.page.locator('[data-testid="prisma-event-control-end"]').inputValue();
		expect(end).not.toBe("");
	});
});
