import { readPluginData, settleSettings, setToggle } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import { openPrismaSettings, switchSettingsTab } from "../../fixtures/helpers";

const PLUGIN_ID = "prisma-calendar";

type CalendarData = { calendars: Array<Record<string, unknown>> };

test.describe("settings: Configuration tab", () => {
	test("toggling a toolbar button removes it from calendars[0].toolbarButtons", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "configuration");

		await setToggle(obsidian.page, "prisma-settings-control-toolbarButtons-searchInput", false);
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		const data = readPluginData(obsidian.vaultDir, PLUGIN_ID) as CalendarData;
		const desktop = data.calendars[0].toolbarButtons as string[];
		expect(desktop).not.toContain("searchInput");
		// Sanity: other toolbar buttons still present.
		expect(desktop).toContain("today");
	});

	test("toggling a mobile toolbar button writes the mobile array independently", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "configuration");

		await setToggle(obsidian.page, "prisma-settings-control-mobileToolbarButtons-zoomLevel", false);
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		const data = readPluginData(obsidian.vaultDir, PLUGIN_ID) as CalendarData;
		const mobile = data.calendars[0].mobileToolbarButtons as string[];
		const desktop = data.calendars[0].toolbarButtons as string[];
		expect(mobile).not.toContain("zoomLevel");
		expect(desktop).toContain("zoomLevel");
	});

	test("enabling a default-off batch action adds it to batchActionButtons", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "configuration");

		// batchMoveBy is excluded from the default list — toggling on adds it.
		await setToggle(obsidian.page, "prisma-settings-control-batchActionButtons-batchMoveBy", true);
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		const data = readPluginData(obsidian.vaultDir, PLUGIN_ID) as CalendarData;
		const batch = data.calendars[0].batchActionButtons as string[];
		expect(batch).toContain("batchMoveBy");
		// Defaults (batchSelectAll) stay put.
		expect(batch).toContain("batchSelectAll");
	});
});
