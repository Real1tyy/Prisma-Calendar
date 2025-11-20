import { describe, expect, it } from "vitest";
import { isNotEmpty, parsePositiveInt } from "../../src/utils/value-checks";

describe("isNotEmpty", () => {
	it("should return false for undefined", () => {
		expect(isNotEmpty(undefined)).toBe(false);
	});

	it("should return false for null", () => {
		expect(isNotEmpty(null)).toBe(false);
	});

	it("should return false for empty string", () => {
		expect(isNotEmpty("")).toBe(false);
	});

	it("should return false for empty array", () => {
		expect(isNotEmpty([])).toBe(false);
	});

	it("should return true for non-empty string", () => {
		expect(isNotEmpty("hello")).toBe(true);
	});

	it("should return true for non-empty array", () => {
		expect(isNotEmpty([1, 2, 3])).toBe(true);
	});

	it("should return true for number 0", () => {
		expect(isNotEmpty(0)).toBe(true);
	});

	it("should return true for boolean false", () => {
		expect(isNotEmpty(false)).toBe(true);
	});

	it("should return true for objects", () => {
		expect(isNotEmpty({})).toBe(true);
	});
});

describe("parsePositiveInt", () => {
	describe("valid positive integers", () => {
		it("should parse number type correctly", () => {
			expect(parsePositiveInt(5, 10)).toBe(5);
		});

		it("should parse string number correctly", () => {
			expect(parsePositiveInt("7", 10)).toBe(7);
		});

		it("should parse large numbers correctly", () => {
			expect(parsePositiveInt(1000, 10)).toBe(1000);
			expect(parsePositiveInt("999", 10)).toBe(999);
		});
	});

	describe("invalid or non-positive values", () => {
		it("should return fallback for undefined", () => {
			expect(parsePositiveInt(undefined, 10)).toBe(10);
		});

		it("should return fallback for null", () => {
			expect(parsePositiveInt(null, 10)).toBe(10);
		});

		it("should return fallback for zero", () => {
			expect(parsePositiveInt(0, 10)).toBe(10);
			expect(parsePositiveInt("0", 10)).toBe(10);
		});

		it("should return fallback for negative numbers", () => {
			expect(parsePositiveInt(-5, 10)).toBe(10);
			expect(parsePositiveInt("-3", 10)).toBe(10);
		});

		it("should return fallback for NaN strings", () => {
			expect(parsePositiveInt("abc", 10)).toBe(10);
			expect(parsePositiveInt("", 10)).toBe(10);
		});

		it("should return fallback for invalid types", () => {
			expect(parsePositiveInt({}, 10)).toBe(10);
			expect(parsePositiveInt([], 10)).toBe(10);
			expect(parsePositiveInt(true, 10)).toBe(10);
		});
	});

	describe("edge cases", () => {
		it("should handle decimal strings by truncating", () => {
			expect(parsePositiveInt("5.7", 10)).toBe(5);
			expect(parsePositiveInt("3.14", 10)).toBe(3);
		});

		it("should handle strings with whitespace", () => {
			expect(parsePositiveInt(" 5 ", 10)).toBe(5);
			expect(parsePositiveInt("\t7\n", 10)).toBe(7);
		});

		it("should handle strings with leading zeros", () => {
			expect(parsePositiveInt("007", 10)).toBe(7);
			expect(parsePositiveInt("00100", 10)).toBe(100);
		});

		it("should handle mixed valid/invalid strings", () => {
			expect(parsePositiveInt("5abc", 10)).toBe(5);
			expect(parsePositiveInt("123xyz", 10)).toBe(123);
		});
	});

	describe("frontmatter type scenarios", () => {
		it("should handle YAML number values", () => {
			const frontmatter = { count: 5 };
			expect(parsePositiveInt(frontmatter.count, 10)).toBe(5);
		});

		it("should handle YAML string values", () => {
			const frontmatter = { count: "8" };
			expect(parsePositiveInt(frontmatter.count, 10)).toBe(8);
		});

		it("should handle missing frontmatter properties", () => {
			const frontmatter: Record<string, unknown> = {};
			expect(parsePositiveInt(frontmatter.count, 10)).toBe(10);
		});

		it("should handle null frontmatter values", () => {
			const frontmatter = { count: null };
			expect(parsePositiveInt(frontmatter.count, 10)).toBe(10);
		});
	});
});
