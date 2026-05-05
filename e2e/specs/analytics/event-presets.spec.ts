import { expect, test } from "../../fixtures/electron";
import { createEventViaToolbar } from "../../fixtures/helpers";
import { updateCalendarSettings } from "../../fixtures/seed-events";
import { sel, TID } from "../../fixtures/testids";

// Event presets live on the calendar's settings under `eventPresets[]` and
// are surfaced in the event modal through a <select> stamped with
// `prisma-event-control-preset`. Picking a preset fires `applyPreset`, which
// rewrites modal state from the preset's fields. This spec verifies that
// EVERY preset field that has a corresponding modal control is applied —
// not just title — so a regression dropping (e.g.) `location` propagation
// fails immediately.

test.describe("event presets", () => {
	test("selecting a preset populates title, location, and break minutes", async ({ calendar }) => {
		const now = Date.now();
		await updateCalendarSettings(calendar.page, {
			eventPresets: [
				{
					id: "preset-standup",
					name: "Daily Standup",
					title: "Daily Standup",
					location: "Room A",
					breakMinutes: 5,
					createdAt: now,
				},
			],
		});

		await createEventViaToolbar(calendar.page);

		const modal = calendar.page.locator(".modal").first();
		const select = modal.locator(sel(TID.event.control("preset")));
		await expect(select).toBeVisible();
		await select.selectOption({ value: "preset-standup" });

		await expect(modal.locator(sel(TID.event.control("title")))).toHaveValue("Daily Standup");
		await expect(modal.locator(sel(TID.event.control("location")))).toHaveValue("Room A");
		await expect(modal.locator(sel(TID.event.control("breakMinutes")))).toHaveValue("5");

		await modal.locator(sel(TID.event.btn("cancel"))).click();
	});

	test("selecting a preset toggles allDay on and reveals the date input", async ({ calendar }) => {
		const now = Date.now();
		await updateCalendarSettings(calendar.page, {
			eventPresets: [
				{
					id: "preset-allday",
					name: "All Day Block",
					title: "Off Day",
					allDay: true,
					createdAt: now,
				},
			],
		});

		await createEventViaToolbar(calendar.page);
		const modal = calendar.page.locator(".modal").first();
		await modal.locator(sel(TID.event.control("preset"))).selectOption({ value: "preset-allday" });

		await expect(modal.locator(sel(TID.event.control("allDay")))).toBeChecked();
		// Date input is the all-day-mode replacement for start/end; must be
		// visible after the toggle flips on.
		await expect(modal.locator(sel(TID.event.control("date")))).toBeVisible();
		await expect(modal.locator(sel(TID.event.control("title")))).toHaveValue("Off Day");

		await modal.locator(sel(TID.event.btn("cancel"))).click();
	});
});
