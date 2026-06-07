import type { CDPSession, Page } from "@playwright/test";

import { ACTIVE_CALENDAR_LEAF } from "../../fixtures/constants";
import { openActionManager } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import {
	LIST_MODAL_TID,
	overflowMenuItem,
	PAGE_HEADER_OVERFLOW_MENU_TID,
	PAGE_HEADER_OVERFLOW_TID,
	sel,
} from "../../fixtures/testids";

interface ObsidianSplitWin {
	app?: { workspace?: { leftSplit?: { collapse?: () => void }; rightSplit?: { collapse?: () => void } } };
}

// Resize the renderer through one reused CDP session — re-issuing the device
// metrics override on a fresh session per call doesn't reliably re-lay-out the page.
async function makeResizer(page: Page): Promise<(w: number) => Promise<void>> {
	const cdp: CDPSession = await page.context().newCDPSession(page);
	return async (width) => {
		await cdp.send("Emulation.setDeviceMetricsOverride", {
			width,
			height: 800,
			deviceScaleFactor: 1,
			mobile: false,
			screenWidth: width,
			screenHeight: 800,
		});
		await page.evaluate(() => {
			const w = window as unknown as ObsidianSplitWin;
			w.app?.workspace?.leftSplit?.collapse?.();
			w.app?.workspace?.rightSplit?.collapse?.();
		});
	};
}

interface HeaderFit {
	/** Total action buttons registered (visible + overflowed). */
	total: number;
	/** Action buttons actually shown (not marked overflow, non-zero box). */
	visible: number;
	manageVisible: boolean;
	/** Px the Manage button extends past the header's right edge. */
	manageOverflowPx: number;
	/** Px from the Manage button's right edge to the header's right edge (right-anchor check). */
	manageGapFromRight: number;
	/** Largest px any visible action button extends past the header's right edge. */
	actionOverflowPx: number;
	/** Largest px any visible action button spills LEFT of the action box (under the title). */
	actionLeftSpillPx: number;
}

async function measureHeaderFit(page: Page): Promise<HeaderFit | null> {
	return page.evaluate((leafSel) => {
		const leaf = document.querySelector(leafSel);
		const header = leaf?.querySelector(".view-header") as HTMLElement | null;
		const viewActions = leaf?.querySelector(".view-actions") as HTMLElement | null;
		if (!header || !viewActions) return null;
		const headerRight = header.getBoundingClientRect().right;
		const actionsLeft = viewActions.getBoundingClientRect().left;
		const all = Array.from(leaf!.querySelectorAll<HTMLElement>('[data-testid^="prisma-toolbar-"]'));
		const visible = all.filter((b) => b.getAttribute("data-ph-overflow") !== "true" && b.offsetWidth > 0);
		const manage = leaf!.querySelector<HTMLElement>('[data-testid="prisma-page-header-manage"]');
		const mr = manage?.getBoundingClientRect();

		let actionOverflowPx = 0;
		let actionLeftSpillPx = 0;
		for (const b of visible) {
			const box = b.getBoundingClientRect();
			actionOverflowPx = Math.max(actionOverflowPx, box.right - headerRight);
			actionLeftSpillPx = Math.max(actionLeftSpillPx, actionsLeft - box.left);
		}
		return {
			total: all.length,
			visible: visible.length,
			manageVisible: !!mr && mr.width > 0,
			manageOverflowPx: mr ? Math.round(Math.max(0, mr.right - headerRight)) : 0,
			manageGapFromRight: mr ? Math.round(headerRight - mr.right) : 0,
			actionOverflowPx: Math.round(Math.max(0, actionOverflowPx)),
			actionLeftSpillPx: Math.round(Math.max(0, actionLeftSpillPx)),
		};
	}, ACTIVE_CALENDAR_LEAF);
}

/** Whether a specific toolbar action is rendered and not trimmed away. */
async function isActionVisible(page: Page, id: string): Promise<boolean> {
	return page.evaluate(
		([leafSel, actionId]) => {
			const el = document.querySelector(`${leafSel} [data-testid="prisma-toolbar-${actionId}"]`) as HTMLElement | null;
			return !!el && el.getAttribute("data-ph-overflow") !== "true" && el.offsetWidth > 0;
		},
		[ACTIVE_CALENDAR_LEAF, id] as const
	);
}

// 1px absorbs sub-pixel rounding when comparing button edges to the header box.
const EDGE_TOLERANCE_PX = 1;
// The action row is anchored to the top-right: Manage should sit close to the
// header's right edge, not stranded mid-row. A regression that left-aligns the row
// (Manage centered) pushes this gap into the hundreds.
const RIGHT_ANCHOR_MAX_GAP_PX = 48;

test.describe("shared: page header overflow fit", () => {
	test("fits actions to width, keeps Manage reachable, and stays stable", async ({ calendar }) => {
		const page = calendar.page;
		await calendar.unlockPro();
		const resize = await makeResizer(page);

		// A roomy-but-bounded width: several of the 18 seeded actions fit, not all.
		await resize(600);
		await page.waitForTimeout(500);
		const narrow = await measureHeaderFit(page);
		expect(narrow, "page-header action row / header not found").not.toBeNull();
		if (!narrow) return;

		expect(narrow.visible, "no actions fit at 600px").toBeGreaterThan(0);
		// The whole point of the fit: at 600px the 18 seeded actions cannot all fit, so
		// the row MUST crop. A regression that renders the full row (the old width-count
		// over-estimate) fails here.
		expect(narrow.visible, "the row did not crop — every action rendered at 600px").toBeLessThan(narrow.total);
		// And nothing spills LEFT under the title — the right-anchored cluster overflowing
		// off the left edge is exactly the breakage a crop is meant to prevent.
		expect(narrow.actionLeftSpillPx, "a visible action spills left under the title").toBeLessThanOrEqual(
			EDGE_TOLERANCE_PX
		);
		expect(narrow.manageVisible, "Manage button must render").toBe(true);
		// The whole point: Manage stays inside the header, never pushed off.
		expect(narrow.manageOverflowPx, "Manage button overflows the header").toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
		// And it's right-anchored, not stranded mid-row.
		expect(narrow.manageGapFromRight, "Manage is not right-anchored (stranded mid-row)").toBeLessThanOrEqual(
			RIGHT_ANCHOR_MAX_GAP_PX
		);
		// No shown action button spills past the header edge — only whole, reachable buttons.
		expect(narrow.actionOverflowPx, "a visible action button is clipped past the header").toBeLessThanOrEqual(
			EDGE_TOLERANCE_PX
		);

		// Stability: enabling a hidden action must NOT change how many fit (same width
		// → same fit) and must keep Manage reachable. This is the regression guard for
		// the old bug where enabling actions made the visible count drift down.
		const manager = await openActionManager(page);
		await manager.toggle("create-event"); // registered but hidden by default
		await manager.close();
		await page.waitForTimeout(400);
		const afterEnable = await measureHeaderFit(page);
		expect(afterEnable).not.toBeNull();
		if (!afterEnable) return;
		expect(afterEnable.visible, "enabling an action changed how many fit").toBe(narrow.visible);
		expect(afterEnable.manageVisible).toBe(true);
		expect(afterEnable.manageOverflowPx).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);

		// Widening the pane reveals more actions (the fit recomputes upward), still
		// keeping Manage reachable and clipping nothing.
		await resize(760);
		await page.waitForTimeout(500);
		const wide = await measureHeaderFit(page);
		expect(wide).not.toBeNull();
		if (!wide) return;
		expect(wide.visible, "widening the pane should reveal more actions").toBeGreaterThan(narrow.visible);
		expect(wide.manageVisible).toBe(true);
		expect(wide.manageOverflowPx).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
		expect(wide.actionOverflowPx).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
		expect(wide.actionLeftSpillPx, "a visible action spills left under the title").toBeLessThanOrEqual(
			EDGE_TOLERANCE_PX
		);
	});

	test("reordering an overflowed action into range makes it visible", async ({ calendar }) => {
		const page = calendar.page;
		await calendar.unlockPro();
		const resize = await makeResizer(page);

		// Narrow enough that only a few actions fit — so a hidden-by-default action,
		// once enabled, lands well beyond the visible range.
		await resize(500);
		await page.waitForTimeout(500);

		const manager = await openActionManager(page);
		await manager.toggle("create-event"); // enable; appended at the end (overflowed)
		await manager.close();
		// Poll (the fit re-packs on the next animation frame): it should NOT be visible
		// yet — it's at the end, beyond the few that fit at 500px.
		await expect
			.poll(() => isActionVisible(page, "create-event"), {
				message: "a freshly-enabled action at the end should be beyond the visible range here",
			})
			.toBe(false);

		// Move it to the very front. The row must re-pack reactively and reveal it —
		// the bug was that reordering didn't re-fit, so a now-in-range action stayed hidden.
		const reorder = await openActionManager(page);
		for (let i = 0; i < 24; i++) await reorder.moveUp("create-event").catch(() => {});
		await reorder.close();
		await expect
			.poll(() => isActionVisible(page, "create-event"), {
				message: "reordering an action into the visible range did not reveal it (row not reactive to order)",
			})
			.toBe(true);
	});

	test("overflow trigger surfaces a trimmed action and invokes it", async ({ calendar }) => {
		const page = calendar.page;
		await calendar.unlockPro();
		const resize = await makeResizer(page);

		// Narrow enough that the bulk of the actions overflow off the bar.
		await resize(500);
		await page.waitForTimeout(500);

		// The trigger reveals itself once the fit logic trims at least one action.
		const trigger = page.locator(`${ACTIVE_CALENDAR_LEAF} ${sel(PAGE_HEADER_OVERFLOW_TID)}`).first();
		await trigger.waitFor({ state: "visible" });

		// global-search sits late enough in the default order that it's trimmed here —
		// it's the reachability the menu exists to provide.
		expect(await isActionVisible(page, "global-search"), "global-search should be trimmed at 500px").toBe(false);

		await trigger.click();
		const menu = page.locator(sel(PAGE_HEADER_OVERFLOW_MENU_TID)).first();
		await menu.waitFor({ state: "visible" });

		// The trigger sits at the header's far right, so the menu must open LEFTWARD and
		// stay inside the viewport — a left-anchored menu spills off the right edge and
		// crops every label.
		const innerWidth = await page.evaluate(() => window.innerWidth);
		const menuBox = await menu.boundingBox();
		expect(menuBox, "overflow menu has no box").not.toBeNull();
		expect(menuBox!.x, "overflow menu spills off the left edge").toBeGreaterThanOrEqual(-1);
		expect(menuBox!.x + menuBox!.width, "overflow menu spills off the right edge").toBeLessThanOrEqual(innerWidth + 1);

		await page
			.locator(sel(overflowMenuItem("global-search")))
			.first()
			.click();

		// Selecting the overflowed action runs it — the global-search list modal opens.
		await page.locator(sel(LIST_MODAL_TID)).first().waitFor({ state: "visible" });
	});
});
