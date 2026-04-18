import { isoLocal } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import {
	batchCounter,
	clickBatchButton,
	enterBatchMode,
	eventByTitle,
	exitBatchMode,
	expectSelectedCount,
	toggleEventInBatch,
	waitForBatchSelectable,
} from "../../fixtures/history-helpers";
import { sel, TID } from "../../fixtures/testids";

// Selection-state commands don't mutate events — they only flip UI state.
// These specs verify that clicking the batch toolbar button enters selection
// mode, that "All" / "Clear" fire across every visible event, and that single
// clicks toggle selection. Each assertion checks BOTH the counter ("N
// selected") and the aggregate class count — a regression that drifts one
// without the other is exactly the kind of partial failure these catch.

test.describe("batch selection (UI-driven)", () => {
	test("toolbar batch-select button enters selection mode and exits on Exit click", async ({ calendar }) => {
		await calendar.createEvent({
			title: "Batch Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await enterBatchMode(calendar.page);
		await expect(batchCounter(calendar.page)).toBeVisible();
		await expectSelectedCount(calendar.page, 0);

		await exitBatchMode(calendar.page);
		await expect(batchCounter(calendar.page)).toBeHidden();
	});

	test("Select All / Clear batch buttons populate and empty the selection", async ({ calendar }) => {
		const titles = ["Alice", "Bob", "Charlie"];
		for (const [i, title] of titles.entries()) {
			await calendar.createEvent({
				title,
				start: isoLocal(1, 9 + i),
				end: isoLocal(1, 10 + i),
			});
		}

		await enterBatchMode(calendar.page);
		// Guard against the last-created event racing with its mount callback:
		// Select All iterates `calendar.getEvents()` and only selects events
		// that are already file-backed AND have their DOM mount data attached.
		// Wait for every title to be classed `batch-selectable` before firing.
		await waitForBatchSelectable(calendar.page, titles);
		await expectSelectedCount(calendar.page, 0);

		// Count every batch-selectable event (our 3 + any seeded into the vault)
		// so the counter assertion survives a richer seed.
		const batchSelectableTotal = await calendar.page
			.locator(`.workspace-leaf.mod-active ${sel(TID.block)}.prisma-batch-selectable`)
			.count();

		await clickBatchButton(calendar.page, "select-all");
		for (const title of titles) {
			await expect(eventByTitle(calendar.page, title)).toHaveClass(/batch-selected/);
		}
		await expectSelectedCount(calendar.page, batchSelectableTotal);

		await clickBatchButton(calendar.page, "clear");
		for (const title of titles) {
			await expect(eventByTitle(calendar.page, title)).not.toHaveClass(/batch-selected/);
		}
		await expectSelectedCount(calendar.page, 0);

		await exitBatchMode(calendar.page);
	});

	test("clicking an event while in batch mode toggles its selection", async ({ calendar }) => {
		await calendar.createEvent({
			title: "Toggle Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await enterBatchMode(calendar.page);
		await expectSelectedCount(calendar.page, 0);

		await toggleEventInBatch(calendar.page, "Toggle Probe");
		await expect(eventByTitle(calendar.page, "Toggle Probe")).toHaveClass(/batch-selected/);
		await expectSelectedCount(calendar.page, 1);

		await toggleEventInBatch(calendar.page, "Toggle Probe");
		await expect(eventByTitle(calendar.page, "Toggle Probe")).not.toHaveClass(/batch-selected/);
		await expectSelectedCount(calendar.page, 0);

		await exitBatchMode(calendar.page);
	});
});
