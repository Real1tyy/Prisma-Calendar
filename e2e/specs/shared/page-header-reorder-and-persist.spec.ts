import type { Page } from "@playwright/test";
import { settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { PLUGIN_ID } from "../../fixtures/constants";
import { openActionManager } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { readDefaultCalendar } from "../../fixtures/plugin-data";
import { PAGE_HEADER_MANAGE_BTN, sel, SHARED_ROW_PREFIX } from "../../fixtures/testids";

// Exercises shared `createPageHeader` mutation → persistence → render pipeline.
// Uses the chevron up/down buttons inside the action-manager modal to reorder
// actions (HTML5 drag events are unreliable under Electron CDP — the chevron is
// the keyboard/accessibility-friendly path and fires the same `moveAction`
// handler as drop would). Persistence is validated two ways: the header DOM
// re-renders with the new order, AND data.json.pageHeaderState.visibleActionIds
// reflects the mutation after `settleSettings` force-flushes the debounced
// save.

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
	await page.locator(sel(PAGE_HEADER_MANAGE_BTN)).first().waitFor({ state: "visible" });
}

async function readVisibleOrder(page: Page): Promise<string[]> {
	return page.evaluate((prefix) => {
		return Array.from(document.querySelectorAll(`.workspace-leaf.mod-active [data-testid^='${prefix}']`)).map((el) =>
			el.getAttribute("data-testid")!.replace(prefix, "")
		);
	}, SHARED_ROW_PREFIX.pageHeaderToolbar);
}

test.describe("shared: page header reorder + persistence", () => {
	test("chevron-up reorders an action and persists to data.json", async ({ calendar }) => {
		await waitForHeaderReady(calendar.page);

		const initialOrder = await readVisibleOrder(calendar.page);
		expect(initialOrder.length).toBeGreaterThan(2);

		// Pick an action that isn't first so its chevron-up button exists.
		const targetId = initialOrder[2]!;
		const predecessorId = initialOrder[1]!;

		const manager = await openActionManager(calendar.page);
		await manager.moveUp(targetId);
		await manager.close();

		// DOM truth: target should now sit where predecessor was.
		const newOrder = await readVisibleOrder(calendar.page);
		expect(newOrder.indexOf(targetId)).toBeLessThan(newOrder.indexOf(predecessorId));

		// File-on-disk truth: force-flush the debounced settingsStore.updateSettings
		// → saveData, then assert the persisted order matches the DOM order.
		await settleSettings(calendar.page, { pluginId: PLUGIN_ID });
		const cal = readDefaultCalendar<PageHeaderState>(calendar.vaultDir);
		expect(cal?.pageHeaderState?.visibleActionIds).toEqual(newOrder);
	});

	test("hiding an action removes it from the toolbar and from data.json", async ({ calendar }) => {
		await waitForHeaderReady(calendar.page);

		const initialOrder = await readVisibleOrder(calendar.page);
		// Pick the last visible action so its toggle button always exists (the
		// first visible can't be hidden when only one remains — shared guards).
		expect(initialOrder.length).toBeGreaterThan(1);
		const targetId = initialOrder[initialOrder.length - 1]!;

		const manager = await openActionManager(calendar.page);
		await manager.toggle(targetId);
		await manager.close();

		// DOM: the toolbar button for the target is no longer rendered.
		const newOrder = await readVisibleOrder(calendar.page);
		expect(newOrder).not.toContain(targetId);

		// Disk: the id is absent from pageHeaderState.visibleActionIds.
		await settleSettings(calendar.page, { pluginId: PLUGIN_ID });
		const cal = readDefaultCalendar<PageHeaderState>(calendar.vaultDir);
		expect(cal?.pageHeaderState?.visibleActionIds ?? []).not.toContain(targetId);
	});
});
