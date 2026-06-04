import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { ACTIVE_CALENDAR_LEAF } from "../../fixtures/constants";
import { todayStamp } from "../../fixtures/dates";
import type { CalendarHandle } from "../../fixtures/dsl/calendar";
import { expect, test } from "../../fixtures/electron";
import {
	enterMobileLayout,
	measureHeatmapScroll,
	measureMobileOverflow,
	type HeatmapScroll,
	type MobileOverflow,
} from "../../fixtures/viewport";

// Mobile gallery: drive the REAL plugin in REAL Obsidian at a phone viewport,
// walk every major view, screenshot each, and GATE the layout invariants — every
// view-tab stays reachable within the pane, no view overflows horizontally, and the
// heatmap's wide yearly grid renders full-width + scrollable with its start
// reachable. The per-view "mounts without crashing at 390px" check is the smoke
// net; the screenshots are the review punch-list.
//
// These hold because the tab bar renders inline in the content pane on mobile
// instead of Obsidian's fixed-height header (§6.0), the grid views stack into a
// single scrollable column (§6.1), and the heatmap SVG keeps its intrinsic width
// instead of being shrink-clipped (§6.3). A regression that re-breaks any of them
// fails here. See docs/specs/2026-05-22-mobile-responsiveness-findings-and-plan.md.

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

// REACHABILITY, not scrollability: a tab cropped outside the pane is unreachable
// for a real user. We measure by bounding rect at the resting scroll position
// because Playwright's click() auto-scrolls a cropped tab into view — so a
// click-based test would pass while a human still can't reach the tab. The 2px
// tolerance absorbs sub-pixel rounding / borders.
const TAB_REACH_TOLERANCE_PX = 2;
// A view's content must not extend past the pane horizontally (1px absorbs
// rounding). Vertical scroll is expected and fine; horizontal scroll is the bug.
const CONTENT_OVERFLOW_TOLERANCE_PX = 1;
// The yearly heatmap grid's start (January) must sit within its scroll container
// at rest — `> tolerance` means it's stranded off the left, unreachable.
const HEATMAP_START_TOLERANCE_PX = 2;
// The grid SVG must render at (within rounding of) its intrinsic content width —
// rendering narrower means a max-width cap shrank-and-clipped the trailing months.
const HEATMAP_WIDTH_TOLERANCE_PX = 2;

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
		const measurements: { name: string; overflow: MobileOverflow | null }[] = [];
		let heatmap: HeatmapScroll | null = null;

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
			measurements.push({ name: view.name, overflow: m });
			if (view.name === "heatmap") heatmap = await measureHeatmapScroll(page);

			const tabFlag =
				m && m.tabCroppedPx > TAB_REACH_TOLERANCE_PX ? `⚠ TAB CROPPED +${m.tabCroppedPx}px (unreachable)` : "tabs ok";
			const contentFlag =
				m && m.viewContentPx > CONTENT_OVERFLOW_TOLERANCE_PX ? `⚠ content +${m.viewContentPx}px` : "content ok";
			report.push(
				`  ${view.name.padEnd(22)} pane=${String(m?.paneWidth ?? "?").padEnd(5)} ${tabFlag.padEnd(34)} ${contentFlag}`
			);
		}

		// Emit the diagnostic table first, so a gate failure below still ships the
		// full per-view picture (+ screenshots) for the post-mortem.
		const heatmapLine = heatmap
			? `\nheatmap grid: content=${heatmap.contentWidth}px rendered=${heatmap.renderedWidth}px client=${heatmap.clientWidth}px scrollable=${heatmap.scrollable} startClipped=${heatmap.startClippedPx}px`
			: "\nheatmap grid: (not measured)";
		const table = `\n=== MOBILE GALLERY @ 390px — ${VIEWS.length} views ===\n${report.join("\n")}${heatmapLine}\n\nScreenshots: ${SCREENSHOT_DIR}\n`;
		console.log(table);
		await testInfo.attach("mobile-overflow-report.txt", { body: table, contentType: "text/plain" });

		// The yearly grid is wider than a phone, so every month is reachable only if:
		// (1) the SVG renders at its full intrinsic width — a `max-width` cap that
		// shrinks it hard-clips the trailing months (no viewBox = no scroll to reach
		// them); (2) its container scrolls that overflow; (3) the start (January) sits
		// within the container at rest (`center` strands it off the left).
		expect(heatmap, "heatmap grid container not found").not.toBeNull();
		if (heatmap) {
			expect(
				heatmap.renderedWidth,
				`heatmap grid rendered ${heatmap.renderedWidth}px but its content is ${heatmap.contentWidth}px — trailing months are clipped`
			).toBeGreaterThanOrEqual(heatmap.contentWidth - HEATMAP_WIDTH_TOLERANCE_PX);
			expect(heatmap.scrollable, "heatmap grid overflow is not scrollable").toBe(true);
			expect(
				heatmap.startClippedPx,
				`heatmap grid starts ${heatmap.startClippedPx}px off the left edge (January unreachable)`
			).toBeLessThanOrEqual(HEATMAP_START_TOLERANCE_PX);
		}

		for (const { name, overflow } of measurements) {
			if (!overflow) {
				expect(overflow, `view "${name}": pane not found — could not measure layout`).not.toBeNull();
				continue;
			}
			expect(
				overflow.tabCroppedPx,
				`view "${name}": ${overflow.tabCroppedPx}px of view-tabs sit outside the pane (unreachable on touch)`
			).toBeLessThanOrEqual(TAB_REACH_TOLERANCE_PX);
			expect(
				overflow.viewContentPx,
				`view "${name}": content overflows the pane horizontally by ${overflow.viewContentPx}px`
			).toBeLessThanOrEqual(CONTENT_OVERFLOW_TOLERANCE_PX);
		}
	});
});
