import { describe, expect, it } from "vitest";

import { deepEqualJsonLike } from "../../src/utils/deep-equal";

describe("deepEqualJsonLike", () => {
	it("returns true for identical primitives", () => {
		expect(deepEqualJsonLike(1, 1)).toBe(true);
		expect(deepEqualJsonLike("a", "a")).toBe(true);
		expect(deepEqualJsonLike(true, true)).toBe(true);
		expect(deepEqualJsonLike(null, null)).toBe(true);
		expect(deepEqualJsonLike(undefined, undefined)).toBe(true);
	});

	it("treats NaN as equal to NaN", () => {
		expect(deepEqualJsonLike(NaN, NaN)).toBe(true);
		expect(deepEqualJsonLike({ x: NaN }, { x: NaN })).toBe(true);
		expect(deepEqualJsonLike([NaN], [NaN])).toBe(true);
	});

	it("keeps Number semantics for +0 / -0 (both are ===)", () => {
		expect(deepEqualJsonLike(0, -0)).toBe(true);
	});

	it("distinguishes null, undefined, and 0", () => {
		expect(deepEqualJsonLike(null, undefined)).toBe(false);
		expect(deepEqualJsonLike(null, 0)).toBe(false);
		expect(deepEqualJsonLike(undefined, 0)).toBe(false);
		expect(deepEqualJsonLike(0, "0")).toBe(false);
	});

	it("compares arrays element-wise", () => {
		expect(deepEqualJsonLike([1, 2, 3], [1, 2, 3])).toBe(true);
		expect(deepEqualJsonLike([1, 2, 3], [1, 2])).toBe(false);
		expect(deepEqualJsonLike([1, [2, 3]], [1, [2, 3]])).toBe(true);
		expect(deepEqualJsonLike([1, [2, 3]], [1, [2, 4]])).toBe(false);
	});

	it("compares plain objects structurally (order-agnostic)", () => {
		expect(deepEqualJsonLike({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
		expect(deepEqualJsonLike({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
		expect(deepEqualJsonLike({ a: 1 }, { a: 1, b: 2 })).toBe(false);
		expect(deepEqualJsonLike({ a: { b: { c: 1 } } }, { a: { b: { c: 1 } } })).toBe(true);
		expect(deepEqualJsonLike({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } })).toBe(false);
	});

	it("handles Dates via getTime", () => {
		expect(deepEqualJsonLike(new Date(1000), new Date(1000))).toBe(true);
		expect(deepEqualJsonLike(new Date(1000), new Date(2000))).toBe(false);
	});

	it("distinguishes arrays from plain objects with same indexed keys", () => {
		expect(deepEqualJsonLike({ 0: "a" }, ["a"])).toBe(false);
	});

	// Domain limits — these inputs shouldn't occur in JSON-like data, so we don't
	// promise correct behavior. The tests below pin current behavior so future
	// edits don't accidentally claim more coverage than we intend.
	describe("out-of-domain values (documented non-goals)", () => {
		it("does not deep-compare Sets or Maps — use node:util isDeepStrictEqual for those", () => {
			expect(deepEqualJsonLike(new Set([1, 2]), new Set([1, 2]))).toBe(false);
			expect(deepEqualJsonLike(new Map([["a", 1]]), new Map([["a", 1]]))).toBe(false);
		});

		it("does not deep-compare RegExp — /a/ and /a/ are distinct objects", () => {
			expect(deepEqualJsonLike(/a/, /a/)).toBe(false);
		});
	});
});
