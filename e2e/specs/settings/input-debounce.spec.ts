import type { Page } from "@playwright/test";
import { expectPluginData, settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { PLUGIN_ID } from "../../fixtures/constants";
import { expect, test } from "../../fixtures/electron";
import { openPrismaSettings, switchSettingsTab } from "../../fixtures/helpers";

// Regression guard for the per-keystroke directory-creation bug. Without
// debouncing, typing "events" into the directory field wrote "e" → "ev" →
// "eve" → "even" → "event" → "events" to the settings store in sequence, and
// each write triggered downstream side-effects (virtual-events file creation,
// disk writes). With the shared-react debouncing (default 300ms) the store
// receives a single commit with the final value after the user stops typing /
// blurs / presses Enter.

async function readInMemoryDirectory(page: Page): Promise<string> {
	return page.evaluate((pid) => {
		type CalendarConfig = { id: string; directory?: string };
		type Settings = { calendars?: CalendarConfig[] };
		const w = window as unknown as {
			app: {
				plugins: {
					plugins: Record<
						string,
						{
							settingsStore?: { currentSettings?: Settings };
						}
					>;
				};
			};
		};
		const plugin = w.app.plugins.plugins[pid];
		const calendars = plugin?.settingsStore?.currentSettings?.calendars ?? [];
		const def = calendars.find((c) => c.id === "default") ?? calendars[0];
		return def?.directory ?? "";
	}, PLUGIN_ID);
}

test.describe("settings: debounced input commit", () => {
	test("typing the directory field char-by-char commits once after the debounce, not per keystroke", async ({
		obsidian,
	}) => {
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "general");

		const input = obsidian.page.locator('[data-testid="prisma-settings-control-directory"]').first();
		await input.waitFor({ state: "visible" });
		await input.scrollIntoViewIfNeeded();

		// The seed initialises the default calendar with directory = "Events".
		// Sanity-check the starting state so the rest of the test is meaningful.
		expect(await readInMemoryDirectory(obsidian.page)).toBe("Events");

		// Select all, then type "tasks" one char at a time. pressSequentially
		// dispatches 5 keystrokes × 10ms ≈ 50ms total — well inside the 300ms
		// debounce window, so the store MUST still read "Events" mid-typing.
		await input.click();
		await input.press("ControlOrMeta+A");
		await input.pressSequentially("tasks", { delay: 10 });

		// Still focused, still inside the 300ms debounce window — no intermediate
		// commit should have reached the store yet.
		expect(await readInMemoryDirectory(obsidian.page)).toBe("Events");

		// Blur flushes the pending commit synchronously; settle lets saveData
		// hit disk so the on-disk assertion is meaningful.
		await input.blur();
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		expect(await readInMemoryDirectory(obsidian.page)).toBe("tasks");
		expectPluginData(obsidian.vaultDir, PLUGIN_ID, {
			"calendars.0.directory": "tasks",
		});
	});

	test("pressing Enter during typing flushes the pending commit immediately", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "general");

		const input = obsidian.page.locator('[data-testid="prisma-settings-control-directory"]').first();
		await input.waitFor({ state: "visible" });
		await input.scrollIntoViewIfNeeded();

		await input.click();
		await input.press("ControlOrMeta+A");
		await input.pressSequentially("inbox", { delay: 10 });
		// No blur — press Enter instead. Must commit without waiting 300ms.
		await input.press("Enter");

		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		expect(await readInMemoryDirectory(obsidian.page)).toBe("inbox");
	});
});
