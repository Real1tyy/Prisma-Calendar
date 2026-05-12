import { expect, type Locator } from "@playwright/test";

import { fromAnchor } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import {
	BATCH_FM_ADD_TID,
	BATCH_FM_DELETION_MARKED_CLASS,
	BATCH_FM_KEY_TID,
	BATCH_FM_MODAL_TID,
	BATCH_FM_REMOVE_TID,
	BATCH_FM_ROW_TID,
	BATCH_FM_VALUE_TID,
	FORM_SUBMIT_TID,
	sel,
} from "../../fixtures/testids";

// Click the modal's "Add property" button, then fill the freshly-appended row
// with `key` / `value`. Pre-population rows (Date, Category, …) stay untouched
// — the new row is always the last `BATCH_FM_ROW_TID`.
async function addPropertyRow(modal: Locator, key: string, value: string): Promise<void> {
	const rows = modal.locator(sel(BATCH_FM_ROW_TID));
	const before = await rows.count();
	await modal.locator(sel(BATCH_FM_ADD_TID)).click();
	await expect(rows).toHaveCount(before + 1);
	const row = rows.nth(before);
	await row.locator(sel(BATCH_FM_KEY_TID)).fill(key);
	await row.locator(sel(BATCH_FM_VALUE_TID)).fill(value);
}

// The `BATCH_UPDATE_FRONTMATTER` command is wired in main.ts → calendar-view
// → batch-selection-manager → openBatchFrontmatterModal. No spec exercises
// the modal at all. This spec covers:
//
//   1. Batch-select two events, fire the Frontmatter button, modal opens.
//   2. Add a new property + value, click "Apply changes", disk frontmatter
//      now carries the property on every selected file.
//   3. Re-open the modal on the same set, mark the property for deletion,
//      submit — frontmatter loses the property.
//
// Edits in the modal are sticky (state via useState), so the test types
// values progressively rather than relying on initial-population state.

test.describe("events: batch frontmatter modal end-to-end", () => {
	test("add property → submit writes the property to every selected event on disk", async ({ calendar }) => {
		const page = calendar.page;
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		const events = await calendar.seedMany([
			{ title: "Batch FM One", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 10, 0) },
			{ title: "Batch FM Two", start: fromAnchor(0, 11, 0), end: fromAnchor(0, 12, 0) },
		]);

		const batch = await calendar.batch(events);
		await batch.do("frontmatter");

		const modal = page.locator(sel(BATCH_FM_MODAL_TID)).first();
		await expect(modal).toBeVisible();

		// Common existing frontmatter keys (Date, Category, Prerequisite, …) pre-
		// populate one row each plus one empty row at the end. Add fresh rows
		// for the new properties so we never touch the existing ones.
		await addPropertyRow(modal, "Status", "Reviewing");
		await addPropertyRow(modal, "Sprint", "Alpha");

		await modal.locator(sel(FORM_SUBMIT_TID)).click();
		await expect(modal).toBeHidden();
		await batch.exit();

		// Both events carry both properties on disk.
		for (const evt of events) {
			await evt.expectFrontmatter("Status", (v) => v === "Reviewing");
			await evt.expectFrontmatter("Sprint", (v) => v === "Alpha");
		}
	});

	test("re-opening the modal lists the existing properties; marking for deletion strips them on submit", async ({
		calendar,
	}) => {
		const page = calendar.page;
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		const events = await calendar.seedMany([
			{ title: "Batch Delete One", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 10, 0) },
			{ title: "Batch Delete Two", start: fromAnchor(0, 11, 0), end: fromAnchor(0, 12, 0) },
		]);

		// Round one: assign a "Status" property to both via the modal. The
		// modal pre-fills rows for common existing keys + one empty row; we
		// add a fresh row to avoid clobbering those.
		const batchSet = await calendar.batch(events);
		await batchSet.do("frontmatter");
		const setModal = page.locator(sel(BATCH_FM_MODAL_TID)).first();
		await expect(setModal).toBeVisible();
		await addPropertyRow(setModal, "Status", "Reviewing");
		await setModal.locator(sel(FORM_SUBMIT_TID)).click();
		await expect(setModal).toBeHidden();
		await batchSet.exit();
		for (const evt of events) await evt.expectFrontmatter("Status", (v) => v === "Reviewing");

		// Round two: re-open the modal, the existing `Status` row should
		// pre-populate. Click its remove button to mark it for deletion.
		const refreshed = await Promise.all(events.map((e) => calendar.eventByTitle(e.title)));
		const batchDelete = await calendar.batch(refreshed);
		await batchDelete.do("frontmatter");
		const delModal = page.locator(sel(BATCH_FM_MODAL_TID)).first();
		await expect(delModal).toBeVisible();

		// Find the row whose key equals "Status" — that's the one to drop.
		const statusRow = delModal.locator(sel(BATCH_FM_ROW_TID)).filter({
			has: page.locator(`${sel(BATCH_FM_KEY_TID)}[value="Status"]`),
		});
		await expect(statusRow).toHaveCount(1);
		await statusRow.locator(sel(BATCH_FM_REMOVE_TID)).click();
		await expect(statusRow).toHaveClass(new RegExp(BATCH_FM_DELETION_MARKED_CLASS));

		await delModal.locator(sel(FORM_SUBMIT_TID)).click();
		await expect(delModal).toBeHidden();
		await batchDelete.exit();

		for (const evt of refreshed) {
			await evt.expectFrontmatter("Status", (v) => v === undefined || v === null);
		}
	});
});
