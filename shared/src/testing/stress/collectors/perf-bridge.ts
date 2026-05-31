import type { Page } from "@playwright/test";

import { PERF_BRIDGE_GLOBAL_KEY } from "../../../perf/bridge";
import type { PerfSnapshot } from "../../../perf/types";

// Drains the in-app perf bridge a plugin installs on `globalThis` (see
// `installPerfBridge` in @real1ty-obsidian-plugins/perf). Plugin-agnostic — the
// global key is shared, overridable per call.

/** Clear the plugin's recorded timings/counters before a measured pass. */
export async function resetPerfBridge(page: Page, key: string = PERF_BRIDGE_GLOBAL_KEY): Promise<void> {
	await page.evaluate((bridgeKey) => {
		const bridge = (window as unknown as Record<string, unknown>)[bridgeKey] as { reset?: () => void } | undefined;
		bridge?.reset?.();
	}, key);
}

/** Drain the plugin's current perf snapshot. Throws if the bridge is absent. */
export async function readPerfBridge(page: Page, key: string = PERF_BRIDGE_GLOBAL_KEY): Promise<PerfSnapshot> {
	const snapshot = await page.evaluate((bridgeKey) => {
		const bridge = (window as unknown as Record<string, unknown>)[bridgeKey] as { snapshot: () => unknown } | undefined;
		if (!bridge) {
			throw new Error(
				`Perf bridge not installed at globalThis[${JSON.stringify(bridgeKey)}] — build the plugin with perf instrumentation and run with stress/E2E mode enabled`
			);
		}
		return bridge.snapshot();
	}, key);
	return snapshot as PerfSnapshot;
}
