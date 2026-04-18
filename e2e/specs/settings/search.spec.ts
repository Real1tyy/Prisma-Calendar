import { expect, test } from "../../fixtures/electron";
import { openPrismaSettings, switchSettingsTab } from "../../fixtures/helpers";

// The settings nav search input filters `.setting-item` nodes across every
// tab. No data-testid is stamped on the input, so we target the stable
// `.prisma-settings-search-input` class from SettingsNavigation.
//
// The test stays on the imperatively-rendered Calendar tab on purpose —
// React-rendered sections (General, Properties, etc.) mount asynchronously
// while SettingsNavigation's filter runs synchronously, which can make items
// transiently absent from the DOM. The Calendar tab is built with plain
// `new Setting(...)` calls, so its items are present immediately and the
// search filter produces a deterministic before/after visible count.

test.describe("settings: search", () => {
	test("typing a query filters the visible setting items; clearing restores them", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "calendar");

		const searchInput = obsidian.page.locator(".prisma-settings-search-input").first();
		await searchInput.waitFor({ state: "visible" });

		const visibleSettings = obsidian.page.locator(".setting-item:visible");
		const baselineCount = await visibleSettings.count();
		expect(baselineCount).toBeGreaterThan(3);

		// A deliberately-nonsense query guarantees zero matches and surfaces the
		// "No settings found for …" empty-state banner. That sidesteps any race
		// between SettingsNavigation's synchronous filter and asynchronously-
		// mounted React sections, while still exercising the real user path.
		await searchInput.fill("zzzznomatch");
		await searchInput.press("Enter");

		await expect.poll(async () => visibleSettings.count()).toBeLessThan(baselineCount);
		await expect(obsidian.page.locator(".prisma-settings-search-no-results").first()).toBeVisible();

		// Clear → visible count returns to at least the baseline.
		await searchInput.fill("");
		await searchInput.press("Enter");

		await expect.poll(async () => visibleSettings.count()).toBeGreaterThanOrEqual(baselineCount);
	});
});
