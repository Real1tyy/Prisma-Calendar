import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { ACTIVE_CALENDAR_LEAF } from "../../fixtures/constants";
import { todayStamp } from "../../fixtures/dates";
import type { CalendarHandle } from "../../fixtures/dsl/calendar";
import { expect, test } from "../../fixtures/electron";
import { enterMobileLayout, measureMobileOverflow } from "../../fixtures/viewport";

// Mobile discovery gallery: drive the REAL plugin in REAL Obsidian at a phone
// viewport, walk every major view, screenshot each, and measure horizontal
// overflow. The screenshots are the punch-list; the per-view "mounts without
// crashing at 390px" check is the smoke net.
//
// The view-tab strip overflow IS gated (it's fixed — see _tabbed-container.scss),
// so a regression that re-breaks tab navigation on mobile fails here. Per-view
// CONTENT overflow is still reported-not-gated: several views (split panes,
// gantt) are known to mislay out at phone width and are tracked in
// docs/specs/2026-05-22-mobile-responsiveness-findings-and-plan.md. As each is
// hardened, flip its content check from a report row to an assertion.

const SCREENSHOT_DIR = resolve(__dirname, "..", "..", "test-results", "mobile-gallery");

// One short settle after the viewport change: the calendar's resize handler is
// debounced, so the relayout to mobile lands a tick after the CDP override.
const RELAYOUT_SETTLE_MS = 400;
// Per-view paint settle before the screenshot so heavier views (split panes,
// dashboard grids, charts) have a frame to render — keeps the captured image
// honest rather than catching a mid-mount blank.
const VIEW_SETTLE_MS = 500;

interface GalleryView {
	name: string;
	open: (calendar: CalendarHandle) => Promise<void>;
}

// Calendar modes run first (they live on the calendar tab); leaf/group view
// tabs run after, since switching away from the calendar tab is one-way here.
const VIEWS: readonly GalleryView[] = [
	{ name: "calendar-week", open: (c) => c.switchMode("week") },
	{ name: "calendar-month", open: (c) => c.switchMode("month") },
	{ name: "timeline", open: (c) => c.switchView("timeline") },
	{ name: "heatmap", open: (c) => c.switchView("heatmap") },
	{ name: "gantt", open: (c) => c.switchView("gantt") },
	{ name: "dashboard-by-category", open: (c) => c.switchToGroupChild("dashboard", "dashboard-by-category") },
	{ name: "daily-stats", open: (c) => c.switchView("daily-stats") },
	{ name: "dual-daily", open: (c) => c.switchView("dual-daily") },
	{ name: "monthly-calendar-stats", open: (c) => c.switchView("monthly-calendar-stats") },
];

// Seeded so the content areas render real data instead of empty voids. Titles
// must be unique (seedAndStabilize writes `<title>.md` directly, no zettel
// suffix). Two categories give dashboard-by-category + stats real rows. All
// today-anchored so the today-defaulting views (week/timeline/stats/dashboard)
// show them on first paint.
const SEED_EVENTS = [
	{ title: "Team Meeting", startDate: todayStamp(9, 0), endDate: todayStamp(10, 0), category: "Work" },
	{ title: "Daily Standup", startDate: todayStamp(11, 0), endDate: todayStamp(12, 0), category: "Work" },
	{ title: "Workout", startDate: todayStamp(14, 0), endDate: todayStamp(15, 0), category: "Fitness" },
	{ title: "Project Planning", startDate: todayStamp(16, 0), endDate: todayStamp(17, 30), category: "Work" },
];

// The view-tab strip is shared across every view, so once it scrolls instead of
// clipping it stays reachable on all of them. A regression here re-breaks mobile
// navigation everywhere — hence this is the one dimension gated. A few px of
// overflow is fine as long as the strip can scroll it; the bug is non-scrollable
// overflow (tabs spill past the pane, unreachable).
const TAB_STRIP_TOLERANCE_PX = 2;

test.describe("cross-view: mobile gallery", () => {
	test("every view mounts and renders at a 390px phone viewport", async ({ calendar }, testInfo) => {
		const page = calendar.page;
		mkdirSync(SCREENSHOT_DIR, { recursive: true });

		await calendar.unlockPro();
		await calendar.seedAndStabilize(SEED_EVENTS);

		await enterMobileLayout(page);
		await page.waitForTimeout(RELAYOUT_SETTLE_MS);

		const leaf = page.locator(`${ACTIVE_CALENDAR_LEAF} .view-content`).first();
		const report: string[] = [];

		for (const view of VIEWS) {
			await view.open(calendar);
			// Smoke: the view actually mounted into the pane at phone width — a
			// view that throws on mobile fails here (a real bug, not a layout nit).
			await expect(leaf).toBeVisible();
			await page.waitForTimeout(VIEW_SETTLE_MS);

			const shot = await page.locator(ACTIVE_CALENDAR_LEAF).first().screenshot();
			writeFileSync(join(SCREENSHOT_DIR, `${view.name}.png`), shot);
			await testInfo.attach(`mobile-${view.name}`, { body: shot, contentType: "image/png" });

			const m = await measureMobileOverflow(page);
			// Gated: if the tabs overflow the strip, the strip must be scrollable —
			// otherwise tabs spill past the pane and become unreachable.
			const tabsReachable = !m || m.tabStripScrollable || m.tabStripOverflowPx <= TAB_STRIP_TOLERANCE_PX;
			expect(
				tabsReachable,
				`view "${view.name}": tab strip overflows by ${m?.tabStripOverflowPx ?? "?"}px and is not scrollable`
			).toBe(true);

			const contentFlag = m && m.viewContentPx > 1 ? `⚠ content +${m.viewContentPx}px` : "ok";
			report.push(`  ${view.name.padEnd(24)} pane=${String(m?.paneWidth ?? "?").padEnd(6)} ${contentFlag}`);
		}

		const table = `\n=== MOBILE GALLERY @ 390px — ${VIEWS.length} views ===\n${report.join("\n")}\n\nScreenshots: ${SCREENSHOT_DIR}\n`;
		console.log(table);
		await testInfo.attach("mobile-overflow-report.txt", { body: table, contentType: "text/plain" });
	});
});
