import type { Page } from "@playwright/test";

import { ACTIVE_CALENDAR_LEAF } from "./constants";

/** A typical phone portrait viewport (iPhone-class logical px). */
export const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

interface ObsidianSplit {
	collapse?: () => void;
}
interface ObsidianAppWindow {
	app?: { workspace?: { leftSplit?: ObsidianSplit; rightSplit?: ObsidianSplit } };
}

/**
 * Put the renderer into a phone layout.
 *
 * Playwright's `page.setViewportSize` is a no-op against a CDP-connected
 * Electron page, so we drive the renderer's reported metrics directly via
 * `Emulation.setDeviceMetricsOverride`. That shrinks `window.innerWidth`, which
 * makes both `shouldUseMobileLayout` (JS) and every `@media (width<=…)` rule
 * (CSS) activate against the *real* plugin. Then collapse both sidebars so the
 * plugin pane fills the device width the way it does on an actual phone (where
 * Obsidian auto-collapses them).
 */
export async function enterMobileLayout(
	page: Page,
	size: { width: number; height: number } = MOBILE_VIEWPORT
): Promise<void> {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("Emulation.setDeviceMetricsOverride", {
		width: size.width,
		height: size.height,
		deviceScaleFactor: 1,
		mobile: false,
		screenWidth: size.width,
		screenHeight: size.height,
	});
	await page.evaluate(() => {
		const w = window as unknown as ObsidianAppWindow;
		w.app?.workspace?.leftSplit?.collapse?.();
		w.app?.workspace?.rightSplit?.collapse?.();
	});
}

export interface MobileOverflow {
	/** Pane width (px). */
	paneWidth: number;
	/** Horizontal overflow of the `.view-content` scroll box. */
	viewContentPx: number;
	/**
	 * The largest px any view-tab extends beyond the pane's edges (left or right).
	 * `> 0` means at least one tab is cropped — laid out outside the visible pane,
	 * so a real user can't see or tap it. This is measured by bounding rect at the
	 * RESTING scroll position, deliberately: Playwright's `click()` auto-scrolls a
	 * cropped tab into view, so a "scrollable" strip passes a click test while a
	 * human still can't reach the tab. Wrapping keeps every tab within the pane, so
	 * this stays 0. See docs/specs/2026-05-22-mobile-responsiveness-findings-and-plan.md.
	 */
	tabCroppedPx: number;
	/** Number of view-tabs found in the strip (sanity: a real strip has several). */
	tabCount: number;
	/**
	 * Px the toolbar's "Search events…" filter input extends beyond the pane's right
	 * (or left) edge, or `null` if this view has no filter bar. `> 0` means the
	 * search is laid out off-screen — the toolbar clipped it with `overflow: hidden`
	 * instead of wrapping it onto its own row. Same resting-rect rationale as
	 * `tabCroppedPx`. Timeline / Heatmap / Gantt render the filter bar, so a toolbar
	 * that stops wrapping re-breaks here.
	 */
	filterSearchCroppedPx: number | null;
	/**
	 * Px the page-header "Manage" button extends beyond the pane edges, or `null` if
	 * it isn't rendered. `> 0` means the header actions overflowed and pushed Manage
	 * off-screen — unreachable. The action bar trims to what fits and keeps Manage,
	 * so this stays 0 even with more actions configured than fit at phone width.
	 */
	headerManageCroppedPx: number | null;
}

/**
 * Measure the mobile-layout symptoms that matter on a phone: the pane content
 * escaping its scroll box, and any view-tab cropped outside the visible pane
 * (unreachable without programmatic scroll).
 */
export async function measureMobileOverflow(page: Page): Promise<MobileOverflow | null> {
	return page.evaluate((leafSelector) => {
		const leaf = document.querySelector(leafSelector);
		if (!leaf) return null;
		const paneRect = leaf.getBoundingClientRect();

		const content = leaf.querySelector(".view-content");
		const viewContentPx = content ? Math.max(0, content.scrollWidth - content.clientWidth) : 0;

		const tabs = Array.from(leaf.querySelectorAll('[data-testid^="prisma-view-tab-"]'));
		let tabCroppedPx = 0;
		for (const t of tabs) {
			const r = t.getBoundingClientRect();
			tabCroppedPx = Math.max(tabCroppedPx, r.right - paneRect.right, paneRect.left - r.left);
		}

		// Inactive view tabs stay mounted (hidden) in the same leaf, so there can be
		// several "prisma-filter-search" inputs; measure the one that's actually
		// displayed (the active view's). A search with a 0×0 rect is hidden and
		// skipped — that covers both inactive tabs and the calendar toolbar, which
		// intentionally collapses its filter controls behind a "Filters" toggle on
		// mobile. `null` therefore means "no visible search here" (calendar / split /
		// dashboard views); Timeline / Heatmap / Gantt show it inline and get measured.
		const searches = Array.from(leaf.querySelectorAll('[data-testid="prisma-filter-search"]'));
		let filterSearchCroppedPx: number | null = null;
		for (const s of searches) {
			const r = s.getBoundingClientRect();
			if (r.width > 0 && r.height > 0) {
				filterSearchCroppedPx = Math.max(0, Math.round(Math.max(r.right - paneRect.right, paneRect.left - r.left)));
				break;
			}
		}

		const manage = leaf.querySelector('[data-testid="prisma-page-header-manage"]');
		const manageRect = manage?.getBoundingClientRect();
		const headerManageCroppedPx =
			manageRect && manageRect.width > 0 && manageRect.height > 0
				? Math.max(0, Math.round(Math.max(manageRect.right - paneRect.right, paneRect.left - manageRect.left)))
				: null;

		return {
			paneWidth: Math.round(paneRect.width),
			viewContentPx,
			tabCroppedPx: Math.max(0, Math.round(tabCroppedPx)),
			tabCount: tabs.length,
			filterSearchCroppedPx,
			headerManageCroppedPx,
		};
	}, ACTIVE_CALENDAR_LEAF);
}

export interface HeatmapScroll {
	/**
	 * The grid SVG's intrinsic width (its `width` attribute) — the full extent the
	 * 12 months are drawn to. The reference the rendered width must match.
	 */
	contentWidth: number;
	/**
	 * The SVG's actually-rendered width. `< contentWidth` means a `max-width` cap
	 * (Obsidian's global `svg { max-width: 100% }`) shrank the element below its
	 * content — and since there's no viewBox, the trailing months are hard-clipped
	 * with no scroll to reach them. Must equal `contentWidth`.
	 */
	renderedWidth: number;
	/** Visible width of the scroll container. */
	clientWidth: number;
	/** Computed `overflow-x` is `auto`/`scroll` — i.e. any overflow is scrollable. */
	scrollable: boolean;
	/**
	 * Px the grid's left edge sits OUTSIDE the container at the resting scroll
	 * position. `> 0` means the start (January) is stranded off the left with no way
	 * back — `scrollLeft` can't go negative, so `justify-content: center` on an
	 * overflowing grid clips the first months. `safe center`/`flex-start` anchors them.
	 */
	startClippedPx: number;
}

/**
 * Measure whether the heatmap's yearly grid is reachable on a phone. `.view-content`
 * overflow can't see this — the grid clips inside its own scroll container — so this
 * inspects that container (the `.prisma-heatmap-container` scroll box) and the SVG.
 */
export async function measureHeatmapScroll(page: Page): Promise<HeatmapScroll | null> {
	return page.evaluate((leafSelector) => {
		const leaf = document.querySelector(leafSelector);
		const container = leaf?.querySelector('[data-testid="prisma-heatmap-container"]') as HTMLElement | null;
		const svg = container?.querySelector("svg");
		if (!container || !svg) return null;

		const cRect = container.getBoundingClientRect();
		const svgRect = svg.getBoundingClientRect();
		const overflowX = getComputedStyle(container).overflowX;

		return {
			contentWidth: Math.round(parseFloat(svg.getAttribute("width") ?? "0")),
			renderedWidth: Math.round(svgRect.width),
			clientWidth: Math.round(container.clientWidth),
			scrollable: overflowX === "auto" || overflowX === "scroll",
			startClippedPx: Math.max(0, Math.round(cRect.left - svgRect.left)),
		};
	}, ACTIVE_CALENDAR_LEAF);
}

export interface StatsChartReach {
	/** Whether a visible distribution-chart container was found in this view. */
	found: boolean;
	/**
	 * Px of the distribution chart that sit below the clip edge of a non-scrollable
	 * `overflow:hidden` ancestor — i.e. cropped with no way to scroll to them. `> 0`
	 * is the bug: in a stacked ~50vh grid cell the chart was hidden past the cell's
	 * bottom. The walk stops at the first scrollable ancestor (which CAN reveal the
	 * overflow), so a normally-scrolling tab reads 0. Stays 0 once the stats panel
	 * flows to full height with the clipping `overflow:hidden` lifted on mobile.
	 */
	clippedPx: number;
}

/**
 * Measure whether a stats tab's distribution chart is reachable on a phone. The
 * chart lives in a stacked grid cell only ~50vh tall; if an `overflow:hidden`
 * ancestor between it and the nearest scroll container crops it, the bottom of the
 * pie is unreachable. Returns `found:false` for views without a stats chart.
 */
export async function measureStatsChartReach(page: Page): Promise<StatsChartReach> {
	return page.evaluate((leafSelector) => {
		const leaf = document.querySelector(leafSelector);
		const views = Array.from(leaf?.querySelectorAll(".prisma-interval-stats-view") ?? []);
		let container: HTMLElement | null = null;
		for (const v of views) {
			// querySelector returns Element | null; HTMLElement narrowing is required to call getBoundingClientRect
			const c = v.querySelector(".prisma-stats-chart-container") as HTMLElement | null;
			if (c && c.getBoundingClientRect().height > 0) {
				container = c;
				break;
			}
		}
		if (!container) return { found: false, clippedPx: 0 };

		const chartBottom = container.getBoundingClientRect().bottom;
		let clippedPx = 0;
		let el = container.parentElement;
		while (el && el !== document.body) {
			const cs = getComputedStyle(el);
			// A scrollable ancestor can reveal anything below it — reachability is safe
			// from here up, so stop.
			if (cs.overflowY === "auto" || cs.overflowY === "scroll") break;
			if (cs.overflowY === "hidden" || cs.overflowY === "clip") {
				clippedPx = Math.max(clippedPx, chartBottom - el.getBoundingClientRect().bottom);
			}
			el = el.parentElement;
		}
		return { found: true, clippedPx: Math.max(0, Math.round(clippedPx)) };
	}, ACTIVE_CALENDAR_LEAF);
}
