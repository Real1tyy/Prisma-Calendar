import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import { openCalendar, switchCalendarViewMode } from "../../fixtures/helpers";
import {
	clickBatchButton,
	enterBatchMode,
	exitBatchMode,
	expectSelectedCount,
	undoViaPalette,
} from "../../fixtures/history-helpers";
import { refreshCalendar, waitForEventCount } from "../../fixtures/seed-events";
import {
	clearVaultSeedEvents,
	currentWeekStartOffset,
	expectCalendarConsistent,
	expectUniqueVisibleEventCount,
	seedBulkEvents,
} from "../../fixtures/stress-helpers";
import { sel, TID } from "../../fixtures/testids";
import { listEventFiles } from "../events/events-helpers";

// Skip and clone are the remaining user-reported stress paths. Skip writes a
// single frontmatter key per file but flips visibility for every affected
// event simultaneously; clone doubles the event set in one macro. Both must
// preserve consistency between indexer and DOM.

test.describe.configure({ mode: "serial" });

test.describe("stress: batch skip + batch clone reactivity", () => {
	const EVENT_COUNT = 35;

	test("batch skip hides every selected event and undo makes them all visible again", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;

		clearVaultSeedEvents(vaultDir);
		seedBulkEvents(vaultDir, EVENT_COUNT, {
			prefix: "Skip",
			spreadDays: 7,
			startDayOffset: currentWeekStartOffset(),
		});
		await openCalendar(page);
		await refreshCalendar(page);
		await waitForEventCount(page, EVENT_COUNT);
		await switchCalendarViewMode(page, "week");
		await expectCalendarConsistent(page, { indexer: EVENT_COUNT, visible: EVENT_COUNT });

		await enterBatchMode(page);
		await clickBatchButton(page, "select-all");
		await expectSelectedCount(page, EVENT_COUNT);
		await clickBatchButton(page, "skip");
		await exitBatchMode(page);

		// Skip writes `Skip: true` to disk but the files stick around. The
		// calendar hides skipped events by default, so the visible count
		// drops to zero while disk and indexer stay at EVENT_COUNT.
		await expect.poll(() => listEventFiles(vaultDir).length).toBe(EVENT_COUNT);
		await expectCalendarConsistent(page, { indexer: EVENT_COUNT, visible: 0 });

		// Sample a few files to confirm the frontmatter actually wrote.
		const samplePaths = listEventFiles(vaultDir).slice(0, 5);
		for (const absolutePath of samplePaths) {
			const relative = absolutePath.slice(vaultDir.length + 1);
			expect(readEventFrontmatter(vaultDir, relative)["Skip"], relative).toBe(true);
		}

		// Undo returns every event to an un-skipped state atomically. A single
		// stale-hidden event means the refresh after undo left a gap.
		await undoViaPalette(page, 1);
		await expectCalendarConsistent(page, { indexer: EVENT_COUNT, visible: EVENT_COUNT });
	});

	test("batch clone-next doubles the rendered set across source + target weeks", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;

		const startingCount = 21;
		clearVaultSeedEvents(vaultDir);
		seedBulkEvents(vaultDir, startingCount, {
			prefix: "Clone",
			spreadDays: 7,
			startDayOffset: currentWeekStartOffset(),
		});
		await openCalendar(page);
		await refreshCalendar(page);
		await waitForEventCount(page, startingCount);
		await switchCalendarViewMode(page, "week");
		await expectCalendarConsistent(page, { indexer: startingCount, visible: startingCount });

		await enterBatchMode(page);
		await clickBatchButton(page, "select-all");
		await expectSelectedCount(page, startingCount);
		await clickBatchButton(page, "clone-next");
		await exitBatchMode(page);

		// Disk count doubles: N originals + N clones.
		await expect.poll(() => listEventFiles(vaultDir).length).toBe(startingCount * 2);
		// Source week still shows the originals (not the clones).
		await expectCalendarConsistent(page, { indexer: startingCount * 2, visible: startingCount });

		await page
			.locator(sel(TID.toolbar("next")))
			.first()
			.click();
		// Target week now shows the clones.
		await expectUniqueVisibleEventCount(page, startingCount);

		// Undo the clone — removes the N new files in a single macro. Indexer
		// + DOM drop back to the original set.
		await undoViaPalette(page, 1);
		await expect.poll(() => listEventFiles(vaultDir).length).toBe(startingCount);
		// Target week is now empty (clones gone).
		await expectUniqueVisibleEventCount(page, 0);
		await page
			.locator(sel(TID.toolbar("prev")))
			.first()
			.click();
		await expectCalendarConsistent(page, { indexer: startingCount, visible: startingCount });
	});
});
