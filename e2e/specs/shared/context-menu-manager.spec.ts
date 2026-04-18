import { settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { PLUGIN_ID } from "../../fixtures/constants";
import { isoLocal } from "../../fixtures/dates";
import { expectItemManagerOpen } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { clickContextMenuItem, rightClickEvent } from "../../fixtures/helpers";
import { readDefaultCalendar } from "../../fixtures/plugin-data";
import { sel, TID } from "../../fixtures/testids";

// Exercises shared `createContextMenu`'s item-manager modal end-to-end:
// right-click → "Manage menu items..." → the shared manager modal opens with
// every registered item as a row. Hide an item via the toggle, dismiss the
// modal, verify the item is absent from the next right-click AND that
// calendars[0].contextMenuState persists the hidden id.

type ContextMenuState = {
	contextMenuState?: {
		visibleItemIds?: string[];
	};
};

test.describe("shared: context menu item manager", () => {
	test("hiding a menu item via the manager persists and removes it from the next right-click", async ({ calendar }) => {
		await calendar.createEvent({
			title: "Team Meeting",
			start: isoLocal(0, 9, 0),
			end: isoLocal(0, 10, 0),
		});

		// Right-click the event to surface the shared context menu, then click
		// "Manage menu items..." — both are testid-stamped by shared.
		await rightClickEvent(calendar.page, { title: "Team Meeting" });
		await clickContextMenuItem(calendar.page, "__manage");

		const manager = await expectItemManagerOpen(calendar.page);

		// `duplicateEvent` is always registered and visible in the default state.
		const targetId = "duplicateEvent";
		await manager.toggle(targetId);
		await manager.close();

		// The underlying event context menu stays open because the manager is a
		// modal above it — dismiss it too before re-opening.
		await calendar.page.keyboard.press("Escape");

		// Next right-click: the hidden item must be absent.
		await rightClickEvent(calendar.page, { title: "Team Meeting" });
		await expect(calendar.page.locator(sel(TID.ctxMenu("duplicateEvent")))).toHaveCount(0);
		await calendar.page.keyboard.press("Escape");

		// Disk: the visibleItemIds list excludes the hidden id.
		await settleSettings(calendar.page, { pluginId: PLUGIN_ID });
		const cal = readDefaultCalendar<ContextMenuState>(calendar.vaultDir);
		expect(cal?.contextMenuState?.visibleItemIds ?? []).not.toContain(targetId);
	});
});
