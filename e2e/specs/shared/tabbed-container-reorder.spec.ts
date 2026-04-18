import type { Page } from "@playwright/test";
import { settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { PLUGIN_ID } from "../../fixtures/constants";
import { openTabManager } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { readDefaultCalendar } from "../../fixtures/plugin-data";
import { sel, SHARED_ROW_PREFIX, TABBED_CONTAINER_MANAGE_BTN } from "../../fixtures/testids";

// Exercises shared `createTabbedContainer`'s manager modal reorder flow.
// Persistence lives at calendars[0].activeTab (same per-calendar pattern as
// pageHeaderState). Uses chevron-up rather than HTML5 drag events (unreliable
// under Electron CDP) — both paths fire the same `moveTab` handler.

type ActiveTabVisible = {
	activeTab?: {
		visibleTabIds?: string[];
	};
};

async function readTabOrder(page: Page): Promise<string[]> {
	return page.evaluate((prefix) => {
		return Array.from(document.querySelectorAll(`[data-testid^='${prefix}']`))
			.filter((el) => el.tagName === "BUTTON")
			.map((el) => el.getAttribute("data-testid")!.replace(prefix, ""));
	}, SHARED_ROW_PREFIX.viewTab);
}

test.describe("shared: tabbed container reorder + persistence", () => {
	test("chevron-up in the tab manager reorders tabs and persists", async ({ calendar }) => {
		await calendar.page.locator(sel(TABBED_CONTAINER_MANAGE_BTN)).first().waitFor({ state: "visible" });

		const initialOrder = await readTabOrder(calendar.page);
		expect(initialOrder.length).toBeGreaterThan(2);

		// Target the 3rd tab — reliably has a chevron-up button.
		const targetId = initialOrder[2]!;
		const predecessorId = initialOrder[1]!;

		const manager = await openTabManager(calendar.page);
		await manager.moveUp(targetId);
		await manager.close();

		const newOrder = await readTabOrder(calendar.page);
		expect(newOrder.indexOf(targetId)).toBeLessThan(newOrder.indexOf(predecessorId));

		await settleSettings(calendar.page, { pluginId: PLUGIN_ID });
		const cal = readDefaultCalendar<ActiveTabVisible>(calendar.vaultDir);
		// The shared container only persists visibleTabIds when the order differs
		// from the default — after our swap it MUST be populated.
		expect(cal?.activeTab?.visibleTabIds?.indexOf(targetId)).toBeLessThan(
			cal?.activeTab?.visibleTabIds?.indexOf(predecessorId) ?? -1
		);
	});

	test("hiding a tab via the manager toggle removes it from the tab bar and persists", async ({ calendar }) => {
		await calendar.page.locator(sel(TABBED_CONTAINER_MANAGE_BTN)).first().waitFor({ state: "visible" });

		const initialOrder = await readTabOrder(calendar.page);
		// Hide the last tab so the hide-toggle is always enabled (first tab may
		// be the active one, shared still allows hiding it but keeping a non-
		// active target makes the DOM assertion simpler).
		const targetId = initialOrder[initialOrder.length - 1]!;

		const manager = await openTabManager(calendar.page);
		await manager.toggle(targetId);
		await manager.close();

		const newOrder = await readTabOrder(calendar.page);
		expect(newOrder).not.toContain(targetId);

		await settleSettings(calendar.page, { pluginId: PLUGIN_ID });
		const cal = readDefaultCalendar<ActiveTabVisible>(calendar.vaultDir);
		expect(cal?.activeTab?.visibleTabIds ?? []).not.toContain(targetId);
	});
});
