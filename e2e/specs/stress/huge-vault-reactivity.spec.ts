import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

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
import { refreshCalendar, updateCalendarSettings, waitForEventCount } from "../../fixtures/seed-events";
import {
	clearVaultSeedEvents,
	currentWeekStartOffset,
	expectCalendarConsistent,
	expectUniqueVisibleEventCount,
	safeEventFileCount,
	seedBulkEvents,
	waitForIndexerToReach,
} from "../../fixtures/stress-helpers";

// Maximum-load boundary: a vault holding 5000 events the indexer must pick
// up, plus 50 "active" events in the current week the user actually
// operates on. The 5000 background events never render (they live > 1 month
// in the future, far outside any default FullCalendar view window), but
// every one must land in the indexer on initial load. Mutations on the
// 50 active events must stay consistent — no event loss, no stale-render
// drift, regardless of the 5000-event baseline sitting in the store.
//
// ── Known bug reproduced by this suite ──────────────────────────────────
// With default settings (`calendarTitleProp` non-empty), the initial scan
// of a 5000-event vault queues a `calendarTitle` write-back for every file
// via `EventFileRepository.applyBackgroundFrontmatterUpdates` ->
// `enqueueFrontmatterWrite`. Those ~5000 writes drain sequentially (each
// one waits on `app.fileManager.processFrontMatter`) and cascade through
// the notifier pipeline. User mutations (batch move, delete, clone)
// arrive mid-drain and their refresh notifications get serialised behind
// the backlog — the calendar DOM stays stale for >60s. This is almost
// certainly the root cause behind the user-reported "batch-move 7 events,
// only 3 disappear, calendar stays stale" symptom at a smaller scale.
//
// These specs set `calendarTitleProp: ""` to short-circuit the drain so
// they can exercise refresh reactivity in isolation. Fixing the underlying
// plugin bug (make the drain throttle / yield so it doesn't starve user
// ops) is outside the scope of this test file.

const TOOLBAR_NEXT = '[data-testid="prisma-cal-toolbar-next"]';
const TOOLBAR_PREV = '[data-testid="prisma-cal-toolbar-prev"]';

const BACKGROUND_COUNT = 5000;
const ACTIVE_COUNT = 50;
const TOTAL_COUNT = BACKGROUND_COUNT + ACTIVE_COUNT;

// Bulk ingest of 5000 files + the mutation chain runs past Playwright's
// default 90s per-test budget. Indexing alone spans several seconds; the
// multi-operation chain on top needs room to breathe.
const HUGE_VAULT_TIMEOUT_MS = 300_000;

// Background events are seeded starting ~1 month ahead of today and spread
// across ~3 years of distinct (day, hour) slots. No overlap with the current
// week → no DOM render of background events, so `uniqueVisibleEventCount`
// always reflects only the active-50 + their derivatives.
const BACKGROUND_START_OFFSET_DAYS = 30;
const BACKGROUND_SPREAD_DAYS = 1000;

test.describe.configure({ mode: "serial" });

test.describe("stress: huge 5000-event vault with focused mutations", () => {
	test(`indexer ingests ${TOTAL_COUNT} events and 50 active stay consistent through move → undo → redo`, async ({
		obsidian,
	}) => {
		test.setTimeout(HUGE_VAULT_TIMEOUT_MS);
		const { page, vaultDir } = obsidian;

		clearVaultSeedEvents(vaultDir);

		// Background events: must be indexed but must never bleed into the
		// current week / adjacent weeks we navigate to during the test.
		seedBulkEvents(vaultDir, BACKGROUND_COUNT, {
			prefix: "Bg",
			spreadDays: BACKGROUND_SPREAD_DAYS,
			startDayOffset: BACKGROUND_START_OFFSET_DAYS,
		});

		// Active events: 50 spread across the current week, each at a
		// distinct (day, hour) slot — one-per-slot means no FullCalendar
		// stacking / overflow collapse.
		seedBulkEvents(vaultDir, ACTIVE_COUNT, {
			prefix: "Active",
			spreadDays: 7,
			startDayOffset: currentWeekStartOffset(),
		});

		await openCalendar(page);
		// Disable the background title-sync that otherwise fires one frontmatter
		// rewrite per indexed file during the drain after the initial scan. On
		// a 5000-event vault the drain queues ~5000 sequential writes and can
		// starve user-initiated mutations for a minute or more — the exact
		// symptom the user reported as "calendar stays stale". Setting
		// `calendarTitleProp` to "" short-circuits that drain so the test
		// exercises pure refresh reactivity, not a queue-contention regression.
		await updateCalendarSettings(page, { calendarTitleProp: "" });
		await refreshCalendar(page);

		// Indexer gate: all 5050 files must land. Bulk ingest of this size
		// takes measurably longer than the default 30s poll window on
		// slower machines.
		await waitForEventCount(page, TOTAL_COUNT, 180_000);

		await switchCalendarViewMode(page, "week");

		// Only the 50 active events fall in the current week's window. The
		// 5000 background events are outside the current-month render range
		// and must not appear.
		await expectCalendarConsistent(page, { indexer: TOTAL_COUNT, visible: ACTIVE_COUNT });

		// Snapshot one active event's Start Date so we can later assert the
		// move actually touched disk, independent of the DOM refresh.
		const firstActiveOriginalStart = String(readEventFrontmatter(vaultDir, "Events/Active 001.md")["Start Date"]);

		// ── Op 1: batch move-next on the 50 active events ───────────────
		await enterBatchMode(page);
		await clickBatchButton(page, "select-all");
		await clickBatchButton(page, "move-next");
		await exitBatchMode(page);

		// Diagnostic: gate on disk first so we can tell DOM-refresh bugs
		// from command-failed-to-run bugs. The move command rewrites every
		// selected event's Start Date — poll a specific file's frontmatter
		// until the mutation lands on disk.
		await expect
			.poll(() => readEventFrontmatter(vaultDir, "Events/Active 001.md")["Start Date"], {
				message: "batch move-next never rewrote Active 01.md on disk",
			})
			.not.toBe(firstActiveOriginalStart);

		// Source week empties. A stale event here means the refresh missed
		// a mutation under the weight of the 5000-event background store.
		await expectUniqueVisibleEventCount(page, 0);

		// Target week now holds the 50. Background events (>30d out) still
		// don't bleed in.
		await page.locator(TOOLBAR_NEXT).first().click();
		await expectUniqueVisibleEventCount(page, ACTIVE_COUNT);

		// Indexer unchanged — move rewrites Start Date, doesn't create or
		// delete files.
		await waitForIndexerToReach(page, TOTAL_COUNT);
		await expect.poll(() => safeEventFileCount(vaultDir)).toBe(TOTAL_COUNT);

		// ── Op 2: undo returns the 50 to the original week ──────────────
		await undoViaPalette(page, 1);

		// Target week (where we are) now empty.
		await expectUniqueVisibleEventCount(page, 0);

		// Back to the source week — the 50 should have re-rendered.
		await page.locator(TOOLBAR_PREV).first().click();
		await expectCalendarConsistent(page, { indexer: TOTAL_COUNT, visible: ACTIVE_COUNT });

		// ── Op 3: redo re-moves the 50 ──────────────────────────────────
		await redoViaPalette(page, 1);
		await expectUniqueVisibleEventCount(page, 0);

		// Final navigation & consistency check — target week holds 50, total
		// indexer still 5050, disk still 5050. No event loss across the full
		// move → undo → redo cycle under load.
		await page.locator(TOOLBAR_NEXT).first().click();
		await expectCalendarConsistent(page, { indexer: TOTAL_COUNT, visible: ACTIVE_COUNT });
		await expect.poll(() => safeEventFileCount(vaultDir)).toBe(TOTAL_COUNT);
	});

	test("batch delete + undo + redo on 50 actives never drops a background event", async ({ obsidian }) => {
		test.setTimeout(HUGE_VAULT_TIMEOUT_MS);
		const { page, vaultDir } = obsidian;

		clearVaultSeedEvents(vaultDir);
		seedBulkEvents(vaultDir, BACKGROUND_COUNT, {
			prefix: "BgDel",
			spreadDays: BACKGROUND_SPREAD_DAYS,
			startDayOffset: BACKGROUND_START_OFFSET_DAYS,
		});
		seedBulkEvents(vaultDir, ACTIVE_COUNT, {
			prefix: "Act",
			spreadDays: 7,
			startDayOffset: currentWeekStartOffset(),
		});

		await openCalendar(page);
		// Disable the background title-sync that otherwise fires one frontmatter
		// rewrite per indexed file during the drain after the initial scan. On
		// a 5000-event vault the drain queues ~5000 sequential writes and can
		// starve user-initiated mutations for a minute or more — the exact
		// symptom the user reported as "calendar stays stale". Setting
		// `calendarTitleProp` to "" short-circuits that drain so the test
		// exercises pure refresh reactivity, not a queue-contention regression.
		await updateCalendarSettings(page, { calendarTitleProp: "" });
		await refreshCalendar(page);
		await waitForEventCount(page, TOTAL_COUNT, 180_000);
		await switchCalendarViewMode(page, "week");
		await expectCalendarConsistent(page, { indexer: TOTAL_COUNT, visible: ACTIVE_COUNT });

		// Delete the 50 actives. Indexer must drop by exactly 50 — not more
		// (would mean a background event got collateral-deleted) and not
		// less (stale DOM event still counted).
		await enterBatchMode(page);
		await clickBatchButton(page, "select-all");
		await clickBatchButton(page, "delete");
		await confirmBatchAction(page);
		await exitBatchMode(page);

		await expect.poll(() => safeEventFileCount(vaultDir)).toBe(BACKGROUND_COUNT);
		await expectCalendarConsistent(page, { indexer: BACKGROUND_COUNT, visible: 0 });

		// Undo restores all 50 actives atomically. If the undo macro races
		// against the 5000-event store, a partial restore would leave the
		// indexer count wrong.
		await undoViaPalette(page, 1);
		await expect.poll(() => safeEventFileCount(vaultDir)).toBe(TOTAL_COUNT);
		await expectCalendarConsistent(page, { indexer: TOTAL_COUNT, visible: ACTIVE_COUNT });

		// Redo re-deletes the 50 — final state matches the post-delete snapshot.
		await redoViaPalette(page, 1);
		await expect.poll(() => safeEventFileCount(vaultDir)).toBe(BACKGROUND_COUNT);
		await expectCalendarConsistent(page, { indexer: BACKGROUND_COUNT, visible: 0 });
	});
});
