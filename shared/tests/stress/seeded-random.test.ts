import { describe, expect, it } from "vitest";

import { createSeededRandom } from "../../src/testing/stress/seeded-random";

function sequence(seed: number, n: number): number[] {
	const rng = createSeededRandom(seed);
	return Array.from({ length: n }, () => rng.next());
}

describe("createSeededRandom", () => {
	it("produces an identical sequence for the same seed", () => {
		expect(sequence(42, 10)).toEqual(sequence(42, 10));
	});

	it("produces a different sequence for a different seed", () => {
		expect(sequence(42, 10)).not.toEqual(sequence(43, 10));
	});

	it("emits floats in [0, 1)", () => {
		const rng = createSeededRandom(7);
		for (let i = 0; i < 100; i++) {
			const value = rng.next();
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});

	it("int() stays within inclusive bounds and is deterministic", () => {
		const a = createSeededRandom(1);
		const b = createSeededRandom(1);
		for (let i = 0; i < 50; i++) {
			const value = a.int(5, 8);
			expect(value).toBe(b.int(5, 8));
			expect(value).toBeGreaterThanOrEqual(5);
			expect(value).toBeLessThanOrEqual(8);
		}
	});

	it("pick() is deterministic for a given seed", () => {
		const items = ["a", "b", "c", "d"] as const;
		const a = createSeededRandom(99);
		const b = createSeededRandom(99);
		expect(Array.from({ length: 20 }, () => a.pick(items))).toEqual(Array.from({ length: 20 }, () => b.pick(items)));
	});

	it("pick() throws on an empty array", () => {
		const rng = createSeededRandom(1);
		expect(() => rng.pick([])).toThrow(/empty/);
	});

	it("bool() respects the probability extremes", () => {
		const rng = createSeededRandom(3);
		expect(rng.bool(1)).toBe(true);
		expect(rng.bool(0)).toBe(false);
	});
});
