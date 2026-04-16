import { expectPluginData, settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { test } from "../../fixtures/electron";
import { openPrismaSettings, setSchemaNumberInput, setSchemaToggle, switchSettingsTab } from "../../fixtures/helpers";

const PLUGIN_ID = "prisma-calendar";

test.describe("settings: Performance tab", () => {
	test("writes cache/concurrency fields to data.json", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "performance");

		// Default is true — flip to false to confirm the toggle actually writes.
		await setSchemaToggle(obsidian.page, "enableNameSeriesTracking", false);
		await setSchemaNumberInput(obsidian.page, "fileConcurrencyLimit", 25);

		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		expectPluginData(obsidian.vaultDir, PLUGIN_ID, {
			"calendars.0.enableNameSeriesTracking": false,
			"calendars.0.fileConcurrencyLimit": 25,
		});
	});
});
