import { expect } from "@playwright/test";

import { todayStamp } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import { updateCalendarSettings } from "../../fixtures/seed-events";
import { EVENT_BLOCK_TID, HEATMAP_CELL_TID, sel, STATS_EMPTY_TID, TIMELINE_ITEM_CLASS } from "../../fixtures/testids";

// `empty-state-across-views.spec.ts` proves every view renders cleanly
// when the vault has zero events. The harder empty-state is "calendar
// points at a missing or empty directory" — first-launch users land
// there if they configure the plugin against a fresh path. A regression
// where the renderer chokes on a missing directory would crash the
// first session for every new user.
//
// This spec:
//   1. Seeds events in the default `Events/` directory.
//   2. Repoints the calendar to a non-existent directory via settings.
//   3. Refreshes and asserts: no crash, no console errors (the harness
//      enforces this on teardown), and the rendered views surface the
//      empty placeholders rather than the original events.

test.describe("cross-view: empty state when calendar directory is missing", () => {
	test("repointing the calendar to a non-existent directory empties every view without crashing", async ({
		calendar,
	}) => {
		const page = calendar.page;

		// Seed two events under the default `Events/` dir so the indexer has
		// real rows in scope before the redirect.
		await calendar.seedMany([
			{ title: "Reroute One", start: todayStamp(9, 0), end: todayStamp(10, 0) },
			{ title: "Reroute Two", start: todayStamp(11, 0), end: todayStamp(12, 0) },
		]);

		await calendar.switchView("timeline");
		await calendar.expectTimelineItem("Reroute One");
		await calendar.expectTimelineItem("Reroute Two");

		// Repoint the bundle's `directory` to a path that does not exist on disk.
		// The indexer scans the configured directory; with no matching folder,
		// the event store should empty out without throwing.
		await updateCalendarSettings(page, { directory: "Nonexistent/Path/Does/Not/Exist" });

		// Timeline empties — the events live in the old directory which the
		// indexer no longer scans.
		await expect.poll(async () => page.locator(TIMELINE_ITEM_CLASS).count()).toBe(0);

		// Calendar view: no event tiles render.
		await calendar.switchView("calendar");
		await expect(page.locator(sel(EVENT_BLOCK_TID))).toHaveCount(0);

		// Daily stats: empty placeholder visible.
		await calendar.switchView("daily-stats");
		await expect(page.locator(sel(STATS_EMPTY_TID)).first()).toBeVisible();

		// Heatmap (Pro): every cell is at zero count.
		await calendar.unlockPro();
		await calendar.switchView("heatmap");
		await expect(page.locator(`${sel(HEATMAP_CELL_TID)}:not([data-count="0"])`)).toHaveCount(0);

		// Repoint back — the original events should reappear because the
		// indexer re-scans without losing prior on-disk state. Catches a
		// regression where the empty-pointer transition tears down subscribers
		// that don't re-attach on the next valid directory.
		await updateCalendarSettings(page, { directory: "Events" });
		await calendar.switchView("timeline");
		await calendar.expectTimelineItem("Reroute One");
		await calendar.expectTimelineItem("Reroute Two");
	});
});
