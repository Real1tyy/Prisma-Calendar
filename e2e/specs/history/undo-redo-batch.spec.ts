import type { Page } from "@playwright/test";
import { listEventFiles, readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import {
	clickBatchButton,
	confirmBatchAction,
	createEventViaToolbar,
	enterBatchMode,
	exitBatchMode,
	expectEventsNotVisibleByTitle,
	expectEventsVisibleByTitle,
	expectTitleCount,
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
// assertion loops over every affected file. Where the op changes what the
// calendar renders (skip hides, clone adds, delete removes) the DOM is
// asserted too: disk-only checks would miss a "wrote correct frontmatter
// but failed to refresh" regression.

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
		const titles = events.map((e) => e.title);
		const before = listEventFiles(obsidian.vaultDir).length;

		await batchSelect(obsidian.page, titles);
		await clickBatchButton(obsidian.page, "duplicate");
		await waitForEventFileCount(obsidian.vaultDir, before + events.length);
		await exitBatchMode(obsidian.page);
		// Each original title should now render twice (original + duplicate).
		for (const t of titles) await expectTitleCount(obsidian.page, t, 2);

		await undoViaPalette(obsidian.page);
		await waitForEventFileCount(obsidian.vaultDir, before);
		for (const t of titles) await expectTitleCount(obsidian.page, t, 1);

		await redoViaPalette(obsidian.page);
		await waitForEventFileCount(obsidian.vaultDir, before + events.length);
		for (const t of titles) await expectTitleCount(obsidian.page, t, 2);
	});

	test("batch delete: N removed → undo restores every file → redo removes", async ({ obsidian }) => {
		const events = await seedN(obsidian.page, obsidian.vaultDir, 3);
		const titles = events.map((e) => e.title);
		await expectEventsVisibleByTitle(obsidian.page, titles);

		await batchSelect(obsidian.page, titles);
		await clickBatchButton(obsidian.page, "delete");
		await confirmBatchAction(obsidian.page);
		for (const e of events) await waitForFileExists(obsidian.vaultDir, e.path, false);
		await expectEventsNotVisibleByTitle(obsidian.page, titles);

		await undoViaPalette(obsidian.page);
		for (const e of events) await waitForFileExists(obsidian.vaultDir, e.path, true);
		await expectEventsVisibleByTitle(obsidian.page, titles);

		await redoViaPalette(obsidian.page);
		for (const e of events) await waitForFileExists(obsidian.vaultDir, e.path, false);
		await expectEventsNotVisibleByTitle(obsidian.page, titles);
	});

	test("batch skip: every selected has Skip: true and disappears from the calendar", async ({ obsidian }) => {
		const events = await seedN(obsidian.page, obsidian.vaultDir, 3);
		const titles = events.map((e) => e.title);
		// Prisma hides skipped events from the calendar by default, so the DOM
		// should lose exactly N events after skip and regain them on undo.
		await expectEventsVisibleByTitle(obsidian.page, titles);

		await batchSelect(obsidian.page, titles);
		await clickBatchButton(obsidian.page, "skip");
		for (const e of events) await waitForFrontmatter(obsidian.vaultDir, e.path, "Skip", (v) => v === true);
		await exitBatchMode(obsidian.page);
		await expectEventsNotVisibleByTitle(obsidian.page, titles);

		await undoViaPalette(obsidian.page);
		for (const e of events) {
			await waitForFrontmatter(obsidian.vaultDir, e.path, "Skip", (v) => v === undefined || v === false);
		}
		await expectEventsVisibleByTitle(obsidian.page, titles);

		await redoViaPalette(obsidian.page);
		for (const e of events) await waitForFrontmatter(obsidian.vaultDir, e.path, "Skip", (v) => v === true);
		await expectEventsNotVisibleByTitle(obsidian.page, titles);
	});

	test("batch mark done / not done: symmetric Status transitions across every file", async ({ obsidian }) => {
		const events = await seedN(obsidian.page, obsidian.vaultDir, 3);
		const titles = events.map((e) => e.title);

		await batchSelect(obsidian.page, titles);
		await clickBatchButton(obsidian.page, "mark-done");
		for (const e of events) await waitForFrontmatter(obsidian.vaultDir, e.path, "Status", (v) => v === "Done");
		await exitBatchMode(obsidian.page);
		// Done events stay on the calendar (styling changes, visibility doesn't).
		await expectEventsVisibleByTitle(obsidian.page, titles);

		await undoViaPalette(obsidian.page);
		for (const e of events) await waitForFrontmatter(obsidian.vaultDir, e.path, "Status", (v) => v !== "Done");
		await expectEventsVisibleByTitle(obsidian.page, titles);

		await redoViaPalette(obsidian.page);
		for (const e of events) await waitForFrontmatter(obsidian.vaultDir, e.path, "Status", (v) => v === "Done");

		await batchSelect(obsidian.page, titles);
		await clickBatchButton(obsidian.page, "mark-not-done");
		for (const e of events) await waitForFrontmatter(obsidian.vaultDir, e.path, "Status", (v) => v !== "Done");
		await exitBatchMode(obsidian.page);
		await expectEventsVisibleByTitle(obsidian.page, titles);

		await undoViaPalette(obsidian.page);
		for (const e of events) await waitForFrontmatter(obsidian.vaultDir, e.path, "Status", (v) => v === "Done");
	});

	test("batch clone next week: N clones appear → undo removes → redo restores", async ({ obsidian }) => {
		const events = await seedN(obsidian.page, obsidian.vaultDir, 2);
		const titles = events.map((e) => e.title);
		const before = listEventFiles(obsidian.vaultDir).length;

		await batchSelect(obsidian.page, titles);
		await clickBatchButton(obsidian.page, "clone-next");
		await waitForEventFileCount(obsidian.vaultDir, before + events.length);
		await exitBatchMode(obsidian.page);
		// Clones keep the original title — each should render twice (original
		// on day+1, clone on day+8). Per-title is stable; aggregate counts drift
		// because FC month-view renders overflow clones.
		for (const t of titles) await expectTitleCount(obsidian.page, t, 2);

		await undoViaPalette(obsidian.page);
		await waitForEventFileCount(obsidian.vaultDir, before);
		for (const t of titles) await expectTitleCount(obsidian.page, t, 1);

		await redoViaPalette(obsidian.page);
		await waitForEventFileCount(obsidian.vaultDir, before + events.length);
		for (const t of titles) await expectTitleCount(obsidian.page, t, 2);
	});

	test("batch move next week: every file's Start Date shifts → undo reverts all", async ({ obsidian }) => {
		const events = await seedN(obsidian.page, obsidian.vaultDir, 2);
		const titles = events.map((e) => e.title);
		const originalStarts = events.map((e) => readEventFrontmatter(obsidian.vaultDir, e.path)["Start Date"]);

		await batchSelect(obsidian.page, titles);
		await clickBatchButton(obsidian.page, "move-next");
		for (let i = 0; i < events.length; i++) {
			await waitForFrontmatter(obsidian.vaultDir, events[i]!.path, "Start Date", (v) => v !== originalStarts[i]);
		}
		await exitBatchMode(obsidian.page);
		// Move keeps the files — they just slide into next week. Both before/after
		// week slots are within the default month view, so titles stay rendered.
		await expectEventsVisibleByTitle(obsidian.page, titles);

		await undoViaPalette(obsidian.page);
		for (let i = 0; i < events.length; i++) {
			await waitForFrontmatter(obsidian.vaultDir, events[i]!.path, "Start Date", (v) => v === originalStarts[i]);
		}
		await expectEventsVisibleByTitle(obsidian.page, titles);
	});

	test("single undo reverses the whole batch, not just the last event in it", async ({ obsidian }) => {
		const events = await seedN(obsidian.page, obsidian.vaultDir, 3);
		const titles = events.map((e) => e.title);
		const before = listEventFiles(obsidian.vaultDir).length;

		await batchSelect(obsidian.page, titles);
		await clickBatchButton(obsidian.page, "clone-next");
		await waitForEventFileCount(obsidian.vaultDir, before + events.length);
		await exitBatchMode(obsidian.page);
		for (const t of titles) await expectTitleCount(obsidian.page, t, 2);

		await undoViaPalette(obsidian.page, 1);
		await expect.poll(() => listEventFiles(obsidian.vaultDir).length).toBe(before);
		// Single undo must clean up every clone — not just the last one.
		for (const t of titles) await expectTitleCount(obsidian.page, t, 1);
	});
});
