import { expect } from "@playwright/test";
import { isPluginLoaded } from "@real1ty-obsidian-plugins/testing/e2e";

import { testResilience as test } from "../../fixtures/electron";
import { countLeavesOfType, disablePrisma, enablePrisma, PLUGIN_ID } from "../../fixtures/resilience-helpers";

const DEFAULT_VIEW_TYPE = "custom-calendar-view-default";

// Disabling Prisma should tear down all views cleanly (no stale DOM left
// behind). Re-enabling should rebuild everything from disk with no data
// loss — same events, same settings.
test("views unmount on disable and state returns on re-enable", async ({ calendar, obsidian }) => {
	// The `calendar` fixture opens the view for us; we just need the view to
	// be active before we tear down the plugin.
	void calendar;

	await disablePrisma(obsidian.page);
	expect(await isPluginLoaded(obsidian.page, PLUGIN_ID)).toBe(false);
	expect(await countLeavesOfType(obsidian.page, DEFAULT_VIEW_TYPE)).toBe(0);

	await enablePrisma(obsidian.page);
	expect(await isPluginLoaded(obsidian.page, PLUGIN_ID)).toBe(true);

	expect(obsidian.readVaultFile("Events/Team Meeting.md")).toContain("Team Meeting");
});
