import type { Locator, Page } from "@playwright/test";
import { settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { PLUGIN_ID } from "../../fixtures/constants";
import { isoLocal } from "../../fixtures/dates";
import { expectItemManagerOpen, openActionManager, openTabManager } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { clickContextMenuItem, rightClickEvent } from "../../fixtures/helpers";
import { readDefaultCalendar } from "../../fixtures/plugin-data";
import { ICON_PICKER_GRID_TID, ICON_PICKER_NO_ICON_TID, sel } from "../../fixtures/testids";

type Overrides = {
	renames?: Record<string, string>;
	iconOverrides?: Record<string, string>;
	colorOverrides?: Record<string, string>;
};

async function customizeAndAssert(
	page: Page,
	vaultDir: string,
	opts: {
		modal: Locator;
		editBtnTid: string;
		iconBtnTid: string;
		allowNoIcon: boolean;
		newName: string;
		color: string;
		close: () => Promise<void>;
		readOverrides: () => Overrides | undefined;
		itemId: string;
	}
): Promise<void> {
	await opts.modal.locator(sel(opts.editBtnTid)).first().click();

	// Rename.
	const nameInput = opts.modal.locator(".setting-item:has(.setting-item-name:text('Name')) input[type='text']").first();
	await nameInput.fill(opts.newName);

	// Icon — pick the first one; verify No icon visibility.
	await opts.modal.locator(sel(opts.iconBtnTid)).first().click();
	const grid = page.locator(sel(ICON_PICKER_GRID_TID)).first();
	await grid.waitFor({ state: "visible" });
	if (opts.allowNoIcon) {
		await expect(page.locator(sel(ICON_PICKER_NO_ICON_TID)).first()).toBeVisible();
	} else {
		await expect(page.locator(sel(ICON_PICKER_NO_ICON_TID))).toHaveCount(0);
	}
	const firstIcon = grid.locator('[data-testid^="shared-icon-picker-item-"]').first();
	const chosenIconId = await firstIcon
		.getAttribute("data-testid")
		.then((t) => t!.replace("shared-icon-picker-item-", ""));
	await firstIcon.click();
	await grid.waitFor({ state: "detached" });

	// Color.
	const colorPicker = opts.modal
		.locator(".setting-item:has(.setting-item-name:text('Color')) input[type='color']")
		.first();
	await colorPicker.evaluate((el: HTMLInputElement, hex: string) => {
		const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
		nativeSet.call(el, hex);
		el.dispatchEvent(new Event("input", { bubbles: true }));
		el.dispatchEvent(new Event("change", { bubbles: true }));
	}, opts.color);

	await opts.close();

	// Persistence.
	await settleSettings(page, { pluginId: PLUGIN_ID });
	const overrides = opts.readOverrides();
	expect(overrides?.renames?.[opts.itemId]).toBe(opts.newName);
	expect(overrides?.iconOverrides?.[opts.itemId]).toBe(chosenIconId);
	expect(overrides?.colorOverrides?.[opts.itemId]).toBeTruthy();
}

test.describe("manager customization + persistence", () => {
	test("tab manager: rename + icon + color → persisted", async ({ calendar }) => {
		const manager = await openTabManager(calendar.page);
		await customizeAndAssert(calendar.page, calendar.vaultDir, {
			modal: manager.modal,
			editBtnTid: "prisma-tab-manager-edit-calendar",
			iconBtnTid: "prisma-tab-manager-icon-btn-calendar",
			allowNoIcon: true,
			newName: "My Calendar",
			color: "#ff0000",
			itemId: "calendar",
			close: () => manager.close(),
			readOverrides: () => readDefaultCalendar<{ activeTab?: Overrides }>(calendar.vaultDir)?.activeTab,
		});
	});

	test("page header: rename + icon + color → persisted", async ({ calendar }) => {
		const manager = await openActionManager(calendar.page);
		await customizeAndAssert(calendar.page, calendar.vaultDir, {
			modal: manager.modal,
			editBtnTid: "prisma-action-manager-edit-create-event",
			iconBtnTid: "prisma-action-manager-icon-btn-create-event",
			allowNoIcon: false,
			newName: "New Event",
			color: "#00ff00",
			itemId: "create-event",
			close: () => manager.close(),
			readOverrides: () => readDefaultCalendar<{ pageHeaderState?: Overrides }>(calendar.vaultDir)?.pageHeaderState,
		});
	});

	test("context menu: rename + icon + color → persisted", async ({ calendar }) => {
		await calendar.createEvent({
			title: "Team Meeting",
			start: isoLocal(0, 9, 0),
			end: isoLocal(0, 10, 0),
		});
		await rightClickEvent(calendar.page, { title: "Team Meeting" });
		await clickContextMenuItem(calendar.page, "__manage");
		const manager = await expectItemManagerOpen(calendar.page);

		await customizeAndAssert(calendar.page, calendar.vaultDir, {
			modal: manager.modal,
			editBtnTid: "prisma-item-manager-edit-editEvent",
			iconBtnTid: "prisma-item-manager-icon-btn-editEvent",
			allowNoIcon: false,
			newName: "Edit Note",
			color: "#0000ff",
			itemId: "editEvent",
			close: async () => {
				await manager.close();
				await calendar.page.keyboard.press("Escape");
			},
			readOverrides: () => readDefaultCalendar<{ contextMenuState?: Overrides }>(calendar.vaultDir)?.contextMenuState,
		});
	});
});
