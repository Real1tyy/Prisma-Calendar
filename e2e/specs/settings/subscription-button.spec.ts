import { expect } from "@playwright/test";

import { PLUGIN_ID } from "../../fixtures/constants";
import { test } from "../../fixtures/electron";
import { openPrismaSettings, switchSettingsTab } from "../../fixtures/helpers";

test.describe("settings: Subscription button", () => {
	test("shows Subscribe button when no license is active", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "general");

		const subscriptionItem = obsidian.page.locator('.setting-item:has(.setting-item-name:text-is("Subscription"))');
		await expect(subscriptionItem).toBeVisible();

		const btn = subscriptionItem.locator("button");
		await expect(btn).toHaveText("Subscribe");
		await expect(btn).toHaveClass(/mod-cta/);
	});

	test("shows Manage Subscription button when license is valid", async ({ obsidian }) => {
		await obsidian.page.evaluate((pid) => {
			const w = window as unknown as {
				app: {
					plugins: {
						plugins: Record<
							string,
							{
								licenseManager?: {
									status$: { next: (v: unknown) => void };
									__setProForTesting?: (v: boolean) => void;
								};
							}
						>;
					};
				};
			};
			const lm = w.app.plugins.plugins[pid]?.licenseManager;
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
