import type { Page } from "@playwright/test";
import { listEventFiles, readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import {
	clickBatchButton,
	confirmBatchAction,
	createEventViaToolbar,
	enterBatchMode,
	exitBatchMode,
	isoLocal,
	redoViaPalette,
	toggleEventInBatch,
	undoViaPalette,
	waitForEventFileCount,
	waitForFileExists,
	waitForFrontmatter,
} from "../../fixtures/history-helpers";
import { openCalendarReady } from "../events/events-helpers";

// Every batch op is driven through: toolbar Create (per event) → toolbar
// Batch Select → click each event → click the batch action button. Partial
// undo — reverting only some files — is a prod-breaking bug, so every
// assertion loops over every affected file.

async function seedN(page: Page, vaultDir: string, n: number): Promise<Array<{ title: string; path: string }>> {
	const out: Array<{ title: string; path: string }> = [];
	for (let i = 0; i < n; i++) {
		const title = `Batch ${i + 1}`;
		const path = await createEventViaToolbar(page, vaultDir, {
			title,
			start: isoLocal(1, 8 + i),
			end: isoLocal(1, 9 + i),
		});
		out.push({ title, path });
	}
	return out;
}

async function batchSelect(page: Page, titles: string[]): Promise<void> {
	await enterBatchMode(page);
	for (const t of titles) await toggleEventInBatch(page, t);
}

test.describe("undo/redo: batch operations (UI-driven)", () => {
	test.beforeEach(async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
	});

	test("batch duplicate: N → 2N → undo → N → redo → 2N", async ({ obsidian }) => {
		const events = await seedN(obsidian.page, obsidian.vaultDir, 3);
		const before = listEventFiles(obsidian.vaultDir).length;

		await batchSelect(
			obsidian.page,
			events.map((e) => e.title)
		);
		await clickBatchButton(obsidian.page, "duplicate");
		await waitForEventFileCount(obsidian.vaultDir, before + events.length);
		await exitBatchMode(obsidian.page);

		await undoViaPalette(obsidian.page);
		await waitForEventFileCount(obsidian.vaultDir, before);

		await redoViaPalette(obsidian.page);
		await waitForEventFileCount(obsidian.vaultDir, before + events.length);
	});

	test("batch delete: N removed → undo restores every file → redo removes", async ({ obsidian }) => {
		const events = await seedN(obsidian.page, obsidian.vaultDir, 3);

		await batchSelect(
			obsidian.page,
			events.map((e) => e.title)
		);
		await clickBatchButton(obsidian.page, "delete");
		await confirmBatchAction(obsidian.page);
		for (const e of events) await waitForFileExists(obsidian.vaultDir, e.path, false);

		await undoViaPalette(obsidian.page);
		for (const e of events) await waitForFileExists(obsidian.vaultDir, e.path, true);

		await redoViaPalette(obsidian.page);
		for (const e of events) await waitForFileExists(obsidian.vaultDir, e.path, false);
	});

	test("batch skip: every selected has Skip: true → undo none → redo all", async ({ obsidian }) => {
		const events = await seedN(obsidian.page, obsidian.vaultDir, 3);

		await batchSelect(
			obsidian.page,
			events.map((e) => e.title)
		);
		await clickBatchButton(obsidian.page, "skip");
		for (const e of events) await waitForFrontmatter(obsidian.vaultDir, e.path, "Skip", (v) => v === true);
		await exitBatchMode(obsidian.page);

		await undoViaPalette(obsidian.page);
		for (const e of events) {
			await waitForFrontmatter(obsidian.vaultDir, e.path, "Skip", (v) => v === undefined || v === false);
		}

		await redoViaPalette(obsidian.page);
		for (const e of events) await waitForFrontmatter(obsidian.vaultDir, e.path, "Skip", (v) => v === true);
	});

	test("batch mark done / not done: symmetric Status transitions across every file", async ({ obsidian }) => {
		const events = await seedN(obsidian.page, obsidian.vaultDir, 3);

		await batchSelect(
			obsidian.page,
			events.map((e) => e.title)
		);
		await clickBatchButton(obsidian.page, "mark-done");
		for (const e of events) await waitForFrontmatter(obsidian.vaultDir, e.path, "Status", (v) => v === "Done");
		await exitBatchMode(obsidian.page);

		await undoViaPalette(obsidian.page);
		for (const e of events) await waitForFrontmatter(obsidian.vaultDir, e.path, "Status", (v) => v !== "Done");

		await redoViaPalette(obsidian.page);
		for (const e of events) await waitForFrontmatter(obsidian.vaultDir, e.path, "Status", (v) => v === "Done");

		await batchSelect(
			obsidian.page,
			events.map((e) => e.title)
		);
		await clickBatchButton(obsidian.page, "mark-not-done");
		for (const e of events) await waitForFrontmatter(obsidian.vaultDir, e.path, "Status", (v) => v !== "Done");
		await exitBatchMode(obsidian.page);

		await undoViaPalette(obsidian.page);
		for (const e of events) await waitForFrontmatter(obsidian.vaultDir, e.path, "Status", (v) => v === "Done");
	});

	test("batch clone next week: N clones appear → undo removes → redo restores", async ({ obsidian }) => {
		const events = await seedN(obsidian.page, obsidian.vaultDir, 2);
		const before = listEventFiles(obsidian.vaultDir).length;

		await batchSelect(
			obsidian.page,
			events.map((e) => e.title)
		);
		await clickBatchButton(obsidian.page, "clone-next");
		await waitForEventFileCount(obsidian.vaultDir, before + events.length);
		await exitBatchMode(obsidian.page);

		await undoViaPalette(obsidian.page);
		await waitForEventFileCount(obsidian.vaultDir, before);

		await redoViaPalette(obsidian.page);
		await waitForEventFileCount(obsidian.vaultDir, before + events.length);
	});

	test("batch move next week: every file's Start Date shifts → undo reverts all", async ({ obsidian }) => {
		const events = await seedN(obsidian.page, obsidian.vaultDir, 2);
		const originalStarts = events.map((e) => readEventFrontmatter(obsidian.vaultDir, e.path)["Start Date"]);

		await batchSelect(
			obsidian.page,
			events.map((e) => e.title)
		);
		await clickBatchButton(obsidian.page, "move-next");
		for (let i = 0; i < events.length; i++) {
			await waitForFrontmatter(obsidian.vaultDir, events[i]!.path, "Start Date", (v) => v !== originalStarts[i]);
		}
		await exitBatchMode(obsidian.page);

		await undoViaPalette(obsidian.page);
		for (let i = 0; i < events.length; i++) {
			await waitForFrontmatter(obsidian.vaultDir, events[i]!.path, "Start Date", (v) => v === originalStarts[i]);
		}
	});

	test("single undo reverses the whole batch, not just the last event in it", async ({ obsidian }) => {
		const events = await seedN(obsidian.page, obsidian.vaultDir, 3);
		const before = listEventFiles(obsidian.vaultDir).length;

		await batchSelect(
			obsidian.page,
			events.map((e) => e.title)
		);
		await clickBatchButton(obsidian.page, "clone-next");
		await waitForEventFileCount(obsidian.vaultDir, before + events.length);
		await exitBatchMode(obsidian.page);

		await undoViaPalette(obsidian.page, 1);
		await expect.poll(() => listEventFiles(obsidian.vaultDir).length).toBe(before);
	});
});
