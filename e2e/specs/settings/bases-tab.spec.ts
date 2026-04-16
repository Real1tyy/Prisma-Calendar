import { expectPluginData, settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { test } from "../../fixtures/electron";
import { openPrismaSettings, setSchemaDropdown, setSchemaTextInput, switchSettingsTab } from "../../fixtures/helpers";

const PLUGIN_ID = "prisma-calendar";

test.describe("settings: Bases tab", () => {
	test("writes view type and additional properties to data.json", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "bases");

		await setSchemaDropdown(obsidian.page, "basesViewType", "table");
		// basesViewProperties is z.array(z.string()) → the shared ArrayCsv widget
		// renders a single comma-separated text input; commit happens on blur.
		await setSchemaTextInput(obsidian.page, "basesViewProperties", "priority, project");

		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		expectPluginData(obsidian.vaultDir, PLUGIN_ID, {
			"calendars.0.basesViewType": "table",
			"calendars.0.basesViewProperties": ["priority", "project"],
		});
	});
});
