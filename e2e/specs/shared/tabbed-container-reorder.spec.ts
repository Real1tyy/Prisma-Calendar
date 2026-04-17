import type { Page } from "@playwright/test";
import { readPluginData, settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import { openCalendarViewViaRibbon } from "../../fixtures/helpers";

// Exercises shared `createTabbedContainer`'s manager modal reorder flow.
// Persistence lives at calendars[0].activeTab (same per-calendar pattern as
// pageHeaderState). Uses chevron-up rather than HTML5 drag events (unreliable
// under Electron CDP) — both paths fire the same `moveTab` handler.

const PLUGIN_ID = "prisma-calendar";
const MANAGE_BTN = '[data-testid="prisma-tabbed-container-manage"]';
const MANAGER_MODAL = '[data-testid="prisma-tab-manager-modal"]';

type TabData = {
	calendars?: Array<{
		id: string;
		activeTab?: {
			visibleTabIds?: string[];
		};
	}>;
};

function readDefaultCalendarTabState(vaultDir: string): { visibleTabIds?: string[] } | undefined {
	const data = readPluginData(vaultDir, PLUGIN_ID) as TabData;
	const cal = data.calendars?.find((c) => c.id === "default") ?? data.calendars?.[0];
	return cal?.activeTab;
}

async function readTabOrder(page: Page): Promise<string[]> {
	return page.evaluate(() =>
		[...document.querySelectorAll("[data-testid^='prisma-view-tab-']")]
			.filter((el) => el.tagName === "BUTTON")
			.map((el) => el.getAttribute("data-testid")!.replace("prisma-view-tab-", ""))
	);
}

test.describe("shared: tabbed container reorder + persistence", () => {
	test("chevron-up in the tab manager reorders tabs and persists", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);
		const manageBtn = obsidian.page.locator(MANAGE_BTN).first();
		await manageBtn.waitFor({ state: "visible", timeout: 10_000 });

		const initialOrder = await readTabOrder(obsidian.page);
		expect(initialOrder.length).toBeGreaterThan(2);

		// Target the 3rd tab — reliably has a chevron-up button.
		const targetId = initialOrder[2];
		const predecessorId = initialOrder[1];

		await manageBtn.click();
		await obsidian.page.locator(MANAGER_MODAL).waitFor({ state: "visible", timeout: 5_000 });

		const upBtn = obsidian.page.locator(`[data-testid="prisma-tab-manager-up-${targetId}"]`).first();
		await upBtn.waitFor({ state: "visible", timeout: 5_000 });
		await upBtn.click();

		await obsidian.page.keyboard.press("Escape");
		await obsidian.page.locator(MANAGER_MODAL).waitFor({ state: "hidden", timeout: 5_000 });

		const newOrder = await readTabOrder(obsidian.page);
		const newTargetIdx = newOrder.indexOf(targetId);
		const newPredIdx = newOrder.indexOf(predecessorId);
		expect(newTargetIdx).toBeLessThan(newPredIdx);

		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		const state = readDefaultCalendarTabState(obsidian.vaultDir);
		// The shared container only persists visibleTabIds when the order differs
		// from the default — after our swap it MUST be populated.
		expect(state?.visibleTabIds?.indexOf(targetId)).toBeLessThan(state?.visibleTabIds?.indexOf(predecessorId) ?? -1);
	});

	test("hiding a tab via the manager toggle removes it from the tab bar and persists", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);
		const manageBtn = obsidian.page.locator(MANAGE_BTN).first();
		await manageBtn.waitFor({ state: "visible", timeout: 10_000 });

		const initialOrder = await readTabOrder(obsidian.page);
		// Hide the last tab so the hide-toggle is always enabled (first tab may
		// be the active one, shared still allows hiding it but keeping a non-
		// active target makes the DOM assertion simpler).
		const targetId = initialOrder[initialOrder.length - 1];

		await manageBtn.click();
		await obsidian.page.locator(MANAGER_MODAL).waitFor({ state: "visible", timeout: 5_000 });

		const toggleBtn = obsidian.page.locator(`[data-testid="prisma-tab-manager-toggle-${targetId}"]`).first();
		await toggleBtn.waitFor({ state: "visible", timeout: 5_000 });
		await toggleBtn.click();

		await obsidian.page.keyboard.press("Escape");
		await obsidian.page.locator(MANAGER_MODAL).waitFor({ state: "hidden", timeout: 5_000 });

		const newOrder = await readTabOrder(obsidian.page);
		expect(newOrder).not.toContain(targetId);

		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		const state = readDefaultCalendarTabState(obsidian.vaultDir);
		expect(state?.visibleTabIds ?? []).not.toContain(targetId);
	});
});
