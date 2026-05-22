import { describe, expect, it } from "vitest";

import { evaluateBudgets } from "../../src/testing/stress/budgets";
import type { StressBudget } from "../../src/testing/stress/types";

const NAV_BUDGET: StressBudget = {
	"nav.p95Ms": { comparison: "max", value: 120, unit: "ms" },
};

describe("evaluateBudgets — max", () => {
	it("returns no failures when under the ceiling", () => {
		expect(evaluateBudgets({ "nav.p95Ms": 100 }, NAV_BUDGET)).toEqual([]);
	});

	it("does not flag a metric exactly at the ceiling", () => {
		expect(evaluateBudgets({ "nav.p95Ms": 120 }, NAV_BUDGET)).toEqual([]);
	});

	it("flags a metric over the ceiling with delta + pct", () => {
		const failures = evaluateBudgets({ "nav.p95Ms": 180 }, NAV_BUDGET);
		expect(failures).toHaveLength(1);
		expect(failures[0]).toEqual({
			metric: "nav.p95Ms",
			comparison: "max",
			actual: 180,
			expected: 120,
			delta: 60,
			deltaPct: 50,
			unit: "ms",
		});
	});
});

describe("evaluateBudgets — min", () => {
	it("flags a metric below the floor", () => {
		const failures = evaluateBudgets(
			{ "cache.hitRatio": 0.5 },
			{ "cache.hitRatio": { comparison: "min", value: 0.9 } }
		);
		expect(failures[0]).toMatchObject({ comparison: "min", actual: 0.5, expected: 0.9 });
	});
});

describe("evaluateBudgets — exact", () => {
	it("flags any difference and reports null pct", () => {
		const failures = evaluateBudgets(
			{ "leak.activeViews": 2 },
			{ "leak.activeViews": { comparison: "exact", value: 0, unit: "count" } }
		);
		expect(failures[0]).toMatchObject({ comparison: "exact", actual: 2, expected: 0, delta: 2, deltaPct: null });
	});

	it("passes when exactly equal", () => {
		expect(
			evaluateBudgets({ "leak.activeViews": 0 }, { "leak.activeViews": { comparison: "exact", value: 0 } })
		).toEqual([]);
	});
});

describe("evaluateBudgets — general", () => {
	it("skips budget keys with no matching metric", () => {
		expect(evaluateBudgets({ "nav.p95Ms": 999 }, { "missing.metric": { comparison: "max", value: 1 } })).toEqual([]);
	});

	it("reports null pct when the reference value is zero", () => {
		const failures = evaluateBudgets({ x: 5 }, { x: { comparison: "max", value: 0 } });
		expect(failures[0]?.deltaPct).toBeNull();
	});
});
