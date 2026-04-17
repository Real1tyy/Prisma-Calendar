import type { Page } from "@playwright/test";
import { settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import { openCalendarViewViaRibbon } from "../../fixtures/helpers";
import { readDefaultCalendar } from "../../fixtures/plugin-data";

// Exercises shared `createTabbedContainer`'s manager modal reorder flow.
// Persistence lives at calendars[0].activeTab (same per-calendar pattern as
// pageHeaderState). Uses chevron-up rather than HTML5 drag events (unreliable
// under Electron CDP) — both paths fire the same `moveTab` handler.

const PLUGIN_ID = "prisma-calendar";
const MANAGE_BTN = '[data-testid="prisma-tabbed-container-manage"]';
const MANAGER_MODAL = '[data-testid="prisma-tab-manager-modal"]';

type ActiveTabVisible = {
	activeTab?: {
		visibleTabIds?: string[];
	};
};

async function openTabManager(page: Page): Promise<void> {
	const manageBtn = page.locator(MANAGE_BTN).first();
	await manageBtn.waitFor({ state: "visible" });
	await manageBtn.click();
	await page.locator(MANAGER_MODAL).waitFor({ state: "visible" });
}

async function closeTabManager(page: Page): Promise<void> {
	await page.keyboard.press("Escape");
	await page.locator(MANAGER_MODAL).waitFor({ state: "hidden" });
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
		await obsidian.page.locator(MANAGE_BTN).first().waitFor({ state: "visible" });

		const initialOrder = await readTabOrder(obsidian.page);
		expect(initialOrder.length).toBeGreaterThan(2);

		// Target the 3rd tab — reliably has a chevron-up button.
		const targetId = initialOrder[2];
		const predecessorId = initialOrder[1];

		await openTabManager(obsidian.page);

		const upBtn = obsidian.page.locator(`[data-testid="prisma-tab-manager-up-${targetId}"]`).first();
		await upBtn.waitFor({ state: "visible" });
		await upBtn.click();

		await closeTabManager(obsidian.page);

		const newOrder = await readTabOrder(obsidian.page);
		expect(newOrder.indexOf(targetId)).toBeLessThan(newOrder.indexOf(predecessorId));

		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		const cal = readDefaultCalendar<ActiveTabVisible>(obsidian.vaultDir);
		// The shared container only persists visibleTabIds when the order differs
		// from the default — after our swap it MUST be populated.
		expect(cal?.activeTab?.visibleTabIds?.indexOf(targetId)).toBeLessThan(
			cal?.activeTab?.visibleTabIds?.indexOf(predecessorId) ?? -1
		);
	});

	test("hiding a tab via the manager toggle removes it from the tab bar and persists", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);
		await obsidian.page.locator(MANAGE_BTN).first().waitFor({ state: "visible" });

		const initialOrder = await readTabOrder(obsidian.page);
		// Hide the last tab so the hide-toggle is always enabled (first tab may
		// be the active one, shared still allows hiding it but keeping a non-
		// active target makes the DOM assertion simpler).
		const targetId = initialOrder[initialOrder.length - 1];

		await openTabManager(obsidian.page);

		const toggleBtn = obsidian.page.locator(`[data-testid="prisma-tab-manager-toggle-${targetId}"]`).first();
		await toggleBtn.waitFor({ state: "visible" });
		await toggleBtn.click();

		await closeTabManager(obsidian.page);

		const newOrder = await readTabOrder(obsidian.page);
		expect(newOrder).not.toContain(targetId);

		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		const cal = readDefaultCalendar<ActiveTabVisible>(obsidian.vaultDir);
		expect(cal?.activeTab?.visibleTabIds ?? []).not.toContain(targetId);
	});
});
