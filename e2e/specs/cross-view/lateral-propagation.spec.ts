import { expect } from "@playwright/test";

import { todayISO, todayStamp } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import { sel, TIMELINE_CONTAINER_TID } from "../../fixtures/testids";

// The existing cross-view specs all originate mutations in the **calendar
// tab** (right-click context menu) and assert downstream views. This spec
// covers the two propagation paths that the calendar-originating specs miss:
//
//   1. A mutation issued through **batch mode** — a separate command surface
//      (BatchDeleteCommand) — must reach every non-calendar view, not just
//      the calendar surface that batch-stress already proves.
//   2. Opening an **events-list modal from the global page-header** and
//      drilling into the EventSeriesModal must surface the live events
//      observed by the dashboard. A subscription regression that leaves the
//      modal reading stale state would silently desync the panel.
//
// Together they prove the RxJS chain wakes the non-calendar consumers
// regardless of which mutation surface originated the change.

const CATEGORY = "Lateral";
const KEEP_TITLES = ["Lateral Keep One", "Lateral Keep Two"] as const;
const DROP_TITLES = ["Lateral Drop One", "Lateral Drop Two"] as const;

test.describe("cross-view: lateral propagation paths", () => {
	test("batch delete updates dashboard, timeline, heatmap and event count in lockstep", async ({ calendar }) => {
		await calendar.unlockPro();

		// Seed via the vault API so the dashboard + heatmap reactive trackers
		// observe the new files (writeFileSync would bypass the metadata cache).
		await calendar.seedAndStabilize([
			{ title: KEEP_TITLES[0], startDate: todayStamp(8, 0), endDate: todayStamp(9, 0), category: CATEGORY },
			{ title: KEEP_TITLES[1], startDate: todayStamp(10, 0), endDate: todayStamp(11, 0), category: CATEGORY },
			{ title: DROP_TITLES[0], startDate: todayStamp(13, 0), endDate: todayStamp(14, 0), category: CATEGORY },
			{ title: DROP_TITLES[1], startDate: todayStamp(15, 0), endDate: todayStamp(16, 0), category: CATEGORY },
		]);

		// Dashboard-by-category surfaces every event sharing the "Lateral"
		// category — `dashboard-by-name` filters to series with 2+ events and
		// would hide the unique-titled rows.
		const expectViews = async ({
			present,
			absent = [],
			heatmapCount,
		}: {
			present: readonly string[];
			absent?: readonly string[];
			heatmapCount: number;
		}) => {
			await calendar.switchView("timeline");
			for (const title of present) await calendar.expectTimelineItem(title);
			for (const title of absent) await calendar.expectTimelineItem(title, false);

			await calendar.switchView("heatmap");
			await calendar.expectHeatmapCount(todayISO(), heatmapCount);

			await calendar.expectDashboardItem("dashboard-by-category", CATEGORY);
		};

		await calendar.switchMode("week");
		await calendar.eventByTitle(DROP_TITLES[0]).then((e) => e.expectVisible());

		await expectViews({ present: [...KEEP_TITLES, ...DROP_TITLES], heatmapCount: 4 });

		// Issue the mutation through batch mode — different command path than
		// the context-menu single-delete that other cross-view specs use.
		await calendar.switchView("calendar");
		const drops = await Promise.all(DROP_TITLES.map((t) => calendar.eventByTitle(t)));
		const batch = await calendar.batch(drops);
		await batch.do("delete");
		await batch.confirm();
		await batch.exit();
		await calendar.expectEventCount(2);

		await expectViews({ present: KEEP_TITLES, absent: DROP_TITLES, heatmapCount: 2 });
	});

	test("events modal opens from a non-calendar tab and lists every category seeded into the bundle", async ({
		calendar,
	}) => {
		const page = calendar.page;
		await calendar.unlockPro();

		// Two distinct categories so the byCategory tab shows two groups.
		await calendar.seedAndStabilize([
			{ title: "Lateral Modal Alpha", startDate: todayStamp(9, 0), endDate: todayStamp(10, 0), category: "AlphaCat" },
			{
				title: "Lateral Modal Alpha 2",
				startDate: todayStamp(11, 0),
				endDate: todayStamp(12, 0),
				category: "AlphaCat",
			},
			{ title: "Lateral Modal Beta", startDate: todayStamp(13, 0), endDate: todayStamp(14, 0), category: "BetaCat" },
			{ title: "Lateral Modal Beta 2", startDate: todayStamp(15, 0), endDate: todayStamp(16, 0), category: "BetaCat" },
		]);

		// Switch to a non-calendar tab so the events-modal trigger has to work
		// from a leaf state where the calendar tab isn't active.
		await calendar.switchView("timeline");

		// Open the events modal from the page header. Toolbar sits above the
		// tab container, so the trigger must work regardless of the active tab.
		const events = await calendar.openEventsModal();
		await events.switchTab("byCategory");

		// Both categories surface with the correct counts.
		await expect(events.groupItem("AlphaCat")).toBeVisible();
		await expect(events.groupItem("BetaCat")).toBeVisible();
		await expect(events.groupItem("AlphaCat").locator(".prisma-generic-event-subtitle")).toHaveText("2 events");
		await expect(events.groupItem("BetaCat").locator(".prisma-generic-event-subtitle")).toHaveText("2 events");

		// Drilling into a group surfaces the live event rows.
		const series = await events.drillInto("AlphaCat");
		await series.expectRowCount(2);

		// Close all modals and assert the timeline tab is still mounted — the
		// modal open + drill cycle didn't tear down its subscriber.
		await page.keyboard.press("Escape");
		await page.keyboard.press("Escape");
		await expect(page.locator(sel(TIMELINE_CONTAINER_TID)).first()).toBeVisible();
	});
});
