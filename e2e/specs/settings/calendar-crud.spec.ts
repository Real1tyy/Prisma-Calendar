import { readPluginData, setTextInput, settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

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

type CalendarRow = { id: string; name: string; directory?: string };
type PluginData = { calendars: CalendarRow[] };

function getCalendars(vaultDir: string): CalendarRow[] {
	return (readPluginData(vaultDir, PLUGIN_ID) as PluginData).calendars;
}

test.describe("settings: calendar CRUD", () => {
	test("Create new adds a second calendar to data.json", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);

		await obsidian.page.locator('[data-testid="prisma-settings-calendar-add"]').click();
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		const calendars = getCalendars(obsidian.vaultDir);
		expect(calendars).toHaveLength(2);
		expect(calendars[0].id).toBe("default");
		expect(calendars[1].id).not.toBe("default");
		expect(calendars[1].name).toMatch(/Calendar\s*2/);
	});

	test("Clone current duplicates every setting except id/name", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);

		// Customize the default calendar so clone has something distinctive to copy.
		await switchSettingsTab(obsidian.page, "properties");
		await setSchemaTextInput(obsidian.page, "startProp", "CustomStart");
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		await obsidian.page.locator('[data-testid="prisma-settings-calendar-clone"]').click();
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		const calendars = getCalendars(obsidian.vaultDir);
		expect(calendars).toHaveLength(2);

		const original = calendars[0] as unknown as Record<string, unknown>;
		const clone = calendars[1] as unknown as Record<string, unknown>;
		expect(clone["id"]).not.toBe(original["id"]);
		expect(clone["name"]).not.toBe(original["name"]);
		expect(clone["name"]).toMatch(/\(Copy\)/);
		expect(clone["startProp"]).toBe("CustomStart");
		expect(clone["startProp"]).toBe(original["startProp"]);
	});

	test("Rename current updates the calendar name via the rename modal", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);

		await obsidian.page.locator('[data-testid="prisma-settings-calendar-rename"]').click();

		const renameInput = obsidian.page.locator('[data-testid="prisma-settings-calendar-rename-input"]').first();
		await renameInput.waitFor({ state: "visible" });
		// Obsidian's TextComponent wires its onChange to the input event, which
		// fill() fires natively — the `newName` closure inside the rename modal
		// only updates via that listener, so no extra change dispatch is needed.
		await renameInput.fill("Renamed Calendar");
		await obsidian.page.locator('[data-testid="prisma-settings-calendar-rename-submit"]').first().click();
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		const calendars = getCalendars(obsidian.vaultDir);
		expect(calendars[0].name).toBe("Renamed Calendar");
	});

	test("Delete current removes a calendar and preserves the remaining ones", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);

		// Need at least two calendars to delete — delete is disabled on the last one.
		await obsidian.page.locator('[data-testid="prisma-settings-calendar-add"]').click();
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		const beforeDelete = getCalendars(obsidian.vaultDir);
		expect(beforeDelete).toHaveLength(2);

		// The just-added calendar is now selected; delete it.
		await obsidian.page.locator('[data-testid="prisma-settings-calendar-delete"]').click();
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		const afterDelete = getCalendars(obsidian.vaultDir);
		expect(afterDelete).toHaveLength(1);
		expect(afterDelete[0].id).toBe("default");
	});

	test("events created in different calendars land in their configured directories", async ({ obsidian }) => {
		// 1. Configure the default calendar's directory.
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "general");
		await setTextInput(obsidian.page, "prisma-settings-control-directory", "CalendarA");

		// 2. Add a second calendar and set its directory.
		await obsidian.page.locator('[data-testid="prisma-settings-calendar-add"]').click();
		await setTextInput(obsidian.page, "prisma-settings-control-directory", "CalendarB");
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		const calendars = getCalendars(obsidian.vaultDir);
		expect(calendars.map((c) => c.directory).sort()).toEqual(["CalendarA", "CalendarB"]);
		const calendarAId = calendars.find((c) => c.directory === "CalendarA")!.id;
		const calendarBId = calendars.find((c) => c.directory === "CalendarB")!.id;

		await closeSettings(obsidian.page);

		// 3. Open CalendarB via its ribbon icon, create an event from the toolbar.
		await openCalendarView(obsidian.page, calendarBId);
		await createEventViaToolbar(obsidian.page);
		const titleB = `Isolation B ${Date.now()}`;
		await fillEventModalMinimal(obsidian.page, { title: titleB });
		await saveEventModal(obsidian.page);

		await expect.poll(() => listEventFiles(obsidian.vaultDir, "CalendarB").some((f) => f.includes(titleB))).toBe(true);
		expect(listEventFiles(obsidian.vaultDir, "CalendarA").some((f) => f.includes(titleB))).toBe(false);

		// 4. Open CalendarA via its ribbon icon and repeat.
		await openCalendarView(obsidian.page, calendarAId);
		await createEventViaToolbar(obsidian.page);
		const titleA = `Isolation A ${Date.now()}`;
		await fillEventModalMinimal(obsidian.page, { title: titleA });
		await saveEventModal(obsidian.page);

		await expect.poll(() => listEventFiles(obsidian.vaultDir, "CalendarA").some((f) => f.includes(titleA))).toBe(true);
	});
});
