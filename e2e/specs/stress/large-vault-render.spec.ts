import { test } from "../../fixtures/electron";
import { openCalendar, switchCalendarViewMode } from "../../fixtures/helpers";
import { refreshCalendar, waitForEventCount } from "../../fixtures/seed-events";
import {
	clearVaultSeedEvents,
	currentWeekStartOffset,
	expectCalendarConsistent,
	expectUniqueVisibleEventCount,
	seedBulkEvents,
	waitForIndexerToReach,
} from "../../fixtures/stress-helpers";

// A pre-seeded vault the plugin must ingest on boot. Large-vault scenarios
// exercise the initial-load path (`performInitialLoad`, not the incremental
// diff) and the indexer's ability to surface every file before the first user
// interaction. The target isn't 1000 events for its own sake — it's proving
// the initial render doesn't silently drop events under ingest pressure.
//
// listWeek view is used because it renders one DOM row per event in the
// current week with no stacking — counts are exact.

const EVENTS_PER_DAY = 5;
const SPREAD_DAYS = 28;
const TOTAL_COUNT = EVENTS_PER_DAY * SPREAD_DAYS;

test.describe.configure({ mode: "serial" });

test.describe("stress: large vault initial render", () => {
	test(`${TOTAL_COUNT} pre-seeded events all land in the indexer and list view matches the visible week`, async ({
		obsidian,
	}) => {
		test.slow();
		const { page, vaultDir } = obsidian;

		clearVaultSeedEvents(vaultDir);

		// Anchor spread to the current week's Sunday and extend 4 weeks
		// forward so 5 of the 28 days fall within the current-week listView
		// window. That yields 7 * EVENTS_PER_DAY = 35 events in view — a
		// deterministic target the test can assert against.
		seedBulkEvents(vaultDir, TOTAL_COUNT, {
			prefix: "Seeded",
			spreadDays: SPREAD_DAYS,
			startDayOffset: currentWeekStartOffset(),
		});

		await openCalendar(page);
		await refreshCalendar(page);
		// Gate on the indexer catching up — bulk ingest of 140+ events runs
		// longer than the default 500ms refresh settle.
		await waitForEventCount(page, TOTAL_COUNT);

		await switchCalendarViewMode(page, "list");
		await expectCalendarConsistent(page, { indexer: TOTAL_COUNT, visible: 7 * EVENTS_PER_DAY });

		// Indexer doesn't change across view switches — a drop here would
		// mean the view change torched part of the cache.
		await switchCalendarViewMode(page, "day");
		await waitForIndexerToReach(page, TOTAL_COUNT);

		// Day view shows only today's slice (EVENTS_PER_DAY events). Events
		// seeded for the other 27 days of the spread are filtered out.
		await expectUniqueVisibleEventCount(page, EVENTS_PER_DAY);
	});
});
