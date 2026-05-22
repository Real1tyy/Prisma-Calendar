import { describe, expect, it } from "vitest";

import { compareToBaseline, hasRegression } from "../../src/testing/stress/regression";
import type { RegressionRule, StressBaseline } from "../../src/testing/stress/types";
import { makeRunReport, summary, TEST_ENVIRONMENT } from "./stress-fixtures";

const RULE: RegressionRule = { ratio: 1.25, minAbsoluteDelta: 30 };

function baseline(overrides: Partial<StressBaseline> = {}): StressBaseline {
	return {
		scenario: "calendar-navigation",
		profile: "small",
		capturedAt: "2026-05-21T00:00:00.000Z",
		environment: TEST_ENVIRONMENT,
		timings: {},
		counts: {},
		...overrides,
	};
}

describe("compareToBaseline — timings", () => {
	it("does not regress within the tolerance band", () => {
		const report = makeRunReport({ timings: { nav: summary(110) } });
		const findings = compareToBaseline(report, baseline({ timings: { nav: 100 } }), RULE);
		expect(findings).toHaveLength(1);
		expect(findings[0]?.regressed).toBe(false);
	});

	it("regresses when over BOTH the ratio and the absolute floor", () => {
		const report = makeRunReport({ timings: { nav: summary(200) } });
		const findings = compareToBaseline(report, baseline({ timings: { nav: 100 } }), RULE);
		expect(findings[0]?.regressed).toBe(true);
		expect(findings[0]?.delta).toBe(100);
	});

	it("does not regress when over the ratio but under the absolute floor", () => {
		// 25 -> 35 is +40% (over ratio) but only +10ms (under the 30ms floor)
		const report = makeRunReport({ timings: { nav: summary(35) } });
		const findings = compareToBaseline(report, baseline({ timings: { nav: 25 } }), RULE);
		expect(findings[0]?.regressed).toBe(false);
	});

	it("skips baseline metrics absent from the report", () => {
		const report = makeRunReport({ timings: { other: summary(10) } });
		const findings = compareToBaseline(report, baseline({ timings: { nav: 100 } }), RULE);
		expect(findings).toEqual([]);
	});
});

describe("compareToBaseline — counts", () => {
	it("regresses on any difference", () => {
		const report = makeRunReport({ counts: { "events.indexed": 4999 } });
		const findings = compareToBaseline(report, baseline({ counts: { "events.indexed": 5000 } }), RULE);
		expect(findings[0]).toMatchObject({ kind: "count", regressed: true, delta: -1 });
	});

	it("does not regress when counts match exactly", () => {
		const report = makeRunReport({ counts: { "events.indexed": 5000 } });
		const findings = compareToBaseline(report, baseline({ counts: { "events.indexed": 5000 } }), RULE);
		expect(findings[0]?.regressed).toBe(false);
	});
});

describe("hasRegression", () => {
	it("is true when any finding regressed", () => {
		const report = makeRunReport({ timings: { nav: summary(200) }, counts: { c: 1 } });
		const findings = compareToBaseline(report, baseline({ timings: { nav: 100 }, counts: { c: 1 } }), RULE);
		expect(hasRegression(findings)).toBe(true);
	});

	it("is false when nothing regressed", () => {
		const report = makeRunReport({ timings: { nav: summary(105) } });
		const findings = compareToBaseline(report, baseline({ timings: { nav: 100 } }), RULE);
		expect(hasRegression(findings)).toBe(false);
	});
});
