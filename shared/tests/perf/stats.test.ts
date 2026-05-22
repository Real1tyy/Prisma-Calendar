import { describe, expect, it } from "vitest";

import { percentile, summarizeSamples } from "../../src/perf/stats";

describe("percentile", () => {
	it("returns 0 for an empty set", () => {
		expect(percentile([], 50)).toBe(0);
	});

	it("returns the only value regardless of p", () => {
		expect(percentile([42], 0)).toBe(42);
		expect(percentile([42], 95)).toBe(42);
	});

	it("interpolates between neighbours", () => {
		// rank = 0.5 * 3 = 1.5 -> midpoint of 20 and 30
		expect(percentile([10, 20, 30, 40], 50)).toBe(25);
		// rank = 0.95 * 3 = 2.85 -> 30 + 0.85 * (40 - 30)
		expect(percentile([10, 20, 30, 40], 95)).toBeCloseTo(38.5, 10);
	});

	it("returns endpoints for p0 and p100", () => {
		expect(percentile([5, 9, 13], 0)).toBe(5);
		expect(percentile([5, 9, 13], 100)).toBe(13);
	});

	it("clamps out-of-range percentiles", () => {
		expect(percentile([5, 9, 13], -10)).toBe(5);
		expect(percentile([5, 9, 13], 250)).toBe(13);
	});
});

describe("summarizeSamples", () => {
	it("returns an all-zero summary for no samples", () => {
		expect(summarizeSamples([])).toEqual({
			count: 0,
			totalMs: 0,
			avgMs: 0,
			minMs: 0,
			maxMs: 0,
			p50Ms: 0,
			p95Ms: 0,
		});
	});

	it("summarizes a single sample", () => {
		expect(summarizeSamples([7])).toEqual({
			count: 1,
			totalMs: 7,
			avgMs: 7,
			minMs: 7,
			maxMs: 7,
			p50Ms: 7,
			p95Ms: 7,
		});
	});

	it("computes count/total/avg/min/max and percentiles", () => {
		const summary = summarizeSamples([4, 1, 3, 2]);
		expect(summary.count).toBe(4);
		expect(summary.totalMs).toBe(10);
		expect(summary.avgMs).toBe(2.5);
		expect(summary.minMs).toBe(1);
		expect(summary.maxMs).toBe(4);
		expect(summary.p50Ms).toBe(2.5);
		expect(summary.p95Ms).toBeCloseTo(3.85, 10);
	});

	it("does not mutate the input array", () => {
		const input = [3, 1, 2];
		summarizeSamples(input);
		expect(input).toEqual([3, 1, 2]);
	});
});
