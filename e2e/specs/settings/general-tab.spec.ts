import {
	expectPluginData,
	setDropdown,
	setNumberInput,
	setTextInput,
	settleSettings,
	setToggle,
} from "@real1ty-obsidian-plugins/testing/e2e";

import { PLUGIN_ID } from "../../fixtures/constants";
import { test } from "../../fixtures/electron";
import { openPrismaSettings, switchSettingsTab } from "../../fixtures/helpers";

test.describe("settings: General tab", () => {
	test("writes every major field group to data.json", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "general");

		// Directory section
		await setTextInput(obsidian.page, "prisma-settings-control-directory", "EventsRenamed");
		await setTextInput(obsidian.page, "prisma-settings-control-templatePath", "Templates/event.md");
		await setDropdown(obsidian.page, "prisma-settings-control-locale", "fr");
		await setToggle(obsidian.page, "prisma-settings-control-showRibbonIcon", false);
		await setToggle(obsidian.page, "prisma-settings-control-enableKeyboardNavigation", false);
		await setDropdown(obsidian.page, "prisma-settings-control-autoAssignZettelId", "calendarEvents");

		// Parsing section
		await setNumberInput(obsidian.page, "prisma-settings-control-defaultDurationMinutes", 45);
		await setToggle(obsidian.page, "prisma-settings-control-showDurationField", true);
		await setToggle(obsidian.page, "prisma-settings-control-markPastInstancesAsDone", true);
		await setToggle(obsidian.page, "prisma-settings-control-titleAutocomplete", true);

		// Time tracker
		await setToggle(obsidian.page, "prisma-settings-control-showStopwatch", true);

		// Statistics
		await setToggle(obsidian.page, "prisma-settings-control-showDecimalHours", true);
		await setDropdown(obsidian.page, "prisma-settings-control-defaultAggregationMode", "category");

		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		expectPluginData(obsidian.vaultDir, PLUGIN_ID, {
			"calendars.0.directory": "EventsRenamed",
			"calendars.0.templatePath": "Templates/event.md",
			"calendars.0.locale": "fr",
			"calendars.0.showRibbonIcon": false,
			"calendars.0.enableKeyboardNavigation": false,
			"calendars.0.autoAssignZettelId": "calendarEvents",
			"calendars.0.defaultDurationMinutes": 45,
			"calendars.0.showDurationField": true,
			"calendars.0.markPastInstancesAsDone": true,
			"calendars.0.titleAutocomplete": true,
			"calendars.0.showStopwatch": true,
			"calendars.0.showDecimalHours": true,
			"calendars.0.defaultAggregationMode": "category",
		});
	});
});
