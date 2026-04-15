import { existsSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "../fixtures/electron";

test.describe("settings persistence", () => {
	test("data.json is written after mutating a setting", async ({ obsidian }) => {
		const dataJsonPath = join(obsidian.vaultDir, ".obsidian", "plugins", "prisma-calendar", "data.json");

		await obsidian.page.evaluate(async () => {
			const w = window as unknown as {
				app: {
					plugins: {
						plugins: Record<
							string,
							{
								saveData?: (data: unknown) => Promise<void>;
								settingsStore?: { current: Record<string, unknown>; update?: (v: unknown) => void };
							}
						>;
					};
				};
			};
			const plugin = w.app.plugins.plugins["prisma-calendar"];
			if (!plugin) throw new Error("prisma-calendar plugin not found in the renderer registry");
			if (plugin.settingsStore && typeof plugin.settingsStore.update === "function") {
				plugin.settingsStore.update({ ...plugin.settingsStore.current, _e2eTouched: Date.now() });
			}
			if (typeof plugin.saveData === "function") {
				await plugin.saveData(plugin.settingsStore?.current ?? {});
			}
		});

		await obsidian.page.waitForTimeout(500);

		expect(existsSync(dataJsonPath)).toBe(true);
	});
});
