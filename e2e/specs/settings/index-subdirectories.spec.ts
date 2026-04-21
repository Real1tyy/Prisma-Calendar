import { settleSettings, setToggle } from "@real1ty-obsidian-plugins/testing/e2e";

import { PLUGIN_ID } from "../../fixtures/constants";
import { anchorISO } from "../../fixtures/dates";
import { createEventHandle } from "../../fixtures/dsl/event";
import { test } from "../../fixtures/electron";
import { closeSettings, openCalendarView, openPrismaSettings, switchSettingsTab } from "../../fixtures/helpers";
import { refreshCalendar, seedEvent } from "../../fixtures/seed-events";
import { openCalendarReady } from "../events/events-helpers";

const SUBDIR_EVENT_TITLE = "Team Meeting";
const NESTED_SUBDIR = "Events/SubFolder/Deep";

test.describe("settings: Index subdirectories", () => {
	test("events in nested subdirectories appear by default, disappear when disabled, reappear when re-enabled", async ({
		obsidian,
	}) => {
		// Seed an all-day event two folders deep under Events/
		const relPath = seedEvent(obsidian.vaultDir, {
			title: SUBDIR_EVENT_TITLE,
			date: anchorISO(),
			allDay: true,
			subdir: NESTED_SUBDIR,
		});

		await openCalendarReady(obsidian.page);
		await openCalendarView(obsidian.page);
		await refreshCalendar(obsidian.page);

		const handle = createEventHandle({ page: obsidian.page, vaultDir: obsidian.vaultDir }, relPath, SUBDIR_EVENT_TITLE);

		// By default, indexSubdirectories is true — event must appear.
		await handle.expectVisible(true);

		// Disable index subdirectories via the General settings tab.
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "general");
		await setToggle(obsidian.page, "prisma-settings-control-indexSubdirectories", false);
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		await closeSettings(obsidian.page);

		// Event in subdir must no longer be visible.
		await handle.expectVisible(false);

		// Re-enable index subdirectories.
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "general");
		await setToggle(obsidian.page, "prisma-settings-control-indexSubdirectories", true);
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		await closeSettings(obsidian.page);

		// Event reappears now that recursive scanning is back on.
		await handle.expectVisible(true);
	});
});
