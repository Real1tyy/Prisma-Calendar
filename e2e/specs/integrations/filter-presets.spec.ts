import { expect, test } from "../../fixtures/electron";
import { readCalendarSettings, updateCalendarSettings } from "../../fixtures/seed-events";
import { FC_FILTER_PRESET_SELECT_TID, sel } from "../../fixtures/testids";

// FilterPreset shape: `{ name, expression }` (types/settings.ts).
// Presets live under `filterPresets: []` on the calendar's own settings.
// Selector DOM is stamped with data-testid="prisma-fc-filter-preset-select".

const FILTER_PRESET_SELECT = sel(FC_FILTER_PRESET_SELECT_TID);

const INITIAL_PRESETS = [
	{ name: "Work only", expression: "Category === 'Work'" },
	{ name: "Fitness", expression: "Category === 'Fitness'" },
];

test.describe("filter presets", () => {
	test.beforeEach(async ({ calendar }) => {
		await updateCalendarSettings(calendar.page, { filterPresets: INITIAL_PRESETS });
	});

	test("CRUD via settingsStore persists to data.json", async ({ calendar }) => {
		const afterCreate = await readCalendarSettings(calendar.page);
		expect(afterCreate["filterPresets"]).toEqual(INITIAL_PRESETS);

		await updateCalendarSettings(calendar.page, {
			filterPresets: [{ name: "Work only", expression: "Category === 'Urgent'" }, INITIAL_PRESETS[1]],
		});
		const afterEdit = await readCalendarSettings(calendar.page);
		expect((afterEdit["filterPresets"] as Array<{ expression: string }>)[0]!.expression).toBe("Category === 'Urgent'");

		await updateCalendarSettings(calendar.page, {
			filterPresets: [{ name: "Work only", expression: "Category === 'Urgent'" }],
		});
		const afterDelete = await readCalendarSettings(calendar.page);
		expect((afterDelete["filterPresets"] as unknown[]).length).toBe(1);
	});

	test("open-filter-preset-selector command exposes every preset", async ({ calendar }) => {
		const select = calendar.page.locator(FILTER_PRESET_SELECT).first();
		await select.waitFor({ state: "attached" });

		await calendar.runCommand("Prisma Calendar: Open filter preset selector");

		const optionTexts = await select.locator("option").allInnerTexts();
		for (const preset of INITIAL_PRESETS) expect(optionTexts).toContain(preset.name);
		expect(optionTexts).toContain("Clear");
	});
});
