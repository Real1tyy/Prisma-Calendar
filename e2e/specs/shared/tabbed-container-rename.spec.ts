import { readPluginData, settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import { openCalendarViewViaRibbon } from "../../fixtures/helpers";

// Exercises shared `createTabbedContainer` → rename flow: opening the tab
// manager, clicking the pencil (rename) button for a tab row, typing into the
// shared rename modal, and saving. Verifies both the DOM tab button label and
// data.json.calendars[0].activeTab.renames.

const PLUGIN_ID = "prisma-calendar";
const MANAGE_BTN = '[data-testid="prisma-tabbed-container-manage"]';
const MANAGER_MODAL = '[data-testid="prisma-tab-manager-modal"]';
const RENAME_INPUT = ".prisma-tab-rename-input";
const RENAME_SAVE_BTN = ".prisma-tab-rename-btn-save";

type TabData = {
	calendars?: Array<{
		id: string;
		activeTab?: {
			renames?: Record<string, string>;
		};
	}>;
};

test.describe("shared: tabbed container rename", () => {
	test("rename modal writes a custom label and persists it to data.json", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);
		const manageBtn = obsidian.page.locator(MANAGE_BTN).first();
		await manageBtn.waitFor({ state: "visible", timeout: 10_000 });

		// Pick a stable, non-first tab to rename. "timeline" is always in the
		// default Prisma tab list.
		const targetId = "timeline";
		const newLabel = "My Timeline";

		await manageBtn.click();
		await obsidian.page.locator(MANAGER_MODAL).waitFor({ state: "visible", timeout: 5_000 });

		const renameBtn = obsidian.page.locator(`[data-testid="prisma-tab-manager-rename-${targetId}"]`).first();
		await renameBtn.waitFor({ state: "visible", timeout: 5_000 });
		await renameBtn.click();

		const input = obsidian.page.locator(RENAME_INPUT).first();
		await input.waitFor({ state: "visible", timeout: 5_000 });
		await input.fill(newLabel);

		await obsidian.page.locator(RENAME_SAVE_BTN).first().click();

		// Close the outer manager modal. After Save, the rename modal closes on
		// its own — we just need to dismiss the manager to return to the view.
		await obsidian.page.keyboard.press("Escape");
		await obsidian.page.locator(MANAGER_MODAL).waitFor({ state: "hidden", timeout: 5_000 });

		// DOM: the tab button for the renamed tab now shows the custom label.
		const tabButton = obsidian.page.locator(`[data-testid="prisma-view-tab-${targetId}"]`).first();
		await expect(tabButton).toContainText(newLabel);

		// Disk: calendars[0].activeTab.renames[targetId] === newLabel.
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		const data = readPluginData(obsidian.vaultDir, PLUGIN_ID) as TabData;
		const cal = data.calendars?.find((c) => c.id === "default") ?? data.calendars?.[0];
		expect(cal?.activeTab?.renames?.[targetId]).toBe(newLabel);
	});
});
