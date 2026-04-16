import { expectPluginData, setTextInput, settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { test } from "../../fixtures/electron";
import { openPrismaSettings, setSchemaNumberInput, setSchemaToggle, switchSettingsTab } from "../../fixtures/helpers";

const PLUGIN_ID = "prisma-calendar";

test.describe("settings: Notifications tab", () => {
	test("writes toggles and default-time fields to data.json", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "notifications");

		// Main schema-driven fields (SchemaSection). Flip each off its default so
		// every field emits a store write.
		await setSchemaToggle(obsidian.page, "enableNotifications", false);
		await setSchemaToggle(obsidian.page, "notificationSound", true);
		await setSchemaToggle(obsidian.page, "skipNewlyCreatedNotifications", false);
		await setSchemaNumberInput(obsidian.page, "snoozeMinutes", 10);

		// Default-time fields are custom OptionalNumberFields that stamp the
		// inner input with `prisma-settings-control-<key>` directly.
		await setTextInput(obsidian.page, "prisma-settings-control-defaultMinutesBefore", "15");
		await obsidian.page.keyboard.press("Tab");
		await setTextInput(obsidian.page, "prisma-settings-control-defaultDaysBefore", "1");
		await obsidian.page.keyboard.press("Tab");

		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		expectPluginData(obsidian.vaultDir, PLUGIN_ID, {
			"calendars.0.enableNotifications": false,
			"calendars.0.notificationSound": true,
			"calendars.0.skipNewlyCreatedNotifications": false,
			"calendars.0.snoozeMinutes": 10,
			"calendars.0.defaultMinutesBefore": 15,
			"calendars.0.defaultDaysBefore": 1,
		});
	});
});
