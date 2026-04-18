import { settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { PLUGIN_ID } from "../../fixtures/constants";
import { openTabManager } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { readDefaultCalendar } from "../../fixtures/plugin-data";
import { sel, TID } from "../../fixtures/testids";

// Exercises shared `createTabbedContainer` → rename flow: opening the tab
// manager, clicking the pencil (rename) button for a tab row, typing into the
// shared rename modal, and saving. Verifies both the DOM tab button label and
// data.json.calendars[0].activeTab.renames.

const RENAME_INPUT = ".prisma-tab-rename-input";
const RENAME_SAVE_BTN = ".prisma-tab-rename-btn-save";

type ActiveTabRenames = {
	activeTab?: {
		renames?: Record<string, string>;
	};
};

test.describe("shared: tabbed container rename", () => {
	test("rename modal writes a custom label and persists it to data.json", async ({ calendar }) => {
		// Pick a stable, non-first tab to rename. "timeline" is always in the
		// default Prisma tab list.
		const targetId = "timeline";
		const newLabel = "My Timeline";

		const manager = await openTabManager(calendar.page);
		await manager.rename(targetId);

		const input = calendar.page.locator(RENAME_INPUT).first();
		await input.waitFor({ state: "visible" });
		await input.fill(newLabel);
		await calendar.page.locator(RENAME_SAVE_BTN).first().click();

		// Close the outer manager modal. After Save, the rename modal closes on
		// its own — we just need to dismiss the manager to return to the view.
		await manager.close();

		// DOM: the tab button for the renamed tab now shows the custom label.
		const tabButton = calendar.page.locator(sel(TID.viewTab("timeline"))).first();
		await expect(tabButton).toContainText(newLabel);

		// Disk: calendars[0].activeTab.renames[targetId] === newLabel.
		await settleSettings(calendar.page, { pluginId: PLUGIN_ID });
		const cal = readDefaultCalendar<ActiveTabRenames>(calendar.vaultDir);
		expect(cal?.activeTab?.renames?.[targetId]).toBe(newLabel);
	});
});
