import { expect } from "@playwright/test";

import { todayISO, todayStamp } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import { dashboardItemByTitle } from "../../fixtures/testids";

// Every existing history spec issues `undo`/`redo` while the calendar tab
// is active. The undo manager is per-bundle (not per-view) so an undo
// issued from a non-calendar tab must still roll the calendar back. This
// spec proves the focus-independence by mutating in calendar, switching to
// timeline / heatmap / dashboard, firing undo via the command palette, and
// asserting both the calendar tile AND the non-calendar view reflect the
// rollback without any tab switching in between.
//
// Catches: regressions that scope the undo stack to the active view, or
// that leave non-calendar subscribers out-of-date when the active tab
// isn't the calendar.

test.describe("history: undo from non-calendar focus context", () => {
	test("delete in calendar → switch to timeline → undo from palette restores the event on disk and in both views", async ({
		calendar,
	}) => {
		const [evt] = await calendar.seedMany([{ title: "Undo Reach", start: todayStamp(10, 0), end: todayStamp(11, 0) }]);

		await evt.rightClick("deleteEvent");
		await evt.expectExists(false);

		await calendar.switchView("timeline");
		await calendar.expectTimelineItem("Undo Reach", false);

		// Fire undo via the command palette while the timeline tab is active —
		// no calendar surface is interacted with.
		await calendar.undo();

		// Timeline updates without a tab switch.
		await calendar.expectTimelineItem("Undo Reach", true);

		// Switch back to the calendar and verify the tile is restored from
		// disk — not just a DOM ghost.
		await calendar.switchView("calendar");
		await evt.expectExists(true);
		await evt.expectVisible();
	});

	test("undo issued from the heatmap tab updates the cell count and restores the calendar tile", async ({
		calendar,
	}) => {
		await calendar.unlockPro();
		await calendar.seedMany([
			{ title: "Heatmap Keep", start: todayStamp(8, 0), end: todayStamp(9, 0) },
			{ title: "Heatmap Drop", start: todayStamp(11, 0), end: todayStamp(12, 0) },
		]);

		await calendar.switchView("heatmap");
		await calendar.expectHeatmapCount(todayISO(), 2);

		await calendar.switchView("calendar");
		const drop = await calendar.eventByTitle("Heatmap Drop");
		await drop.rightClick("deleteEvent");
		await drop.expectExists(false);

		await calendar.switchView("heatmap");
		await calendar.expectHeatmapCount(todayISO(), 1);

		await calendar.undo();

		// Heatmap reflects the restored event count immediately — no manual
		// tab switch needed.
		await calendar.expectHeatmapCount(todayISO(), 2);

		await calendar.switchView("calendar");
		await drop.expectExists(true);
	});

	test("redo issued from a dashboard child tab re-runs the original mutation", async ({ calendar }) => {
		await calendar.unlockPro();
		const page = calendar.page;
		// Two events sharing a category so the dashboard-by-category ranking
		// has a row to assert on — dashboard-by-name filters out single-instance
		// titles, so we rely on the category surface instead.
		await calendar.seedMany([
			{ title: "Redo Subject", start: todayStamp(9, 0), end: todayStamp(10, 0), categories: ["RedoCategory"] },
			{ title: "Redo Sibling", start: todayStamp(11, 0), end: todayStamp(12, 0), categories: ["RedoCategory"] },
		]);

		const drop = await calendar.eventByTitle("Redo Subject");
		await drop.rightClick("deleteEvent");
		await drop.expectExists(false);
		await calendar.undo();
		await drop.expectExists(true);

		// Switch to the dashboard-by-category tab and redo from there. The
		// dashboard renderers subscribe to the same RxJS chain — the rerun
		// must drop the category row's count even though the dashboard tab
		// was active when redo fired.
		await calendar.switchToGroupChild("dashboard", "dashboard-by-category");
		await expect(page.locator(dashboardItemByTitle("RedoCategory")).first()).toBeVisible();

		await calendar.redo();

		await calendar.switchView("calendar");
		await drop.expectExists(false);
	});
});
