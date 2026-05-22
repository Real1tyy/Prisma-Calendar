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
	/** How much the tab content exceeds the visible strip (`scrollWidth - clientWidth`). */
	tabStripOverflowPx: number;
	/**
	 * Whether the strip can actually scroll that overflow (computed `overflow-x` is
	 * `auto`/`scroll`). The bug is overflow that is *not* scrollable — tabs spill
	 * past the pane and are unreachable. A scrollable strip is correct, even though
	 * its off-screen tabs still report bounding rects beyond the pane.
	 */
	tabStripScrollable: boolean;
}

/**
 * Measure the two horizontal-overflow symptoms that matter on a phone: the pane
 * content escaping its scroll box, and the view-tab strip overflowing *without*
 * being scrollable (so tabs are unreachable).
 */
export async function measureMobileOverflow(page: Page): Promise<MobileOverflow | null> {
	return page.evaluate((leafSelector) => {
		const leaf = document.querySelector(leafSelector);
		if (!leaf) return null;

		const content = leaf.querySelector(".view-content");
		const viewContentPx = content ? Math.max(0, content.scrollWidth - content.clientWidth) : 0;

		const bar = leaf.querySelector('[class*="tab-bar"]');
		let tabStripOverflowPx = 0;
		let tabStripScrollable = true;
		if (bar) {
			tabStripOverflowPx = Math.max(0, bar.scrollWidth - bar.clientWidth);
			const overflowX = getComputedStyle(bar).overflowX;
			tabStripScrollable = overflowX === "auto" || overflowX === "scroll";
		}

		return {
			paneWidth: Math.round(leaf.getBoundingClientRect().width),
			viewContentPx,
			tabStripOverflowPx,
			tabStripScrollable,
		};
	}, ACTIVE_CALENDAR_LEAF);
}
