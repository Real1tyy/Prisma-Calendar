import { expect } from "@playwright/test";

import { todayStamp } from "../../fixtures/dates";
import { categoryRow } from "../../fixtures/dsl";
import { test } from "../../fixtures/electron";
import { closeSettings, openPrismaSettings, switchSettingsTab } from "../../fixtures/helpers";
import { redoViaPalette, undoViaPalette } from "../../fixtures/history-helpers";
import { updateCalendarSettings } from "../../fixtures/seed-events";

// Category rename / delete route through `createBatchRenameCategory` /
// `createBatchDeleteCategory` plus an `UpdateColorRulesCommand`, all appended
// into a single `MacroCommand` and registered with the bundle's
// `CommandManager`. Undo / redo therefore walks the file rewrites AND the
// matching color rule in one step — this spec proves the round-trip works
// for both at once.

const RULE_COLOR = "#ff00aa";

test.describe("settings: Categories undo/redo", () => {
	test("rename → undo restores frontmatter and color rule; redo reapplies both", async ({ calendar, obsidian }) => {
		const { page } = calendar;

		await updateCalendarSettings(page, {
			colorRules: [
				{ id: "rule-undoable", expression: "Category.includes('Undoable')", color: RULE_COLOR, enabled: true },
			],
		});

		const evt = await calendar.createEvent({
			title: "Undoable Rename Target",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
			categories: ["Undoable"],
		});
		await evt.expectVisible();
		await evt.expectColor(RULE_COLOR);

		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "categories");

		const renameModal = await categoryRow(obsidian.page, "Undoable").openRename();
		await renameModal.fill("Renamed");
		await renameModal.submit();

		await expect.poll(() => evt.readCategory()).toEqual(["Renamed"]);
		await closeSettings(obsidian.page);

		await undoViaPalette(page);

		await expect.poll(() => evt.readCategory()).toEqual(["Undoable"]);
		// Color rule must come back with the original expression so the tile keeps the rule color.
		await evt.expectColor(RULE_COLOR);

		await redoViaPalette(page);

		await expect.poll(() => evt.readCategory()).toEqual(["Renamed"]);
		await evt.expectColor(RULE_COLOR);
	});

	test("delete → undo restores the category; redo removes it again", async ({ calendar, obsidian }) => {
		const { page } = calendar;

		const evt = await calendar.createEvent({
			title: "Undoable Delete Target",
			start: todayStamp(11, 0),
			end: todayStamp(12, 0),
			categories: ["ToDelete"],
		});
		await evt.expectVisible();

		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "categories");

		const deleteModal = await categoryRow(obsidian.page, "ToDelete").openDelete();
		await deleteModal.confirm();

		await expect.poll(() => evt.readCategory()).toEqual([]);
		await closeSettings(obsidian.page);

		await undoViaPalette(page);

		await expect.poll(() => evt.readCategory()).toEqual(["ToDelete"]);

		await redoViaPalette(page);

		await expect.poll(() => evt.readCategory()).toEqual([]);
	});
});
