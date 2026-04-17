import { expect } from "@playwright/test";
import { readPluginData } from "@real1ty-obsidian-plugins/testing/e2e";

import { testResilience as test } from "../../fixtures/electron";
import {
	patchDefaultCalendar,
	PLUGIN_ID,
	readLiveCalendar,
	reloadAndWaitForPrisma,
} from "../../fixtures/resilience-helpers";

// Template pattern: three representative field types — boolean, string, enum.
// Each survives the reload barrier in both disk (`data.json`) and the live
// `settingsStore`. The shape of the mutation is the same for all three; only
// the patch literal changes.

interface SettingCase {
	label: string;
	patch: Record<string, string | boolean>;
}

const CASES: SettingCase[] = [
	{ label: "boolean toggle", patch: { showStopwatch: false } },
	{ label: "string text field", patch: { startProp: "CustomStart" } },
	{ label: "enum dropdown", patch: { locale: "de" } },
];

type StoredSettings = { calendars?: Array<Record<string, unknown>> };

test.describe("reload persists settings", () => {
	for (const tc of CASES) {
		test(`${tc.label} survives reload`, async ({ obsidian }) => {
			await patchDefaultCalendar(obsidian.page, tc.patch);
			await reloadAndWaitForPrisma(obsidian.page);

			const stored = readPluginData(obsidian.vaultDir, PLUGIN_ID) as StoredSettings | null;
			const storedCal = stored?.calendars?.[0];
			const live = await readLiveCalendar(obsidian.page);

			for (const [key, value] of Object.entries(tc.patch)) {
				expect(storedCal?.[key], `disk.${key}`).toBe(value);
				expect(live?.[key], `live.${key}`).toBe(value);
			}
		});
	}

	test("combined toggle + text + dropdown all survive reload", async ({ obsidian }) => {
		const combined = Object.assign({}, ...CASES.map((c) => c.patch));
		await patchDefaultCalendar(obsidian.page, combined);
		await reloadAndWaitForPrisma(obsidian.page);

		const stored = readPluginData(obsidian.vaultDir, PLUGIN_ID) as StoredSettings | null;
		const storedCal = stored?.calendars?.[0];
		const live = await readLiveCalendar(obsidian.page);

		for (const [key, value] of Object.entries(combined)) {
			expect(storedCal?.[key], `disk.${key}`).toBe(value);
			expect(live?.[key], `live.${key}`).toBe(value);
		}
	});
});
