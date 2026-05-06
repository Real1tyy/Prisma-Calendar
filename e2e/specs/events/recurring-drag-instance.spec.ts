import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { dragByDelta } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { expectFrontmatterFieldsUnchanged } from "../../fixtures/frontmatter-assertions";
import { physicalInstanceBlock } from "./events-helpers";
import {
	collectInstanceDates,
	collectInstanceFiles,
	revealVirtualInstance,
	setupWeeklyRecurringAtNextMonth,
} from "./robustness-helpers";

// Recurring events render two kinds of blocks:
//   • Physical instances — real `.md` files, one per occurrence the plugin
//     materialises (default `futureInstancesCount=2`). Each carries its own
//     Start/End Date frontmatter.
//   • Virtual instances — projected occurrences with no backing file.
//
// The drag contract (calendar-view.ts:1888) is asymmetric:
//   • Dragging a physical instance is a normal file mutation. Its frontmatter
//     gets rewritten; the source and the OTHER physical instance are untouched.
//   • Dragging a virtual instance is rejected — `handleEventUpdate` calls
//     `info.revert()` when `getVirtualKind(event)` reports virtual, leaving
//     the rendered block snapped back to its original day.
//
// This spec locks the contract in. Regressions on either branch (e.g.,
// dragging a physical instance accidentally rewriting the SOURCE, or virtual
// drags suddenly persisting somewhere) are user-visible bugs.

test.describe("recurring events: drag of physical and virtual instances", () => {
	test("dragging a physical instance rewrites only that instance's frontmatter", async ({ calendar, obsidian }) => {
		const { sourcePath, expectedDates } = await setupWeeklyRecurringAtNextMonth(obsidian, "Drag Phys");

		// Frontmatter snapshot of the SOURCE — used at the end to prove it was untouched.
		const sourceBefore = readEventFrontmatter(obsidian.vaultDir, sourcePath);

		// Locate the physical instance at source+7. Disambiguates from the
		// source block (same title) by file path containing the instance date.
		const physicalBlock = physicalInstanceBlock(obsidian.page, "Drag Phys", expectedDates[0]);
		await expect(physicalBlock).toBeVisible();
		const physicalFilePath = (await physicalBlock.getAttribute("data-event-file-path"))!;
		const physicalBefore = readEventFrontmatter(obsidian.vaultDir, physicalFilePath);

		// Snapshot the OTHER physical instance (source+14) — it must stay byte-
		// identical after the drag.
		const otherBlock = physicalInstanceBlock(obsidian.page, "Drag Phys", expectedDates[1]);
		const otherFilePath = (await otherBlock.getAttribute("data-event-file-path"))!;
		const otherBefore = readEventFrontmatter(obsidian.vaultDir, otherFilePath);

		// `jitter` is required for FC event-block drags — see dsl/drag.ts:36.
		await dragByDelta(calendar.page, physicalBlock, 0, 200, { mode: "jitter" });

		// `renameInstanceFileIfNeeded` rewrites the file basename to embed the new
		// instance date and rewrites Start Date in frontmatter. Poll because the
		// drag → write → rename chain is async; the dropped file is the instance
		// file that's not `otherFilePath`.
		await expect
			.poll(() => {
				const files = collectInstanceFiles(obsidian.vaultDir, "Drag Phys");
				if (files.length !== 2) return null;
				const dropped = files.find((p) => !p.endsWith(otherFilePath));
				if (!dropped) return null;
				const rel = dropped.slice(obsidian.vaultDir.length + 1);
				return String(readEventFrontmatter(obsidian.vaultDir, rel)["Start Date"]);
			})
			.not.toBe(String(physicalBefore["Start Date"]));

		expectFrontmatterFieldsUnchanged(obsidian.vaultDir, sourcePath, sourceBefore);
		expectFrontmatterFieldsUnchanged(obsidian.vaultDir, otherFilePath, otherBefore);
	});

	test("dragging a virtual instance is reverted — no file appears, no source mutation", async ({
		calendar,
		obsidian,
	}) => {
		const { sourcePath, expectedDates } = await setupWeeklyRecurringAtNextMonth(obsidian, "Drag Virt");

		const sourceBefore = readEventFrontmatter(obsidian.vaultDir, sourcePath);
		const physicalCountBefore = expectedDates.length;

		// Virtual instances start at source+21 and continue weekly — may sit
		// past the rendered month. `revealVirtualInstance` advances the view
		// forward until at least one virtual block is painted.
		const virtualBlock = await revealVirtualInstance(obsidian, "Drag Virt");
		await dragByDelta(calendar.page, virtualBlock, 0, 200, { mode: "jitter" });

		// Source frontmatter must be unchanged (revert path doesn't write).
		expectFrontmatterFieldsUnchanged(obsidian.vaultDir, sourcePath, sourceBefore);

		// And no NEW physical instance got created from the drag.
		expect(collectInstanceDates(obsidian.vaultDir, "Drag Virt")).toHaveLength(physicalCountBefore);
	});
});
