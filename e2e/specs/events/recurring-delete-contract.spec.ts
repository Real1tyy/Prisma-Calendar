import { existsSync } from "node:fs";
import { join } from "node:path";

import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expectConfirmationModal } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { expectFrontmatterFieldsUnchanged } from "../../fixtures/frontmatter-assertions";
import { eventBlockByFilePath, physicalInstanceBlock, rightClickBlockMenu } from "./events-helpers";
import { collectInstanceDates, setupWeeklyRecurringAtNextMonth } from "./robustness-helpers";

// Recurring delete contract (event-context-menu.ts:838-857). Prisma's UI
// does not present a three-way "this / this & future / all" picker like
// Apple/Google calendars. Instead:
//   • Deleting a single PHYSICAL instance file just removes that file —
//     the source and other physicals are untouched.
//   • Deleting the SOURCE when physicals exist opens a confirmation modal
//     ("Delete associated events?"). The source is ALWAYS deleted; the
//     modal only governs whether the physical instances go with it.
//
// Three branches matter, and each has a user-visible failure mode if it
// regresses:
//   1. Single-instance delete must not cascade into the source.
//   2. Source-delete + Confirm: physicals + source all gone.
//   3. Source-delete + Cancel: physicals KEPT (orphaned), source still gone.
// Plus skip semantics — toggling skip on a physical instance writes the
// `Skip` frontmatter without deleting anything.

const RECURRING_DELETE_MODAL_PREFIX = "prisma-delete-recurring-";

test.describe("recurring delete contract", () => {
	test("deleting a single physical instance leaves source and the other physical untouched", async ({ obsidian }) => {
		const { sourcePath, expectedDates } = await setupWeeklyRecurringAtNextMonth(obsidian, "Delete Phys One");

		// Locate the source+7 physical block, capture its file path before delete.
		const targetBlock = physicalInstanceBlock(obsidian.page, "Delete Phys One", expectedDates[0]);
		await expect(targetBlock).toBeVisible();
		const targetFilePath = (await targetBlock.getAttribute("data-event-file-path"))!;

		const sourceBefore = readEventFrontmatter(obsidian.vaultDir, sourcePath);

		await rightClickBlockMenu(targetBlock, obsidian.page, "deleteEvent");

		// Single physical-instance delete on a non-source file does NOT open
		// the recurring-delete modal — it's just a regular file deletion.
		// File goes; source & sibling untouched.
		await expect.poll(() => existsSync(join(obsidian.vaultDir, targetFilePath))).toBe(false);

		expectFrontmatterFieldsUnchanged(obsidian.vaultDir, sourcePath, sourceBefore);

		// Sibling physical (source+14) still present.
		const siblingDates = collectInstanceDates(obsidian.vaultDir, "Delete Phys One");
		expect(siblingDates).toContain(expectedDates[1]);
		expect(siblingDates).not.toContain(expectedDates[0]);
	});

	test("deleting the source + confirming the modal removes physicals and source", async ({ obsidian }) => {
		const { sourcePath } = await setupWeeklyRecurringAtNextMonth(obsidian, "Delete Source Confirm");

		const sourceBlock = eventBlockByFilePath(obsidian.page, "Delete Source Confirm", sourcePath);
		await expect(sourceBlock).toBeVisible();
		await rightClickBlockMenu(sourceBlock, obsidian.page, "deleteEvent");

		const modal = await expectConfirmationModal(obsidian.page, { testIdPrefix: RECURRING_DELETE_MODAL_PREFIX });
		await modal.confirm();

		// Source file gone, both physicals gone.
		await expect.poll(() => existsSync(join(obsidian.vaultDir, sourcePath))).toBe(false);
		await expect.poll(() => collectInstanceDates(obsidian.vaultDir, "Delete Source Confirm")).toEqual([]);
	});

	test("deleting the source + cancelling the modal still deletes the source but keeps physicals", async ({
		obsidian,
	}) => {
		const { sourcePath, expectedDates } = await setupWeeklyRecurringAtNextMonth(obsidian, "Delete Source Cancel");

		const sourceBlock = eventBlockByFilePath(obsidian.page, "Delete Source Cancel", sourcePath);
		await expect(sourceBlock).toBeVisible();
		await rightClickBlockMenu(sourceBlock, obsidian.page, "deleteEvent");

		// Per event-context-menu.ts:846-855 the source is STILL deleted
		// (onComplete runs unconditionally); the modal only governs whether
		// the physical instances follow.
		const modal = await expectConfirmationModal(obsidian.page, { testIdPrefix: RECURRING_DELETE_MODAL_PREFIX });
		await modal.cancel();

		await expect.poll(() => existsSync(join(obsidian.vaultDir, sourcePath))).toBe(false);

		// Physicals must remain on disk — orphans now (no source rule to
		// regenerate them, but the existing files persist).
		expect(collectInstanceDates(obsidian.vaultDir, "Delete Source Cancel")).toEqual(expectedDates);
	});
});
