import { isoLocal } from "../../fixtures/dates";
import { openBatch } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { expectEventsNotVisibleByTitle, expectEventsVisibleByTitle } from "../../fixtures/history-helpers";
import { sel, TID } from "../../fixtures/testids";
import { listEventFiles } from "../events/events-helpers";

// History bugs usually manifest in chains, not single actions. These specs
// walk heterogenous sequences — all via real UI (toolbar, context menu,
// edit modal, batch toolbar, palette) — and assert each step reverses
// under undo, checking both the file-on-disk and the calendar DOM.
//
// Note: the plugin's redo-of-create path regenerates the zettel-id suffix,
// so 4× undo followed by 4× redo cannot guarantee byte-for-byte path
// restoration (the edit / clone / delete commands in the redo chain look up
// the original filename). The specs here therefore assert 4× undo reaches
// baseline but only exercise redo where its inputs remain stable.

test.describe("undo/redo: multi-step chains (UI-driven)", () => {
	test("create → edit → duplicate → delete: 4x undo empties the vault", async ({ calendar }) => {
		const baseline = listEventFiles(calendar.vaultDir).length;

		// Step 1: Create A via toolbar.
		const alpha = await calendar.createEvent({
			title: "Chain Alpha",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		await expectEventsVisibleByTitle(calendar.page, ["Chain Alpha"]);

		// Step 2: Edit A's end time via context menu + modal.
		await alpha.edit({ end: isoLocal(1, 11) });

		// Step 3: Duplicate A via context menu.
		const beforeDup = listEventFiles(calendar.vaultDir).length;
		await alpha.rightClick("duplicateEvent");
		await calendar.expectEventCount(beforeDup + 1);
		await expect.poll(() => calendar.page.locator(`${sel(TID.block)}[data-event-title="Chain Alpha"]`).count()).toBe(2);
		const after = listEventFiles(calendar.vaultDir);
		const dupAbs = after.find((f) => !f.endsWith(`/${alpha.path}`));
		const dupPath = dupAbs!.slice(calendar.vaultDir.length + 1);

		// Step 4: Delete the duplicate. The two events share the "Chain Alpha"
		// title, so disambiguate via the path-stamped testid attribute.
		await calendar.page
			.locator(`${sel(TID.block)}[data-event-file-path="${dupPath}"]`)
			.first()
			.click({ button: "right" });
		await calendar.page
			.locator(sel(TID.ctxMenu("deleteEvent")))
			.first()
			.click();
		await expect.poll(() => listEventFiles(calendar.vaultDir).some((abs) => abs.endsWith(`/${dupPath}`))).toBe(false);
		// One "Chain Alpha" left in the DOM.
		await expect.poll(() => calendar.page.locator(`${sel(TID.block)}[data-event-title="Chain Alpha"]`).count()).toBe(1);

		// Undo 4× reverses in order: delete → duplicate → edit → create.
		await calendar.undo(4);
		await calendar.expectEventCount(baseline);
		await expectEventsNotVisibleByTitle(calendar.page, ["Chain Alpha"]);
	});

	test("undo 2 + redo 1 + undo 3: stack stays consistent across direction changes", async ({ calendar }) => {
		const baseline = listEventFiles(calendar.vaultDir).length;
		const alpha = await calendar.createEvent({
			title: "Step Alpha",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		await expectEventsVisibleByTitle(calendar.page, ["Step Alpha"]);

		await alpha.rightClick("markDone");
		await alpha.expectFrontmatter("Status", (v) => v === "Done");

		await alpha.rightClick("skipEvent");
		await alpha.expectFrontmatter("Skip", (v) => v === true);
		// Skip hides the event from the main calendar.
		await expectEventsNotVisibleByTitle(calendar.page, ["Step Alpha"]);

		// Undo 2: skip then mark-done.
		await calendar.undo(2);
		await alpha.expectFrontmatter("Skip", (v) => v === undefined || v === false);
		await alpha.expectFrontmatter("Status", (v) => v !== "Done");
		await expectEventsVisibleByTitle(calendar.page, ["Step Alpha"]);

		// Redo 1: re-apply mark-done.
		await calendar.redo(1);
		await alpha.expectFrontmatter("Status", (v) => v === "Done");
		await alpha.expectFrontmatter("Skip", (v) => v === undefined || v === false);
		await expectEventsVisibleByTitle(calendar.page, ["Step Alpha"]);

		// Undo 3: mark-done → create (file gone), stack consistent.
		await calendar.undo(3);
		await alpha.expectExists(false);
		await calendar.expectEventCount(baseline);
		await expectEventsNotVisibleByTitle(calendar.page, ["Step Alpha"]);
	});

	test("heterogenous ops (edit modal × batch × context menu) chain cleanly under undo", async ({ calendar }) => {
		const alice = await calendar.createEvent({
			title: "Alice Sync",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		const bob = await calendar.createEvent({
			title: "Bob Sync",
			start: isoLocal(1, 11),
			end: isoLocal(1, 12),
		});
		await expectEventsVisibleByTitle(calendar.page, ["Alice Sync", "Bob Sync"]);

		// Order matters: Prisma hides skipped events from the calendar, so skip must
		// come *last* — otherwise later clicks can't find the hidden event. Undo
		// stacks still exercise the heterogenous-op chain the same way in reverse.

		// 1: Batch mark-done on both via toolbar.
		const batch = await openBatch(calendar.page, [alice, bob]);
		await batch.do("mark-done");
		await alice.expectFrontmatter("Status", (v) => v === "Done");
		await bob.expectFrontmatter("Status", (v) => v === "Done");
		await batch.exit();

		// 2: Edit-modal bump of B's end time.
		await bob.edit({ end: isoLocal(1, 14) });

		// 3: Context-menu skip on A (hides it from the view — that's fine, nothing
		// after this clicks on Alice).
		await alice.rightClick("skipEvent");
		await alice.expectFrontmatter("Skip", (v) => v === true);
		await expectEventsNotVisibleByTitle(calendar.page, ["Alice Sync"]);
		await expectEventsVisibleByTitle(calendar.page, ["Bob Sync"]);

		// Undo 3× reverses everything: skip → edit → batch mark-done.
		await calendar.undo(3);
		await alice.expectFrontmatter("Skip", (v) => v === undefined || v === false);
		await alice.expectFrontmatter("Status", (v) => v !== "Done");
		await bob.expectFrontmatter("Status", (v) => v !== "Done");
		await expectEventsVisibleByTitle(calendar.page, ["Alice Sync", "Bob Sync"]);
	});
});
