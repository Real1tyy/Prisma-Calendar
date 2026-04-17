import { settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { isoLocal } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import {
	clickContextMenuItem,
	createEventViaUI,
	openCalendarViewViaRibbon,
	rightClickEvent,
	waitForNoticesClear,
} from "../../fixtures/helpers";
import { readDefaultCalendar } from "../../fixtures/plugin-data";

// Exercises shared `createContextMenu`'s item-manager modal end-to-end:
// right-click → "Manage menu items..." → the shared manager modal opens with
// every registered item as a row. Hide an item via the toggle, dismiss the
// modal, verify the item is absent from the next right-click AND that
// calendars[0].contextMenuState persists the hidden id.

const PLUGIN_ID = "prisma-calendar";
const MANAGER_MODAL = '[data-testid="prisma-item-manager-modal"]';

type ContextMenuState = {
	contextMenuState?: {
		visibleItemIds?: string[];
	};
};

test.describe("shared: context menu item manager", () => {
	test("hiding a menu item via the manager persists and removes it from the next right-click", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);
		await createEventViaUI(obsidian.page, {
			title: "Team Meeting",
			start: isoLocal(0, 9, 0),
			end: isoLocal(0, 10, 0),
		});
		await waitForNoticesClear(obsidian.page);

		// Right-click the event to surface the shared context menu, then click
		// "Manage menu items..." — both are testid-stamped by shared.
		await rightClickEvent(obsidian.page, { title: "Team Meeting" });
		await clickContextMenuItem(obsidian.page, "__manage");

		const modal = obsidian.page.locator(MANAGER_MODAL);
		await modal.waitFor({ state: "visible" });

		// `duplicateEvent` is always registered and visible in the default state.
		const targetId = "duplicateEvent";
		const hideBtn = modal.locator(`[data-testid="prisma-item-manager-toggle-${targetId}"]`).first();
		await hideBtn.waitFor({ state: "visible" });
		await hideBtn.click();

		await obsidian.page.keyboard.press("Escape");
		await modal.waitFor({ state: "hidden" });
		// The underlying event context menu stays open because the manager is a
		// modal above it — dismiss it too before re-opening.
		await obsidian.page.keyboard.press("Escape");

		// Next right-click: the hidden item must be absent.
		await rightClickEvent(obsidian.page, { title: "Team Meeting" });
		await expect(obsidian.page.locator(`[data-testid="prisma-context-menu-item-${targetId}"]`)).toHaveCount(0);
		await obsidian.page.keyboard.press("Escape");

		// Disk: the visibleItemIds list excludes the hidden id.
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		const cal = readDefaultCalendar<ContextMenuState>(obsidian.vaultDir);
		expect(cal?.contextMenuState?.visibleItemIds ?? []).not.toContain(targetId);
	});
});
