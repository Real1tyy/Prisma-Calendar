import { listEventFiles } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import {
	clickBatchButton,
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
import { openCalendarReady, rightClickEventMenu } from "../events/events-helpers";
import { fillEventModal, saveEventModal } from "../events/fill-event-modal";

// History bugs usually manifest in chains, not single actions. These specs
// walk heterogenous sequences — all via real UI (toolbar, context menu,
// edit modal, batch toolbar, palette) — and assert each step reverses
// under undo.
//
// Note: the plugin's redo-of-create path regenerates the zettel-id suffix,
// so 4× undo followed by 4× redo cannot guarantee byte-for-byte path
// restoration (the edit / clone / delete commands in the redo chain look up
// the original filename). The specs here therefore assert 4× undo reaches
// baseline but only exercise redo where its inputs remain stable.

test.describe("undo/redo: multi-step chains (UI-driven)", () => {
	test.beforeEach(async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
	});

	test("create → edit → duplicate → delete: 4x undo empties the vault", async ({ obsidian }) => {
		const baseline = listEventFiles(obsidian.vaultDir).length;

		// Step 1: Create A via toolbar.
		const pathA = await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Chain Alpha",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		// Step 2: Edit A's end time via context menu + modal.
		await rightClickEventMenu(obsidian.page, "Chain Alpha", "editEvent");
		await fillEventModal(obsidian.page, { end: isoLocal(1, 11) });
		await saveEventModal(obsidian.page);

		// Step 3: Duplicate A via context menu.
		const beforeDup = listEventFiles(obsidian.vaultDir).length;
		await rightClickEventMenu(obsidian.page, "Chain Alpha", "duplicateEvent");
		await waitForEventFileCount(obsidian.vaultDir, beforeDup + 1);
		const after = listEventFiles(obsidian.vaultDir);
		const dupAbs = after.find((f) => !f.endsWith(`/${pathA}`));
		const dupPath = dupAbs!.slice(obsidian.vaultDir.length + 1);

		// Step 4: Delete the duplicate. The two events share the "Chain Alpha"
		// title, so disambiguate via the path-stamped testid attribute.
		await obsidian.page
			.locator(`[data-testid="prisma-cal-event"][data-event-file-path="${dupPath}"]`)
			.first()
			.click({ button: "right" });
		await obsidian.page.locator('[data-testid="prisma-context-menu-item-deleteEvent"]').first().click();
		await waitForFileExists(obsidian.vaultDir, dupPath, false);

		// Undo 4× reverses in order: delete → duplicate → edit → create.
		await undoViaPalette(obsidian.page, 4);
		await expect.poll(() => listEventFiles(obsidian.vaultDir).length).toBe(baseline);
	});

	test("undo 2 + redo 1 + undo 3: stack stays consistent across direction changes", async ({ obsidian }) => {
		const baseline = listEventFiles(obsidian.vaultDir).length;
		const pathA = await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Step Alpha",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await rightClickEventMenu(obsidian.page, "Step Alpha", "markDone");
		await waitForFrontmatter(obsidian.vaultDir, pathA, "Status", (v) => v === "Done");

		await rightClickEventMenu(obsidian.page, "Step Alpha", "skipEvent");
		await waitForFrontmatter(obsidian.vaultDir, pathA, "Skip", (v) => v === true);

		// Undo 2: skip then mark-done.
		await undoViaPalette(obsidian.page, 2);
		await waitForFrontmatter(obsidian.vaultDir, pathA, "Skip", (v) => v === undefined || v === false);
		await waitForFrontmatter(obsidian.vaultDir, pathA, "Status", (v) => v !== "Done");

		// Redo 1: re-apply mark-done.
		await redoViaPalette(obsidian.page, 1);
		await waitForFrontmatter(obsidian.vaultDir, pathA, "Status", (v) => v === "Done");
		await waitForFrontmatter(obsidian.vaultDir, pathA, "Skip", (v) => v === undefined || v === false);

		// Undo 3: mark-done → create (file gone), stack consistent.
		await undoViaPalette(obsidian.page, 3);
		await waitForFileExists(obsidian.vaultDir, pathA, false);
		await expect.poll(() => listEventFiles(obsidian.vaultDir).length).toBe(baseline);
	});

	test("heterogenous ops (edit modal × batch × context menu) chain cleanly under undo", async ({ obsidian }) => {
		const pathA = await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Alice Sync",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		const pathB = await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Bob Sync",
			start: isoLocal(1, 11),
			end: isoLocal(1, 12),
		});

		// Order matters: Prisma hides skipped events from the calendar, so skip must
		// come *last* — otherwise later clicks can't find the hidden event. Undo
		// stacks still exercise the heterogenous-op chain the same way in reverse.

		// 1: Batch mark-done on both via toolbar.
		await enterBatchMode(obsidian.page);
		await toggleEventInBatch(obsidian.page, "Alice Sync");
		await toggleEventInBatch(obsidian.page, "Bob Sync");
		await clickBatchButton(obsidian.page, "mark-done");
		await waitForFrontmatter(obsidian.vaultDir, pathA, "Status", (v) => v === "Done");
		await waitForFrontmatter(obsidian.vaultDir, pathB, "Status", (v) => v === "Done");
		await exitBatchMode(obsidian.page);

		// 2: Edit-modal bump of B's end time.
		await rightClickEventMenu(obsidian.page, "Bob Sync", "editEvent");
		await fillEventModal(obsidian.page, { end: isoLocal(1, 14) });
		await saveEventModal(obsidian.page);

		// 3: Context-menu skip on A (hides it from the view — that's fine, nothing
		// after this clicks on Alice).
		await rightClickEventMenu(obsidian.page, "Alice Sync", "skipEvent");
		await waitForFrontmatter(obsidian.vaultDir, pathA, "Skip", (v) => v === true);

		// Undo 3× reverses everything: skip → edit → batch mark-done.
		await undoViaPalette(obsidian.page, 3);
		await waitForFrontmatter(obsidian.vaultDir, pathA, "Skip", (v) => v === undefined || v === false);
		await waitForFrontmatter(obsidian.vaultDir, pathA, "Status", (v) => v !== "Done");
		await waitForFrontmatter(obsidian.vaultDir, pathB, "Status", (v) => v !== "Done");
	});
});
