import { expect, test } from "../../fixtures/electron";
import { openCalendar, switchCalendarViewMode } from "../../fixtures/helpers";
import {
	clickBatchButton,
	confirmBatchAction,
	enterBatchMode,
	exitBatchMode,
	redoViaPalette,
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
import { listEventFiles } from "../events/events-helpers";

// A batch-delete on many events, followed by undo and redo, exercises the
// full lifecycle: N file removals, notifier cascade, DOM rebatch, then the
// reverse. At any transition the rendered count must converge to what the
// indexer reports — never leaving orphan events in the DOM after delete or
// missing events after undo. List view keeps each event as a single visible
// row so the DOM count matches disk count exactly within the current week.

test.describe.configure({ mode: "serial" });

test.describe("stress: batch delete undo/redo", () => {
	// 7 days × 7 events = 49 events, one per hour slot per day — all distinct,
	// no stacking. Comfortably exceeds the 7-event user-reported batch size.
	const EVENTS_PER_DAY = 7;
	const EVENT_COUNT = EVENTS_PER_DAY * 7;

	test("batch delete clears the calendar and undo restores every event", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;

		clearVaultSeedEvents(vaultDir);
		seedBulkEvents(vaultDir, EVENT_COUNT, {
			prefix: "Del",
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
		await clickBatchButton(page, "delete");
		await confirmBatchAction(page);

		// Disk settles first: every file removed.
		await expect.poll(() => listEventFiles(vaultDir).length).toBe(0);
		// Indexer + DOM both drop to zero — a single event still rendered
		// means the delete flow skipped a refresh notification somewhere.
		await expectCalendarConsistent(page, { indexer: 0, visible: 0 });
		await exitBatchMode(page);

		// Undo restores every file atomically. If partial undo is a bug we have
		// to assert both on-disk and in-DOM counts return to EVENT_COUNT.
		await undoViaPalette(page, 1);
		await expect.poll(() => listEventFiles(vaultDir).length).toBe(EVENT_COUNT);
		await expectCalendarConsistent(page, { indexer: EVENT_COUNT, visible: EVENT_COUNT });

		// Redo re-deletes every file in a single macro.
		await redoViaPalette(page, 1);
		await expect.poll(() => listEventFiles(vaultDir).length).toBe(0);
		await expectCalendarConsistent(page, { indexer: 0, visible: 0 });
	});

	test("chained move+undo cycles under load keep the DOM eventually consistent", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;

		clearVaultSeedEvents(vaultDir);
		seedBulkEvents(vaultDir, EVENT_COUNT, {
			prefix: "Chain",
			spreadDays: 7,
			startDayOffset: currentWeekStartOffset(),
		});
		await openCalendar(page);
		await refreshCalendar(page);
		await waitForEventCount(page, EVENT_COUNT);
		await switchCalendarViewMode(page, "week");
		await expectUniqueVisibleEventCount(page, EVENT_COUNT);

		// Sequence: move-next (empties week) → undo (restores) → move-next →
		// undo. Each transition asserts consistency; the cumulative effect
		// must land back at the starting state.
		await enterBatchMode(page);
		await clickBatchButton(page, "select-all");
		await clickBatchButton(page, "move-next");
		await exitBatchMode(page);
		await expectUniqueVisibleEventCount(page, 0);

		await undoViaPalette(page, 1);
		await expectCalendarConsistent(page, { indexer: EVENT_COUNT, visible: EVENT_COUNT });

		await enterBatchMode(page);
		await clickBatchButton(page, "select-all");
		await clickBatchButton(page, "move-next");
		await exitBatchMode(page);
		await expectUniqueVisibleEventCount(page, 0);

		await undoViaPalette(page, 1);
		await expectUniqueVisibleEventCount(page, EVENT_COUNT);

		// Indexer count never drifted — move + undo + move + undo never lose events.
		await expectCalendarConsistent(page, { indexer: EVENT_COUNT, visible: EVENT_COUNT });
	});
});
