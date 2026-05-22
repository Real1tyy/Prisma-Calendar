import { describe, expect, it } from "vitest";

import { flattenMetrics, flattenTimings, mergeTimings, summarizeSampleGroups } from "../../src/testing/stress/metrics";
import { summary } from "./stress-fixtures";

describe("summarizeSampleGroups", () => {
	it("summarizes each named group", () => {
		const result = summarizeSampleGroups({ nav: [10, 20, 30], open: [5] });
		expect(result["nav"]).toMatchObject({ count: 3, totalMs: 60, avgMs: 20 });
		expect(result["open"]?.count).toBe(1);
	});
});

describe("flattenTimings", () => {
	it("emits one key per statistic", () => {
		const flat = flattenTimings({ nav: summary(50, { count: 12 }) });
		expect(flat["nav.p95Ms"]).toBe(50);
		expect(flat["nav.count"]).toBe(12);
		expect(flat["nav.maxMs"]).toBe(50);
	});
});

describe("flattenMetrics", () => {
	it("merges flattened timings with raw counts", () => {
		const flat = flattenMetrics({ nav: summary(50) }, { "events.indexed": 5000 });
		expect(flat["nav.p95Ms"]).toBe(50);
		expect(flat["events.indexed"]).toBe(5000);
	});
});

describe("mergeTimings", () => {
	it("lets the right side win on key collision", () => {
		const merged = mergeTimings({ nav: summary(10) }, { nav: summary(20), open: summary(5) });
		expect(merged["nav"]?.p95Ms).toBe(20);
		expect(merged["open"]?.p95Ms).toBe(5);
	});
});
