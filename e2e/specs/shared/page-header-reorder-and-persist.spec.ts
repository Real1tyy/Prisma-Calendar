import type { Page } from "@playwright/test";
import { settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import { openCalendarViewViaRibbon } from "../../fixtures/helpers";
import { readDefaultCalendar } from "../../fixtures/plugin-data";

// Exercises shared `createPageHeader` mutation → persistence → render pipeline.
// Uses the chevron up/down buttons inside the action-manager modal to reorder
// actions (HTML5 drag events are unreliable under Electron CDP — the chevron is
// the keyboard/accessibility-friendly path and fires the same `moveAction`
// handler as drop would). Persistence is validated two ways: the header DOM
// re-renders with the new order, AND data.json.pageHeaderState.visibleActionIds
// reflects the mutation after `settleSettings` force-flushes the debounced
// save.

const PLUGIN_ID = "prisma-calendar";
const MANAGE_BTN = '[data-testid="prisma-page-header-manage"]';
const MANAGER_MODAL = '[data-testid="prisma-action-manager-modal"]';

// pageHeaderState is persisted PER-CALENDAR (inside calendars[N]), not at the
// top level of data.json. Prisma's view reads it via
// `bundle.settingsStore.currentSettings.pageHeaderState`, which resolves to
// `data.calendars.find(c => c.id === bundleId).pageHeaderState`.
type PageHeaderState = {
	pageHeaderState?: {
		visibleActionIds?: string[];
	};
};

async function waitForHeaderReady(page: Page): Promise<void> {
	// The page header is rendered via a leaf-state apply; wait for the manage
	// button as a stable signal that `createPageHeader.apply()` has run.
	await page.locator(MANAGE_BTN).first().waitFor({ state: "visible" });
}

async function openActionManager(page: Page): Promise<void> {
	await page.locator(MANAGE_BTN).first().click();
	await page.locator(MANAGER_MODAL).waitFor({ state: "visible" });
}

async function closeActionManager(page: Page): Promise<void> {
	await page.keyboard.press("Escape");
	await page.locator(MANAGER_MODAL).waitFor({ state: "hidden" });
}

async function readVisibleOrder(page: Page): Promise<string[]> {
	return page.evaluate(() =>
		[...document.querySelectorAll(".workspace-leaf.mod-active [data-testid^='prisma-toolbar-']")].map((el) =>
			el.getAttribute("data-testid")!.replace("prisma-toolbar-", "")
		)
	);
}

test.describe("shared: page header reorder + persistence", () => {
	test("chevron-up reorders an action and persists to data.json", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);
		await waitForHeaderReady(obsidian.page);

		const initialOrder = await readVisibleOrder(obsidian.page);
		expect(initialOrder.length).toBeGreaterThan(2);

		// Pick an action that isn't first so its chevron-up button exists.
		const targetId = initialOrder[2];
		const predecessorId = initialOrder[1];

		await openActionManager(obsidian.page);
		const upBtn = obsidian.page.locator(`[data-testid="prisma-action-manager-up-${targetId}"]`).first();
		await upBtn.waitFor({ state: "visible" });
		await upBtn.click();

		await closeActionManager(obsidian.page);

		// DOM truth: target should now sit where predecessor was.
		const newOrder = await readVisibleOrder(obsidian.page);
		expect(newOrder.indexOf(targetId)).toBeLessThan(newOrder.indexOf(predecessorId));

		// File-on-disk truth: force-flush the debounced settingsStore.updateSettings
		// → saveData, then assert the persisted order matches the DOM order.
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		const cal = readDefaultCalendar<PageHeaderState>(obsidian.vaultDir);
		expect(cal?.pageHeaderState?.visibleActionIds).toEqual(newOrder);
	});

	test("hiding an action removes it from the toolbar and from data.json", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);
		await waitForHeaderReady(obsidian.page);

		const initialOrder = await readVisibleOrder(obsidian.page);
		// Pick the last visible action so its toggle button always exists (the
		// first visible can't be hidden when only one remains — shared guards).
		expect(initialOrder.length).toBeGreaterThan(1);
		const targetId = initialOrder[initialOrder.length - 1];

		await openActionManager(obsidian.page);
		const hideBtn = obsidian.page.locator(`[data-testid="prisma-action-manager-toggle-${targetId}"]`).first();
		await hideBtn.waitFor({ state: "visible" });
		await hideBtn.click();

		await closeActionManager(obsidian.page);

		// DOM: the toolbar button for the target is no longer rendered.
		const newOrder = await readVisibleOrder(obsidian.page);
		expect(newOrder).not.toContain(targetId);

		// Disk: the id is absent from pageHeaderState.visibleActionIds.
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		const cal = readDefaultCalendar<PageHeaderState>(obsidian.vaultDir);
		expect(cal?.pageHeaderState?.visibleActionIds ?? []).not.toContain(targetId);
	});
});
