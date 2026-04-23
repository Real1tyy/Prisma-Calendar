import {
	expectPluginData,
	readEventFrontmatter,
	readPluginData,
	settleSettings,
} from "@real1ty-obsidian-plugins/testing/e2e";

import { PLUGIN_ID } from "../../fixtures/constants";
import { expect, test } from "../../fixtures/electron";
import {
	closeSettings,
	createEventViaToolbar,
	fillEventModalMinimal,
	openCalendarView,
	openPrismaSettings,
	saveEventModal,
	setSchemaTextInput,
	switchSettingsTab,
} from "../../fixtures/helpers";
import { listEventFiles } from "../events/events-helpers";

// One representative key per category — don't iterate 47. Timing, identity,
// recurrence, state, metadata.
const RENAMES: Array<{ original: string; renamed: string }> = [
	{ original: "startProp", renamed: "EventStart" },
	{ original: "calendarTitleProp", renamed: "DisplayTitle" },
	{ original: "rruleProp", renamed: "Recurrence" },
	{ original: "statusProperty", renamed: "EventStatus" },
	{ original: "categoryProp", renamed: "EventCategory" },
];

test.describe("settings: Properties tab", () => {
	test("renaming frontmatter properties persists each key to data.json", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "properties");

		for (const { original, renamed } of RENAMES) {
			await setSchemaTextInput(obsidian.page, original, renamed);
		}

		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		const dataExpectations: Record<string, unknown> = {};
		for (const { original, renamed } of RENAMES) {
			dataExpectations[`calendars.0.${original}`] = renamed;
		}
		expectPluginData(obsidian.vaultDir, PLUGIN_ID, dataExpectations);
	});

	test("renamed start property persists to data.json immediately after settle", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "properties");
		await setSchemaTextInput(obsidian.page, "startProp", "EventStart");
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		const data = readPluginData(obsidian.vaultDir, PLUGIN_ID) as {
			calendars: Array<{ startProp: string }>;
		};
		expect(data.calendars[0].startProp).toBe("EventStart");
	});

	test("newly-created events use the renamed start/end property keys", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "properties");
		await setSchemaTextInput(obsidian.page, "startProp", "EventStart");
		await setSchemaTextInput(obsidian.page, "endProp", "EventEnd");
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		await closeSettings(obsidian.page);

		await openCalendarView(obsidian.page);
		await createEventViaToolbar(obsidian.page);

		const title = `Renamed Props ${Date.now()}`;
		await fillEventModalMinimal(obsidian.page, { title });
		await saveEventModal(obsidian.page);

		await expect.poll(() => listEventFiles(obsidian.vaultDir).some((f) => f.includes(title))).toBe(true);

		const files = listEventFiles(obsidian.vaultDir);
		const match = files.find((f) => f.includes(title));
		if (!match) throw new Error(`No event file found containing "${title}". Files: ${files.join(", ")}`);
		const relative = match.slice(obsidian.vaultDir.length + 1);
		const fm = readEventFrontmatter(obsidian.vaultDir, relative);

		expect(fm).toHaveProperty("EventStart");
		expect(fm).not.toHaveProperty("Start Date");
	});
});
