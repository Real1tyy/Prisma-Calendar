import { describe, expect, it } from "vitest";

import { BoundedMap } from "../../src/utils/bounded-map";

describe("BoundedMap", () => {
	it("rejects non-positive capacity", () => {
		expect(() => new BoundedMap<string, number>(0)).toThrow();
		expect(() => new BoundedMap<string, number>(-1)).toThrow();
		expect(() => new BoundedMap<string, number>(1.5)).toThrow();
	});

	it("stores values up to capacity without eviction", () => {
		const cache = new BoundedMap<string, number>(3);
		cache.set("a", 1);
		cache.set("b", 2);
		cache.set("c", 3);
		expect(cache.size).toBe(3);
		expect(cache.get("a")).toBe(1);
		expect(cache.get("b")).toBe(2);
		expect(cache.get("c")).toBe(3);
	});

	it("evicts the least-recently-used entry when capacity is exceeded", () => {
		const cache = new BoundedMap<string, number>(2);
		cache.set("a", 1);
		cache.set("b", 2);
		cache.set("c", 3);
		expect(cache.has("a")).toBe(false);
		expect(cache.has("b")).toBe(true);
		expect(cache.has("c")).toBe(true);
	});

	it("evicts correctly when capacity is 1", () => {
		const cache = new BoundedMap<string, number>(1);
		cache.set("a", 1);
		cache.set("b", 2);
		expect(cache.has("a")).toBe(false);
		expect(cache.has("b")).toBe(true);
	});

	it("get promotes a key to most-recently-used", () => {
		const cache = new BoundedMap<string, number>(2);
		cache.set("a", 1);
		cache.set("b", 2);
		expect(cache.get("a")).toBe(1);
		cache.set("c", 3);
		expect(cache.has("a")).toBe(true);
		expect(cache.has("b")).toBe(false);
		expect(cache.has("c")).toBe(true);
	});

	it("set promotes an existing key to most-recently-used", () => {
		const cache = new BoundedMap<string, number>(2);
		cache.set("a", 1);
		cache.set("b", 2);
		cache.set("a", 10);
		cache.set("c", 3);
		expect(cache.get("a")).toBe(10);
		expect(cache.has("b")).toBe(false);
		expect(cache.has("c")).toBe(true);
	});

	it("has does not promote recency", () => {
		const cache = new BoundedMap<string, number>(2);
		cache.set("a", 1);
		cache.set("b", 2);
		expect(cache.has("a")).toBe(true);
		cache.set("c", 3);
		expect(cache.has("a")).toBe(false);
		expect(cache.has("b")).toBe(true);
		expect(cache.has("c")).toBe(true);
	});

	it("peek reads without promoting recency", () => {
		const cache = new BoundedMap<string, number>(2);
		cache.set("a", 1);
		cache.set("b", 2);
		expect(cache.peek("a")).toBe(1);
		cache.set("c", 3);
		expect(cache.has("a")).toBe(false);
		expect(cache.has("b")).toBe(true);
		expect(cache.has("c")).toBe(true);
	});

	it("peek returns undefined for missing keys", () => {
		const cache = new BoundedMap<string, number>(2);
		expect(cache.peek("missing")).toBeUndefined();
	});

	it("supports delete and clear", () => {
		const cache = new BoundedMap<string, number>(3);
		cache.set("a", 1).set("b", 2);
		expect(cache.delete("a")).toBe(true);
		expect(cache.delete("a")).toBe(false);
		expect(cache.size).toBe(1);
		cache.clear();
		expect(cache.size).toBe(0);
	});

	it("iterates entries in LRU order (oldest first)", () => {
		const cache = new BoundedMap<string, number>(3);
		cache.set("a", 1);
		cache.set("b", 2);
		cache.set("c", 3);
		cache.get("a");
		expect([...cache.keys()]).toEqual(["b", "c", "a"]);
		expect([...cache.values()]).toEqual([2, 3, 1]);
		expect([...cache]).toEqual([
			["b", 2],
			["c", 3],
			["a", 1],
		]);
	});

	it("handles undefined values correctly", () => {
		const cache = new BoundedMap<string, number | undefined>(2);
		cache.set("a", undefined);
		expect(cache.has("a")).toBe(true);
		expect(cache.get("a")).toBeUndefined();
		expect(cache.has("a")).toBe(true);
		expect(cache.get("missing")).toBeUndefined();
		expect(cache.has("missing")).toBe(false);
	});
});
