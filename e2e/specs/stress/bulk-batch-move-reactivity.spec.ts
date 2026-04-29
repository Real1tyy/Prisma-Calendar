import { expect, test } from "../../fixtures/electron";
import { openCalendar, switchCalendarViewMode } from "../../fixtures/helpers";
import { clickBatchButton, enterBatchMode, exitBatchMode, expectSelectedCount } from "../../fixtures/history-helpers";
import { refreshCalendar, waitForEventCount } from "../../fixtures/seed-events";
import {
	currentWeekStartOffset,
	expectCalendarConsistent,
	expectUniqueVisibleEventCount,
	seedBulkEvents,
	waitForIndexerToReach,
} from "../../fixtures/stress-helpers";
import { sel, TID } from "../../fixtures/testids";
import { listEventFiles } from "../events/events-helpers";

// Reproduces the "stale calendar after batch move" scenario the user reported:
// batch-select N events, move to another week, expect all N to disappear from
// the source week and re-appear in the target week. A reactivity regression
// leaves some stale events rendered in the source (diff misclassifies them as
// "unchanged"). The spec asserts the full lifecycle — disk state AND DOM state
// must both settle consistently.
//
// Week view is used throughout: list view disables batch selection entirely
// (see BatchSelectionManager.toggleSelectionMode). Events are distributed
// one-per-(day, hour) across the 7 days of the current week so no
// eventMaxStack / dayMaxEvents limit kicks in.

const TOOLBAR_NEXT = sel(TID.toolbar("next"));
const TOOLBAR_PREV = sel(TID.toolbar("prev"));

test.describe.configure({ mode: "serial" });

test.describe("stress: batch move reactivity", () => {
	// 4 events per day × 7 days = 28 events, each at a distinct (day, hour)
	// slot. Comfortably exceeds the 7-event user-reported batch size while
	// staying well under FullCalendar's default collapse thresholds.
	const EVENTS_PER_DAY = 4;
	const EVENT_COUNT = EVENTS_PER_DAY * 7;

	test("batch move-next empties the source week and fills the target week", async ({ obsidian }) => {
		test.slow();
		const { page, vaultDir } = obsidian;

		seedBulkEvents(vaultDir, EVENT_COUNT, {
			prefix: "Move",
			spreadDays: 7,
			startDayOffset: currentWeekStartOffset(),
		});
		await openCalendar(page);
		await refreshCalendar(page);
		await waitForEventCount(page, EVENT_COUNT);
		await switchCalendarViewMode(page, "week");

		// Every seeded event lives in the current week, so week view renders
		// every one. This is the baseline the move-next must invert.
		await expectUniqueVisibleEventCount(page, EVENT_COUNT);

		await enterBatchMode(page);
		await clickBatchButton(page, "select-all");
		await expectSelectedCount(page, EVENT_COUNT);

		await clickBatchButton(page, "move-next");
		await exitBatchMode(page);

		// Disk settles first: every file's Start Date now points at next week.
		// File count is unchanged (move doesn't create or delete files).
		await expect.poll(() => listEventFiles(vaultDir).length).toBe(EVENT_COUNT);

		// Source week must now be empty. This is the reactivity assertion:
		// a single event still rendered here means the calendar diff missed
		// a mutation and the user would have to manually refresh.
		await expectUniqueVisibleEventCount(page, 0);

		// Advance to the target week and verify every event re-appeared.
		await page.locator(TOOLBAR_NEXT).first().click();
		await expectUniqueVisibleEventCount(page, EVENT_COUNT);

		// Indexer count holds across navigation — the view just filters into
		// the new visible range.
		await waitForIndexerToReach(page, EVENT_COUNT);
	});

	test("batch move-next then move-prev returns every event to its original week", async ({ obsidian }) => {
		test.slow();
		const { page, vaultDir } = obsidian;

		seedBulkEvents(vaultDir, EVENT_COUNT, {
			prefix: "Round",
			spreadDays: 7,
			startDayOffset: currentWeekStartOffset(),
		});
		await openCalendar(page);
		await refreshCalendar(page);
		await waitForEventCount(page, EVENT_COUNT);
		await switchCalendarViewMode(page, "week");
		await expectUniqueVisibleEventCount(page, EVENT_COUNT);

		await enterBatchMode(page);
		await clickBatchButton(page, "select-all");
		await expectSelectedCount(page, EVENT_COUNT);
		await clickBatchButton(page, "move-next");
		await exitBatchMode(page);
		await expectUniqueVisibleEventCount(page, 0);

		// Navigate to next week, select everything again, move back.
		await page.locator(TOOLBAR_NEXT).first().click();
		await expectUniqueVisibleEventCount(page, EVENT_COUNT);

		await enterBatchMode(page);
		await clickBatchButton(page, "select-all");
		await expectSelectedCount(page, EVENT_COUNT);
		await clickBatchButton(page, "move-prev");
		await exitBatchMode(page);
		await expectUniqueVisibleEventCount(page, 0);

		// Back to the original week — every event must have re-rendered.
		await page.locator(TOOLBAR_PREV).first().click();
		await expectCalendarConsistent(page, { indexer: EVENT_COUNT, visible: EVENT_COUNT });
	});

	test("batch move-next on a partial selection moves only the selected events", async ({ obsidian }) => {
		test.slow();
		const { page, vaultDir } = obsidian;

		seedBulkEvents(vaultDir, EVENT_COUNT, {
			prefix: "Partial",
			spreadDays: 7,
			startDayOffset: currentWeekStartOffset(),
		});
		await openCalendar(page);
		await refreshCalendar(page);
		await waitForEventCount(page, EVENT_COUNT);
		await switchCalendarViewMode(page, "week");
		await expectUniqueVisibleEventCount(page, EVENT_COUNT);

		await enterBatchMode(page);

		// Click every odd-numbered event (half of them) by title. The exact
		// subset is not the point — what matters is the post-op view has
		// exactly the unselected half.
		const width = Math.max(3, String(EVENT_COUNT).length);
		const selectedTitles = Array.from(
			{ length: Math.floor(EVENT_COUNT / 2) },
			(_, i) => `Partial ${String(i * 2 + 1).padStart(width, "0")}`
		);
		for (const title of selectedTitles) {
			await page
				.locator(`.workspace-leaf.mod-active ${sel(TID.block)}[data-event-title="${title}"]`)
				.first()
				.click();
		}
		await expectSelectedCount(page, selectedTitles.length);

		await clickBatchButton(page, "move-next");
		await exitBatchMode(page);

		// Source week retains exactly the non-selected half.
		await expectUniqueVisibleEventCount(page, EVENT_COUNT - selectedTitles.length);

		// Target week now holds exactly the selected half.
		await page.locator(TOOLBAR_NEXT).first().click();
		await expectUniqueVisibleEventCount(page, selectedTitles.length);
	});
});
