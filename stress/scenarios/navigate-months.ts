import type { Page } from "@playwright/test";
import { PERF_BRIDGE_GLOBAL_KEY } from "@real1ty-obsidian-plugins/perf";

import { ACTIVE_CALENDAR_LEAF } from "../../e2e/fixtures/constants";
import { sel, TID } from "../../e2e/fixtures/testids";

// The instrumented `calendar.buildEvents` count is our settle signal AND our
// pure render-cost metric: every toolbar navigation triggers exactly one build,
// so waiting for the count to advance proves the re-render completed before we
// record the step's wall-clock. The bridge is read by its generic global key.

const BUILD_METRIC = "calendar.buildEvents";

async function readBuildCount(page: Page): Promise<number> {
	return page.evaluate(
		({ key, metric }) => {
			const bridge = (globalThis as Record<string, unknown>)[key] as
				| { snapshot: () => { timings: Record<string, { count: number }> } }
				| undefined;
			return bridge?.snapshot().timings[metric]?.count ?? 0;
		},
		{ key: PERF_BRIDGE_GLOBAL_KEY, metric: BUILD_METRIC }
	);
}

/** Switch the active calendar to month view for a wide, populated window. */
export async function setMonthView(page: Page): Promise<void> {
	await page
		.locator(`${ACTIVE_CALENDAR_LEAF} ${sel(TID.toolbar("view-month"))}`)
		.first()
		.click();
	await page.waitForFunction(
		({ key, metric }) => {
			const bridge = (globalThis as Record<string, unknown>)[key] as
				| { snapshot: () => { timings: Record<string, { count: number }> } }
				| undefined;
			return (bridge?.snapshot().timings[metric]?.count ?? 0) > 0;
		},
		{ key: PERF_BRIDGE_GLOBAL_KEY, metric: BUILD_METRIC }
	);
}

export type RecordStep = (durationMs: number) => void;

/**
 * Oscillate next/prev `steps` times to stay within the populated date window,
 * recording each navigation's wall-clock. Each click waits for the calendar to
 * finish rebuilding before the next.
 */
export async function navigateMonths(page: Page, steps: number, record: RecordStep): Promise<void> {
	const next = page.locator(`${ACTIVE_CALENDAR_LEAF} ${sel(TID.toolbar("next"))}`).first();
	const prev = page.locator(`${ACTIVE_CALENDAR_LEAF} ${sel(TID.toolbar("prev"))}`).first();

	for (let i = 0; i < steps; i++) {
		const button = i % 2 === 0 ? next : prev;
		const before = await readBuildCount(page);
		const startedAt = performance.now();
		await button.click();
		await page.waitForFunction(
			({ key, metric, baseline }) => {
				const bridge = (globalThis as Record<string, unknown>)[key] as
					| { snapshot: () => { timings: Record<string, { count: number }> } }
					| undefined;
				return (bridge?.snapshot().timings[metric]?.count ?? 0) > baseline;
			},
			{ key: PERF_BRIDGE_GLOBAL_KEY, metric: BUILD_METRIC, baseline: before }
		);
		record(performance.now() - startedAt);
	}
}
