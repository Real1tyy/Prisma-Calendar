import path from "node:path";

import type { StressBudget } from "@real1ty-obsidian-plugins/testing/stress";

import { PROFILES } from "./vaults/profiles";

// Playwright transpiles plugin specs as CJS (no "type":"module"), so use
// __dirname — `import.meta.url` is unavailable in that scope. Matches e2e.
const STRESS_DIR = __dirname;

export const STRESS_CONFIG = {
	seed: 42,
	repeats: 5,
	warmup: 1,
	/** Toolbar navigations per repeat (alternating next/prev). */
	navSteps: 12,
	/** Run artifacts (gitignored). Mirrors logs/change-reports. */
	artifactRoot: path.resolve(STRESS_DIR, "../../logs/perf-reports"),
	/** Committed, user-blessed baselines. */
	baselineDir: path.resolve(STRESS_DIR, "baselines"),
} as const;

export { PROFILES };

/**
 * Per-metric budget rules per scenario. Advisory cross-machine — same-machine
 * baselines carry regression detection — but they catch catastrophic blow-ups
 * anywhere.
 */
export const BUDGETS: Record<string, StressBudget> = {
	// Pure in-page render costs only. `scenario.navigateStep` (wall-clock incl.
	// click + CDP round-trips) is reported but not budgeted — too noisy to gate.
	"calendar-navigation": {
		"calendar.buildEvents.p95Ms": { comparison: "max", value: 250, unit: "ms" },
		"eventStore.getEvents.p95Ms": { comparison: "max", value: 200, unit: "ms" },
	},
};
