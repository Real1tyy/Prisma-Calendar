import { expect, test } from "../../fixtures/electron";
import {
	batchCounter,
	clickBatchButton,
	createEventViaToolbar,
	enterBatchMode,
	eventByTitle,
	exitBatchMode,
	expectSelectedCount,
	isoLocal,
	toggleEventInBatch,
	waitForBatchSelectable,
} from "../../fixtures/history-helpers";
import { openCalendarReady } from "../events/events-helpers";

// Selection-state commands don't mutate events — they only flip UI state.
// These specs verify that clicking the batch toolbar button enters selection
// mode, that "All" / "Clear" fire across every visible event, and that single
// clicks toggle selection. Each assertion checks BOTH the counter ("N
// selected") and the aggregate class count — a regression that drifts one
// without the other is exactly the kind of partial failure these catch.

test.describe("batch selection (UI-driven)", () => {
	test.beforeEach(async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
	});

	test("toolbar batch-select button enters selection mode and exits on Exit click", async ({ obsidian }) => {
		await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Batch Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await enterBatchMode(obsidian.page);
		await expect(batchCounter(obsidian.page)).toBeVisible();
		await expectSelectedCount(obsidian.page, 0);

		await exitBatchMode(obsidian.page);
		await expect(batchCounter(obsidian.page)).toBeHidden();
	});

	test("Select All / Clear batch buttons populate and empty the selection", async ({ obsidian }) => {
		const titles = ["Alice", "Bob", "Charlie"];
		for (const [i, title] of titles.entries()) {
			await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
				title,
				start: isoLocal(1, 9 + i),
				end: isoLocal(1, 10 + i),
			});
		}

		await enterBatchMode(obsidian.page);
		// Guard against the last-created event racing with its mount callback:
		// Select All iterates `calendar.getEvents()` and only selects events
		// that are already file-backed AND have their DOM mount data attached.
		// Wait for every title to be classed `batch-selectable` before firing.
		await waitForBatchSelectable(obsidian.page, titles);
		await expectSelectedCount(obsidian.page, 0);

		// Count every batch-selectable event (our 3 + any seeded into the vault)
		// so the counter assertion survives a richer seed.
		const batchSelectableTotal = await obsidian.page
			.locator('.workspace-leaf.mod-active [data-testid="prisma-cal-event"].prisma-batch-selectable')
			.count();

		await clickBatchButton(obsidian.page, "select-all");
		for (const title of titles) {
			await expect(eventByTitle(obsidian.page, title)).toHaveClass(/batch-selected/);
		}
		await expectSelectedCount(obsidian.page, batchSelectableTotal);

		await clickBatchButton(obsidian.page, "clear");
		for (const title of titles) {
			await expect(eventByTitle(obsidian.page, title)).not.toHaveClass(/batch-selected/);
		}
		await expectSelectedCount(obsidian.page, 0);

		await exitBatchMode(obsidian.page);
	});

	test("clicking an event while in batch mode toggles its selection", async ({ obsidian }) => {
		await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Toggle Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await enterBatchMode(obsidian.page);
		await expectSelectedCount(obsidian.page, 0);

		await toggleEventInBatch(obsidian.page, "Toggle Probe");
		await expect(eventByTitle(obsidian.page, "Toggle Probe")).toHaveClass(/batch-selected/);
		await expectSelectedCount(obsidian.page, 1);

		await toggleEventInBatch(obsidian.page, "Toggle Probe");
		await expect(eventByTitle(obsidian.page, "Toggle Probe")).not.toHaveClass(/batch-selected/);
		await expectSelectedCount(obsidian.page, 0);

		await exitBatchMode(obsidian.page);
	});
});
