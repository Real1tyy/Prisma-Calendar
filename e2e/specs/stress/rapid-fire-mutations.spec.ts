import { test } from "../../fixtures/electron";
import { openCalendar, switchCalendarViewMode } from "../../fixtures/helpers";
import {
	clickBatchButton,
	confirmBatchAction,
	enterBatchMode,
	exitBatchMode,
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

// Rapid-fire mutations: exercise the RAF-coalesced refresh (`scheduleRefreshEvents`
// in calendar-view.ts) by firing multiple mutations back-to-back faster than
// the calendar can settle in between. The calendar must still converge to the
// correct final state even if intermediate refreshes land on inconsistent
// snapshots of the vault. This is exactly the scenario the user reported —
// "calendar doesn't refresh itself, stays stale" — scaled up.

const TOOLBAR_NEXT = sel(TID.toolbar("next"));
const TOOLBAR_PREV = sel(TID.toolbar("prev"));

test.describe.configure({ mode: "serial" });

test.describe("stress: rapid-fire mutations against coalesced refresh", () => {
	const EVENT_COUNT = 28;

	test("move-next → move-prev → move-next → undo × 3 converges to starting state", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;

		clearVaultSeedEvents(vaultDir);
		seedBulkEvents(vaultDir, EVENT_COUNT, {
			prefix: "Rapid",
			spreadDays: 7,
			startDayOffset: currentWeekStartOffset(),
		});
		await openCalendar(page);
		await refreshCalendar(page);
		await waitForEventCount(page, EVENT_COUNT);
		await switchCalendarViewMode(page, "week");
		await expectUniqueVisibleEventCount(page, EVENT_COUNT);

		// Three mutations in quick succession — each leaves the calendar
		// in a different state (next week, prev week, next week). The
		// refresh queue must serialize them without dropping events.
		await enterBatchMode(page);
		await clickBatchButton(page, "select-all");
		await clickBatchButton(page, "move-next");
		await exitBatchMode(page);

		await page.locator(TOOLBAR_NEXT).first().click();
		await enterBatchMode(page);
		await clickBatchButton(page, "select-all");
		await clickBatchButton(page, "move-prev");
		await exitBatchMode(page);
		await page.locator(TOOLBAR_PREV).first().click();

		// Source week has the events back.
		await expectUniqueVisibleEventCount(page, EVENT_COUNT);

		await enterBatchMode(page);
		await clickBatchButton(page, "select-all");
		await clickBatchButton(page, "move-next");
		await exitBatchMode(page);
		await expectUniqueVisibleEventCount(page, 0);

		// Three undos peel back: move-next → move-prev → move-next, landing
		// the events on their original start dates. At any intermediate step
		// a partially-applied undo would leave the calendar mid-drift.
		await undoViaPalette(page, 3);
		await expectCalendarConsistent(page, { indexer: EVENT_COUNT, visible: EVENT_COUNT });
	});

	test("delete → undo → delete → undo twice in a row keeps events in sync", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;

		clearVaultSeedEvents(vaultDir);
		seedBulkEvents(vaultDir, EVENT_COUNT, {
			prefix: "Twice",
			spreadDays: 7,
			startDayOffset: currentWeekStartOffset(),
		});
		await openCalendar(page);
		await refreshCalendar(page);
		await waitForEventCount(page, EVENT_COUNT);
		await switchCalendarViewMode(page, "week");
		await expectUniqueVisibleEventCount(page, EVENT_COUNT);

		for (let cycle = 0; cycle < 2; cycle++) {
			await enterBatchMode(page);
			await clickBatchButton(page, "select-all");
			await clickBatchButton(page, "delete");
			await confirmBatchAction(page);
			await exitBatchMode(page);
			await expectCalendarConsistent(page, { indexer: 0, visible: 0 });

			await undoViaPalette(page, 1);
			await expectCalendarConsistent(page, { indexer: EVENT_COUNT, visible: EVENT_COUNT });
		}
	});
});
