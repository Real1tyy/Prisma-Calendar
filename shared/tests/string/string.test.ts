import { describe, expect, it } from "vitest";

import { capitalize, getWeekDirection, pluralize } from "../../src/utils/string/string";

describe("capitalize", () => {
	it("capitalizes a lowercase word", () => {
		expect(capitalize("hello")).toBe("Hello");
	});

	it("lowercases the rest of the string", () => {
		expect(capitalize("HELLO")).toBe("Hello");
	});

	it("handles a single character", () => {
		expect(capitalize("a")).toBe("A");
	});

	it("handles a single uppercase character", () => {
		expect(capitalize("A")).toBe("A");
	});

	it("returns empty string for empty input", () => {
		expect(capitalize("")).toBe("");
	});

	it("handles mixed case input", () => {
		expect(capitalize("hELLO")).toBe("Hello");
	});

	it("handles string with spaces", () => {
		expect(capitalize("hello world")).toBe("Hello world");
	});
});

describe("pluralize", () => {
	it("returns empty string for count of 1", () => {
		expect(pluralize(1)).toBe("");
	});

	it("returns 's' for count of 0", () => {
		expect(pluralize(0)).toBe("s");
	});

	it("returns 's' for count of 2", () => {
		expect(pluralize(2)).toBe("s");
	});

	it("returns 's' for large counts", () => {
		expect(pluralize(100)).toBe("s");
	});

	it("returns 's' for negative counts", () => {
		expect(pluralize(-1)).toBe("s");
	});
});

describe("getWeekDirection", () => {
	it("returns 'next' for positive weeks", () => {
		expect(getWeekDirection(1)).toBe("next");
	});

	it("returns 'next' for large positive weeks", () => {
		expect(getWeekDirection(52)).toBe("next");
	});

	it("returns 'previous' for negative weeks", () => {
		expect(getWeekDirection(-1)).toBe("previous");
	});

	it("returns 'previous' for zero weeks", () => {
		expect(getWeekDirection(0)).toBe("previous");
	});

	it("returns 'previous' for large negative weeks", () => {
		expect(getWeekDirection(-52)).toBe("previous");
	});
});
