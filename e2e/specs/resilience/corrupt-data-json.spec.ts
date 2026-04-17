import { writeFileSync } from "node:fs";

import { expect } from "@playwright/test";
import { isPluginLoaded, readPluginData } from "@real1ty-obsidian-plugins/testing/e2e";

import { testResilience as test } from "../../fixtures/electron";
import { dataJsonPath, PLUGIN_ID, readLiveCalendar, reloadAndWaitForPrisma } from "../../fixtures/resilience-helpers";

// `data.json` gets touched by other tools, editors, syncs — and sometimes the
// write aborts midway, leaving truncated JSON. The plugin must boot with
// defaults rather than refusing to start.

interface CorruptionCase {
	name: string;
	/** Exact bytes to write to data.json before the reload. */
	content: string;
}

const CASES: CorruptionCase[] = [
	{
		name: "invalid JSON boots with defaults",
		content: '{"version": "1.2.3", "calendars": [{"id": "default", "name": "Main',
	},
	{
		name: "schema-incompatible data.json degrades gracefully",
		content: JSON.stringify({ version: "1.2.3", somethingUnknown: { foo: 1 }, anotherKey: [1, 2, 3] }),
	},
];

test.describe("corrupt data.json", () => {
	for (const tc of CASES) {
		test(tc.name, async ({ obsidian }) => {
			writeFileSync(dataJsonPath(obsidian.vaultDir), tc.content, "utf8");

			await reloadAndWaitForPrisma(obsidian.page);

			expect(await isPluginLoaded(obsidian.page, PLUGIN_ID)).toBe(true);

			await expect
				.poll(async () => (await readLiveCalendar(obsidian.page)) !== null, {
					message: "expected settings store to heal to at least one calendar",
				})
				.toBe(true);

			const healed = readPluginData(obsidian.vaultDir, PLUGIN_ID);
			expect(healed).not.toBeNull();
			expect(typeof healed).toBe("object");
		});
	}
});
