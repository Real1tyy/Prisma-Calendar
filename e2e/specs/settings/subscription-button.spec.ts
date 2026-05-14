import { expect } from "@playwright/test";

import { PLUGIN_ID } from "../../fixtures/constants";
import { test } from "../../fixtures/electron";
import { openPrismaSettings, switchSettingsTab } from "../../fixtures/helpers";
import type { PrismaPlugin, PrismaWindow } from "../../fixtures/window-types";

test.describe("settings: Subscription button", () => {
	test("shows Start free trial button when no license is active", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "general");

		const subscriptionItem = obsidian.page.locator('.setting-item:has(.setting-item-name:text-is("Subscription"))');
		await expect(subscriptionItem).toBeVisible();

		const btn = subscriptionItem.locator("button");
		await expect(btn).toHaveText("Start free trial");
		await expect(btn).toHaveClass(/mod-cta/);
	});

	test("shows Manage Subscription button when license is valid", async ({ obsidian }) => {
		await obsidian.page.evaluate((pid) => {
			const w = window as unknown as PrismaWindow;
			const plugin = w.app.plugins.plugins[pid] as PrismaPlugin | undefined;
			const lm = plugin?.licenseManager;
			if (!lm) throw new Error("licenseManager missing");
			lm.status$.next({
				state: "valid",
				activationsCurrent: 1,
				activationsLimit: 5,
				expiresAt: null,
				errorMessage: null,
			});
			lm.__setProForTesting?.(true);
		}, PLUGIN_ID);

		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "general");

		const subscriptionItem = obsidian.page.locator('.setting-item:has(.setting-item-name:text-is("Subscription"))');
		await expect(subscriptionItem).toBeVisible();

		const btn = subscriptionItem.locator("button");
		await expect(btn).toHaveText("Manage Subscription");
	});
});
