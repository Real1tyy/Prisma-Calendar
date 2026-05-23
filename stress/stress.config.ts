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

/** Memory-leak scenario knobs — open/close cycles, separate from nav repeats. */
export const MEMORY_CONFIG = {
	/** Discarded cycles to reach steady state before the measured loop. */
	warmupCycles: 2,
	/** Measured open/close cycles between the before/after heap snapshots. */
	cycles: 20,
	/** Catastrophic-only ceiling on post-GC live-heap growth (JSHeapUsedSize, bytes). */
	growthBudgetBytes: 50_000_000,
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
	// Leak gates: every leaf must be gone after teardown (exact) and live heap must
	// not balloon (catastrophic ceiling). Detached-DOM growth + retainers + node
	// growth are REPORTED every run (see the Heap section) but NOT gated: there is a
	// known, small per-cycle detached-DOM leak (FullCalendar/Preact + bound
	// listeners) that is deliberately deprioritized — performance work outranks it.
	// See docs/specs/2026-05-22-stress-real-load.md (carry-over). Re-gate
	// `heap.detachedGrowth` once the teardown is fixed and a clean level is measured.
	"memory-leak": {
		"resources.activeViews": { comparison: "exact", value: 0, unit: "count" },
		"heap.growthBytes": { comparison: "max", value: MEMORY_CONFIG.growthBudgetBytes, unit: "bytes" },
	},
};
