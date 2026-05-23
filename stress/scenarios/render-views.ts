import type { Page } from "@playwright/test";

import {
	DASHBOARD_RANKING_TID,
	HEATMAP_CONTAINER_TID,
	sel,
	TID,
	TIMELINE_CONTAINER_TID,
	type ViewTabKey,
} from "../../e2e/fixtures/testids";

// Drives a cold first-render of each heavy analytics view. Every cycle returns to
// the calendar tab first, so each switch measures a from-scratch mount of the
// target view against the seeded event set — not a warm re-activation. The settle
// signal is the view's own content container becoming visible (proof it painted),
// so the recorded wall-clock spans click → first paint.

const GANTT_TAB_TID = "prisma-gantt-tab";

interface HeavyView {
	name: string;
	tab: ViewTabKey;
	/** Group tab to open first (dashboard children live behind a dropdown). */
	group?: ViewTabKey;
	/** Testid of the content element that proves the view painted. */
	container: string;
}

const HEAVY_VIEWS: readonly HeavyView[] = [
	{ name: "timeline", tab: "timeline", container: TIMELINE_CONTAINER_TID },
	{ name: "heatmap", tab: "heatmap", container: HEATMAP_CONTAINER_TID },
	{ name: "gantt", tab: "gantt", container: GANTT_TAB_TID },
	{ name: "dashboard-by-name", tab: "dashboard-by-name", group: "dashboard", container: DASHBOARD_RANKING_TID },
];

export type RecordView = (name: string, durationMs: number) => void;

async function clickTab(page: Page, tab: ViewTabKey): Promise<void> {
	const el = page.locator(sel(TID.viewTab(tab))).first();
	await el.waitFor({ state: "visible" });
	await el.click();
}

/** Render each heavy view once (cold from calendar), recording its click→paint wall-clock. */
export async function renderHeavyViews(page: Page, record: RecordView): Promise<void> {
	for (const view of HEAVY_VIEWS) {
		await clickTab(page, "calendar");
		const startedAt = performance.now();
		if (view.group) await clickTab(page, view.group);
		await clickTab(page, view.tab);
		await page.locator(sel(view.container)).first().waitFor({ state: "visible" });
		record(view.name, performance.now() - startedAt);
	}
}

export const HEAVY_VIEW_NAMES = HEAVY_VIEWS.map((v) => v.name);
