import { readFileSync } from "node:fs";

import { expect } from "@playwright/test";
import {
	expectPluginData,
	readPluginData,
	setDropdown,
	setNumberInput,
	setTextInput,
	settleSettings,
	setToggle,
} from "@real1ty-obsidian-plugins/testing/e2e";

import { PLUGIN_ID } from "../../fixtures/constants";
import { test } from "../../fixtures/electron";
import { openPrismaSettings, switchSettingsTab } from "../../fixtures/helpers";

const EXPORT_BUTTON = '[data-testid="prisma-settings-transfer-export-button"]';
const IMPORT_BUTTON = '[data-testid="prisma-settings-transfer-import-button"]';
const RESET_BUTTON = '[data-testid="prisma-settings-transfer-reset-button"]';
const EDITOR = '[data-testid="prisma-settings-transfer-editor"]';
const DOWNLOAD_BUTTON = '[data-testid="prisma-settings-transfer-download"]';
const APPLY_BUTTON = '[data-testid="prisma-settings-transfer-apply"]';
const CLOSE_BUTTON = '[data-testid="prisma-settings-transfer-close"]';
const CONFIRM_MODAL_CONFIRM = '[data-testid="confirmation-modal-confirm"]';
const CONFIRM_MODAL_CANCEL = '[data-testid="confirmation-modal-cancel"]';

test.describe("settings: transfer (import/export)", () => {
	test("exports a JSON diff and re-imports it on top of mutated settings", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "general");

		await setTextInput(obsidian.page, "prisma-settings-control-directory", "ExportedEvents");
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		expectPluginData(obsidian.vaultDir, PLUGIN_ID, {
			"calendars.0.directory": "ExportedEvents",
		});

		await obsidian.page.locator(EXPORT_BUTTON).scrollIntoViewIfNeeded();

		const [download] = await Promise.all([
			obsidian.page.waitForEvent("download"),
			(async () => {
				await obsidian.page.locator(EXPORT_BUTTON).click();
				const editor = obsidian.page.locator(EDITOR);
				await editor.waitFor({ state: "visible", timeout: 10_000 });
				const exportedJson = await editor.inputValue();
				expect(exportedJson.length).toBeGreaterThan(2);
				expect(JSON.parse(exportedJson)).toMatchObject({
					calendars: expect.any(Array),
				});
				await obsidian.page.locator(DOWNLOAD_BUTTON).click();
			})(),
		]);

		const savedPath = await download.path();
		const fileContents = readFileSync(savedPath, "utf8");
		const parsed = JSON.parse(fileContents) as { calendars: Array<{ directory: string }> };
		expect(parsed.calendars[0]?.directory).toBe("ExportedEvents");

		await obsidian.page.locator(CLOSE_BUTTON).click();
		await obsidian.page.locator(EDITOR).waitFor({ state: "detached", timeout: 10_000 });

		await setTextInput(obsidian.page, "prisma-settings-control-directory", "SomethingElse");
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		expectPluginData(obsidian.vaultDir, PLUGIN_ID, {
			"calendars.0.directory": "SomethingElse",
		});

		await obsidian.page.locator(IMPORT_BUTTON).scrollIntoViewIfNeeded();
		await obsidian.page.locator(IMPORT_BUTTON).click();
		const importEditor = obsidian.page.locator(EDITOR);
		await importEditor.waitFor({ state: "visible", timeout: 10_000 });
		await importEditor.fill(fileContents);
		await obsidian.page.locator(APPLY_BUTTON).click();
		await importEditor.waitFor({ state: "detached", timeout: 10_000 });

		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		expectPluginData(obsidian.vaultDir, PLUGIN_ID, {
			"calendars.0.directory": "ExportedEvents",
		});
	});

	test("reset to defaults restores transferable fields and keeps the confirmation gate", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "general");

		await setToggle(obsidian.page, "prisma-settings-control-showRibbonIcon", false);
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		expectPluginData(obsidian.vaultDir, PLUGIN_ID, {
			"calendars.0.showRibbonIcon": false,
		});

		await obsidian.page.locator(RESET_BUTTON).scrollIntoViewIfNeeded();
		await obsidian.page.locator(RESET_BUTTON).click();
		await obsidian.page.locator(CONFIRM_MODAL_CANCEL).click();
		await obsidian.page.locator(CONFIRM_MODAL_CANCEL).waitFor({ state: "detached", timeout: 10_000 });
		expectPluginData(obsidian.vaultDir, PLUGIN_ID, {
			"calendars.0.showRibbonIcon": false,
		});

		await obsidian.page.locator(RESET_BUTTON).click();
		await obsidian.page.locator(CONFIRM_MODAL_CONFIRM).click();
		await obsidian.page.locator(CONFIRM_MODAL_CONFIRM).waitFor({ state: "detached", timeout: 10_000 });

		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		expectPluginData(obsidian.vaultDir, PLUGIN_ID, {
			"calendars.0.showRibbonIcon": true,
		});
	});

	test("full roundtrip: mutate many settings → export → reset → import → verify identical", async ({ obsidian }) => {
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "general");

		await setTextInput(obsidian.page, "prisma-settings-control-directory", "RoundtripEvents");
		await setTextInput(obsidian.page, "prisma-settings-control-templatePath", "Templates/Roundtrip.md");
		await setDropdown(obsidian.page, "prisma-settings-control-locale", "de");
		await setToggle(obsidian.page, "prisma-settings-control-showRibbonIcon", false);
		await setToggle(obsidian.page, "prisma-settings-control-enableKeyboardNavigation", false);
		await setDropdown(obsidian.page, "prisma-settings-control-autoAssignZettelId", "calendarEvents");
		await setNumberInput(obsidian.page, "prisma-settings-control-defaultDurationMinutes", 45);
		await setToggle(obsidian.page, "prisma-settings-control-showDurationField", false);
		await setToggle(obsidian.page, "prisma-settings-control-markPastInstancesAsDone", true);
		await setToggle(obsidian.page, "prisma-settings-control-titleAutocomplete", false);
		await setToggle(obsidian.page, "prisma-settings-control-showStopwatch", true);
		await setToggle(obsidian.page, "prisma-settings-control-showDecimalHours", true);
		await setDropdown(obsidian.page, "prisma-settings-control-defaultAggregationMode", "name");

		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		const snapshotBefore = readPluginData(obsidian.vaultDir, PLUGIN_ID) as Record<string, unknown>;
		expect(snapshotBefore).toBeTruthy();

		await obsidian.page.locator(EXPORT_BUTTON).scrollIntoViewIfNeeded();
		await obsidian.page.locator(EXPORT_BUTTON).click();
		const editor = obsidian.page.locator(EDITOR);
		await editor.waitFor({ state: "visible" });
		const exportedJson = await editor.inputValue();
		await obsidian.page.locator(CLOSE_BUTTON).click();
		await editor.waitFor({ state: "detached" });

		await obsidian.page.locator(RESET_BUTTON).scrollIntoViewIfNeeded();
		await obsidian.page.locator(RESET_BUTTON).click();
		await obsidian.page.locator(CONFIRM_MODAL_CONFIRM).click();
		await obsidian.page.locator(CONFIRM_MODAL_CONFIRM).waitFor({ state: "detached" });
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		expectPluginData(obsidian.vaultDir, PLUGIN_ID, {
			"calendars.0.showRibbonIcon": true,
			"calendars.0.showDecimalHours": false,
		});

		await obsidian.page.locator(IMPORT_BUTTON).scrollIntoViewIfNeeded();
		await obsidian.page.locator(IMPORT_BUTTON).click();
		const importEditor = obsidian.page.locator(EDITOR);
		await importEditor.waitFor({ state: "visible" });
		await importEditor.fill(exportedJson);
		await obsidian.page.locator(APPLY_BUTTON).click();
		await importEditor.waitFor({ state: "detached" });
		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });

		const snapshotAfter = readPluginData(obsidian.vaultDir, PLUGIN_ID) as Record<string, unknown>;

		const calendarsAfter = (snapshotAfter as { calendars: Array<Record<string, unknown>> }).calendars[0];
		const calendarsBefore = (snapshotBefore as { calendars: Array<Record<string, unknown>> }).calendars[0];

		expect(calendarsAfter?.directory).toBe("RoundtripEvents");
		expect(calendarsAfter?.templatePath).toBe("Templates/Roundtrip.md");
		expect(calendarsAfter?.locale).toBe("de");
		expect(calendarsAfter?.showRibbonIcon).toBe(false);
		expect(calendarsAfter?.enableKeyboardNavigation).toBe(false);
		expect(calendarsAfter?.autoAssignZettelId).toBe("calendarEvents");
		expect(calendarsAfter?.defaultDurationMinutes).toBe(45);
		expect(calendarsAfter?.showDurationField).toBe(false);
		expect(calendarsAfter?.markPastInstancesAsDone).toBe(true);
		expect(calendarsAfter?.titleAutocomplete).toBe(false);
		expect(calendarsAfter?.showStopwatch).toBe(true);
		expect(calendarsAfter?.showDecimalHours).toBe(true);
		expect(calendarsAfter?.defaultAggregationMode).toBe("name");

		expect(snapshotAfter).toHaveProperty("version", (snapshotBefore as Record<string, unknown>).version);
		expect(snapshotAfter).toHaveProperty(
			"licenseKeySecretName",
			(snapshotBefore as Record<string, unknown>).licenseKeySecretName
		);

		for (const key of Object.keys(calendarsBefore ?? {})) {
			expect(calendarsAfter).toHaveProperty(key);
		}
	});
});
