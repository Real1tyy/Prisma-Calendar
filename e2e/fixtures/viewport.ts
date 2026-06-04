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

		return {
			paneWidth: Math.round(paneRect.width),
			viewContentPx,
			tabCroppedPx: Math.max(0, Math.round(tabCroppedPx)),
			tabCount: tabs.length,
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
