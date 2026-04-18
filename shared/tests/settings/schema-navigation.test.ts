import { describe, expect, it } from "vitest";

import { getNestedValue, setNestedValue } from "../../src/core/settings/schema-navigation";

describe("getNestedValue", () => {
	it("reads a top-level key", () => {
		expect(getNestedValue({ a: 1 }, "a")).toBe(1);
	});

	it("reads a nested key", () => {
		expect(getNestedValue({ a: { b: { c: 7 } } }, "a.b.c")).toBe(7);
	});

	it("returns undefined when the path is missing", () => {
		expect(getNestedValue({ a: {} }, "a.b.c")).toBeUndefined();
		expect(getNestedValue({}, "a.b")).toBeUndefined();
	});

	it("returns undefined when traversing through null", () => {
		expect(getNestedValue({ a: null as unknown as Record<string, unknown> }, "a.b")).toBeUndefined();
	});
});

describe("setNestedValue", () => {
	it("sets a top-level key", () => {
		expect(setNestedValue({ a: 1, b: 2 }, "b", 20)).toEqual({ a: 1, b: 20 });
	});

	it("sets a deeply nested key", () => {
		expect(setNestedValue({ a: { b: { c: 1 } } }, "a.b.c", 2)).toEqual({ a: { b: { c: 2 } } });
	});

	it("creates missing intermediate branches", () => {
		expect(setNestedValue({}, "a.b.c", 1)).toEqual({ a: { b: { c: 1 } } });
	});

	it("returns a new root object without mutating the input", () => {
		const input = { a: { b: 1 } };
		const out = setNestedValue(input, "a.b", 2);
		expect(out).not.toBe(input);
		expect(input).toEqual({ a: { b: 1 } });
	});

	it("shares references for sibling branches (copy-on-write)", () => {
		const siblingBranch = { x: 1, y: 2 };
		const input = { a: { b: 1 }, untouched: siblingBranch };
		const out = setNestedValue(input, "a.b", 2);
		expect(out.untouched).toBe(siblingBranch);
	});

	it("allows the terminal value to be an array", () => {
		expect(setNestedValue({ a: { tags: ["x"] } }, "a.tags", ["y", "z"])).toEqual({ a: { tags: ["y", "z"] } });
	});
});
