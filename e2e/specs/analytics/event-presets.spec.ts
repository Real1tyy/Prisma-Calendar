import { expect, test } from "../../fixtures/electron";
import { createEventViaToolbar, openCalendarViewViaRibbon } from "../../fixtures/helpers";
import { updateCalendarSettings } from "../../fixtures/seed-events";

// Event presets live on the calendar's settings under `eventPresets[]` and
// are surfaced in the event modal through a <select> stamped with
// `prisma-event-control-preset`. Picking a preset fires `applyPreset`, which
// rewrites modal state (title/category/location/etc.) from the preset.
// This spec seeds a preset via the settings store (mirroring
// integrations/filter-presets.spec.ts) and verifies the UI wiring: open
// modal → select preset → title field is rewritten with the preset's title.

const PRESET_SELECT = '.modal [data-testid="prisma-event-control-preset"]';
const TITLE_INPUT = '.modal [data-testid="prisma-event-control-title"]';

test.describe("event presets", () => {
	test("selecting a preset from the dropdown populates the event title field", async ({ obsidian }) => {
		const now = Date.now();
		await updateCalendarSettings(obsidian.page, {
			eventPresets: [
				{
					id: "preset-standup",
					name: "Daily Standup",
					title: "Daily Standup",
					createdAt: now,
				},
			],
		});

		await openCalendarViewViaRibbon(obsidian.page);
		await createEventViaToolbar(obsidian.page);

		const select = obsidian.page.locator(PRESET_SELECT).first();
		await expect(select).toBeVisible();
		await select.selectOption({ value: "preset-standup" });

		await expect(obsidian.page.locator(TITLE_INPUT).first()).toHaveValue("Daily Standup");

		await obsidian.page.locator('.modal [data-testid="prisma-event-btn-cancel"]').first().click();
	});
});
