import { describe, expect, it } from "vitest";

import {
	computeTrackPxs,
	parseTracks,
	redistributeTracks,
	roundFr,
} from "../../src/components/grid-layout/grid-resize";

describe("roundFr", () => {
	it("rounds to two decimal places", () => {
		expect(roundFr(1.006)).toBe(1.01);
		expect(roundFr(0.333333)).toBe(0.33);
		expect(roundFr(2.999)).toBe(3);
	});

	it("preserves clean values", () => {
		expect(roundFr(1)).toBe(1);
		expect(roundFr(0.5)).toBe(0.5);
	});
});

describe("parseTracks", () => {
	it("parses space-separated pixel values", () => {
		expect(parseTracks("200px 300px")).toEqual([200, 300]);
	});

	it("parses plain numbers", () => {
		expect(parseTracks("100 200 300")).toEqual([100, 200, 300]);
	});

	it("returns empty array for none", () => {
		expect(parseTracks("none")).toEqual([]);
	});

	it("returns empty array for empty string", () => {
		expect(parseTracks("")).toEqual([]);
	});

	it("filters out NaN entries", () => {
		expect(parseTracks("200px auto 300px")).toEqual([200, 300]);
	});
});

describe("computeTrackPxs", () => {
	it("distributes equally for uniform fractions", () => {
		const result = computeTrackPxs([1, 1], 400, 0);
		expect(result).toEqual([200, 200]);
	});

	it("distributes proportionally for different fractions", () => {
		const result = computeTrackPxs([2, 1], 300, 0);
		expect(result).toEqual([200, 100]);
	});

	it("accounts for gaps", () => {
		const result = computeTrackPxs([1, 1], 410, 10);
		expect(result).toEqual([200, 200]);
	});

	it("handles three tracks with gaps", () => {
		const result = computeTrackPxs([1, 1, 1], 320, 10);
		expect(result).toEqual([100, 100, 100]);
	});
});

describe("redistributeTracks", () => {
	it("redistributes fractions based on pixel delta", () => {
		const trackPxs = [200, 200];
		const result = redistributeTracks([1, 1], 0, trackPxs, 50);

		expect(result[0]).toBeGreaterThan(1);
		expect(result[1]).toBeLessThan(1);
		expect(roundFr(result[0] + result[1])).toBe(2);
	});

	it("clamps to minimum track size", () => {
		const trackPxs = [200, 200];
		const result = redistributeTracks([1, 1], 0, trackPxs, 999);

		const totalFr = result[0] + result[1];
		expect(result[0]).toBeGreaterThan(0);
		expect(result[1]).toBeGreaterThan(0);
		expect(roundFr(totalFr)).toBe(2);
	});

	it("clamps negative delta to minimum", () => {
		const trackPxs = [200, 200];
		const result = redistributeTracks([1, 1], 0, trackPxs, -999);

		expect(result[0]).toBeGreaterThan(0);
		expect(result[1]).toBeGreaterThan(0);
	});

	it("preserves other tracks", () => {
		const trackPxs = [100, 100, 100];
		const result = redistributeTracks([1, 1, 1], 1, trackPxs, 20);

		expect(result[0]).toBe(1);
		expect(result[1]).not.toBe(1);
		expect(result[2]).not.toBe(1);
	});

	it("zero delta returns original fractions", () => {
		const trackPxs = [200, 200];
		const result = redistributeTracks([1, 1], 0, trackPxs, 0);

		expect(result).toEqual([1, 1]);
	});
});
