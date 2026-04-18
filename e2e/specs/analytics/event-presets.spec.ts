import { expect, test } from "../../fixtures/electron";
import { createEventViaToolbar } from "../../fixtures/helpers";
import { updateCalendarSettings } from "../../fixtures/seed-events";
import { sel, TID } from "../../fixtures/testids";

// Event presets live on the calendar's settings under `eventPresets[]` and
// are surfaced in the event modal through a <select> stamped with
// `prisma-event-control-preset`. Picking a preset fires `applyPreset`, which
// rewrites modal state (title/category/location/etc.) from the preset.
// This spec seeds a preset via the settings store (mirroring
// integrations/filter-presets.spec.ts) and verifies the UI wiring: open
// modal → select preset → title field is rewritten with the preset's title.

test.describe("event presets", () => {
	test("selecting a preset from the dropdown populates the event title field", async ({ calendar }) => {
		const now = Date.now();
		await updateCalendarSettings(calendar.page, {
			eventPresets: [
				{
					id: "preset-standup",
					name: "Daily Standup",
					title: "Daily Standup",
					createdAt: now,
				},
			],
		});

		await createEventViaToolbar(calendar.page);

		const select = calendar.page.locator(".modal [data-testid='prisma-event-control-preset']").first();
		await expect(select).toBeVisible();
		await select.selectOption({ value: "preset-standup" });

		await expect(calendar.page.locator(`.modal ${sel(TID.event.control("title"))}`).first()).toHaveValue(
			"Daily Standup"
		);

		await calendar.page
			.locator(`.modal ${sel(TID.event.btn("cancel"))}`)
			.first()
			.click();
	});
});
