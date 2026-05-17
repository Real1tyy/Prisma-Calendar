import { expect } from "@playwright/test";

import { todayStamp } from "../../fixtures/dates";
import { categoryRow } from "../../fixtures/dsl";
import { test } from "../../fixtures/electron";
import { closeSettings, openPrismaSettings, switchSettingsTab } from "../../fixtures/helpers";
import { redoViaPalette, undoViaPalette } from "../../fixtures/history-helpers";

// Category rename / delete used to call the imperative `bulkRenameCategoryInFiles` /
// `bulkDeleteCategoryFromFiles` helpers directly, bypassing the bundle's
// `CommandManager`. That meant undo / redo silently no-op'd for these flows.
// They now route through `BatchCommandFactory.createRenameCategory` /
// `createDeleteCategory`, wrapped in a `MacroCommand` executed via
// `commandManager.executeCommand`. Color rule cascade still runs as a
// non-undoable side effect — only the file frontmatter participates in undo / redo.

test.describe("settings: Categories undo/redo", () => {
	test("rename → undo restores frontmatter; redo reapplies it", async ({ calendar, obsidian }) => {
		const { page } = calendar;

		const evt = await calendar.createEvent({
			title: "Undoable Rename Target",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
			categories: ["Undoable"],
		});
		await evt.expectVisible();

		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "categories");

		const renameModal = await categoryRow(obsidian.page, "Undoable").openRename();
		await renameModal.fill("Renamed");
		await renameModal.submit();

		await expect.poll(() => evt.readCategory()).toEqual(["Renamed"]);
		await closeSettings(obsidian.page);

		await undoViaPalette(page);

		await expect.poll(() => evt.readCategory()).toEqual(["Undoable"]);

		await redoViaPalette(page);

		await expect.poll(() => evt.readCategory()).toEqual(["Renamed"]);
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
