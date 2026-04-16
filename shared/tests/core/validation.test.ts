import { describe, expect, it } from "vitest";
import { isNotEmpty, parsePositiveInt } from "../../src/core/validation";

describe("isNotEmpty", () => {
	describe("returns false for empty values", () => {
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
	});

	describe("returns true for non-empty values", () => {
		it("should return true for non-empty string", () => {
			expect(isNotEmpty("hello")).toBe(true);
			expect(isNotEmpty(" ")).toBe(true);
			expect(isNotEmpty("0")).toBe(true);
		});

		it("should return true for numbers", () => {
			expect(isNotEmpty(0)).toBe(true);
			expect(isNotEmpty(1)).toBe(true);
			expect(isNotEmpty(-1)).toBe(true);
			expect(isNotEmpty(3.14)).toBe(true);
			expect(isNotEmpty(Number.NaN)).toBe(true);
		});

		it("should return true for boolean values", () => {
			expect(isNotEmpty(true)).toBe(true);
			expect(isNotEmpty(false)).toBe(true);
		});

		it("should return true for non-empty arrays", () => {
			expect(isNotEmpty([1])).toBe(true);
			expect(isNotEmpty([1, 2, 3])).toBe(true);
			expect(isNotEmpty([""])).toBe(true);
			expect(isNotEmpty([null])).toBe(true);
		});

		it("should return true for objects", () => {
			expect(isNotEmpty({})).toBe(true);
			expect(isNotEmpty({ key: "value" })).toBe(true);
		});

		it("should return true for functions", () => {
			expect(isNotEmpty(() => {})).toBe(true);
			expect(isNotEmpty(() => 1)).toBe(true);
		});

		it("should return true for Date objects", () => {
			expect(isNotEmpty(new Date())).toBe(true);
		});

		it("should return true for RegExp", () => {
			expect(isNotEmpty(/test/)).toBe(true);
		});
	});

	describe("edge cases", () => {
		it("should handle whitespace-only strings as non-empty", () => {
			expect(isNotEmpty(" ")).toBe(true);
			expect(isNotEmpty("\t")).toBe(true);
			expect(isNotEmpty("\n")).toBe(true);
		});

		it("should handle special number values", () => {
			expect(isNotEmpty(Number.POSITIVE_INFINITY)).toBe(true);
			expect(isNotEmpty(Number.NEGATIVE_INFINITY)).toBe(true);
		});

		it("should handle nested empty arrays", () => {
			expect(isNotEmpty([[]])).toBe(true); // Array with one element (empty array)
		});
	});
});

describe("parsePositiveInt", () => {
	describe("returns fallback for invalid values", () => {
		it("should return fallback for undefined", () => {
			expect(parsePositiveInt(undefined, 10)).toBe(10);
		});

		it("should return fallback for null", () => {
			expect(parsePositiveInt(null, 5)).toBe(5);
		});

		it("should return fallback for NaN string", () => {
			expect(parsePositiveInt("not a number", 15)).toBe(15);
		});

		it("should return fallback for empty string", () => {
			expect(parsePositiveInt("", 20)).toBe(20);
		});

		it("should return fallback for zero", () => {
			expect(parsePositiveInt(0, 25)).toBe(25);
		});

		it("should return fallback for negative numbers", () => {
			expect(parsePositiveInt(-5, 30)).toBe(30);
			expect(parsePositiveInt("-10", 35)).toBe(35);
		});

		it("should return fallback for objects", () => {
			expect(parsePositiveInt({}, 40)).toBe(40);
		});

		it("should return fallback for arrays", () => {
			expect(parsePositiveInt([], 45)).toBe(45);
			expect(parsePositiveInt([1, 2], 50)).toBe(1); // Arrays convert to string, [1,2] -> "1,2" -> parseInt -> 1
		});
	});

	describe("parses valid positive integers", () => {
		it("should parse positive numbers", () => {
			expect(parsePositiveInt(1, 0)).toBe(1);
			expect(parsePositiveInt(42, 0)).toBe(42);
			expect(parsePositiveInt(999, 0)).toBe(999);
		});

		it("should parse positive number strings", () => {
			expect(parsePositiveInt("1", 0)).toBe(1);
			expect(parsePositiveInt("42", 0)).toBe(42);
			expect(parsePositiveInt("999", 0)).toBe(999);
		});

		it("should truncate decimal numbers", () => {
			expect(parsePositiveInt(3.14, 0)).toBe(3);
			expect(parsePositiveInt(9.99, 0)).toBe(9);
		});

		it("should truncate decimal strings", () => {
			expect(parsePositiveInt("3.14", 0)).toBe(3);
			expect(parsePositiveInt("9.99", 0)).toBe(9);
		});
	});

	describe("handles edge cases", () => {
		it("should handle very large numbers", () => {
			expect(parsePositiveInt(1000000, 0)).toBe(1000000);
			expect(parsePositiveInt("1000000", 0)).toBe(1000000);
		});

		it("should handle numbers with leading zeros", () => {
			expect(parsePositiveInt("007", 0)).toBe(7);
			expect(parsePositiveInt("0042", 0)).toBe(42);
		});

		it("should handle numbers with whitespace", () => {
			expect(parsePositiveInt(" 42 ", 0)).toBe(42);
			expect(parsePositiveInt("\t10\n", 0)).toBe(10);
		});

		it("should return fallback for strings starting with non-numeric characters", () => {
			expect(parsePositiveInt("abc123", 99)).toBe(99);
			expect(parsePositiveInt("x42", 99)).toBe(99);
		});

		it("should parse numbers at start of string", () => {
			expect(parsePositiveInt("42abc", 0)).toBe(42);
			expect(parsePositiveInt("123xyz", 0)).toBe(123);
		});

		it("should handle boolean values", () => {
			expect(parsePositiveInt(true, 99)).toBe(99); // true -> "true" -> NaN -> fallback
			expect(parsePositiveInt(false, 99)).toBe(99); // false -> "false" -> NaN -> fallback
		});

		it("should use different fallback values", () => {
			expect(parsePositiveInt(null, 1)).toBe(1);
			expect(parsePositiveInt(null, 100)).toBe(100);
			expect(parsePositiveInt(null, 9999)).toBe(9999);
		});
	});

	describe("real-world usage patterns", () => {
		it("should handle frontmatter number values", () => {
			const frontmatterValue: unknown = 5;
			expect(parsePositiveInt(frontmatterValue, 1)).toBe(5);
		});

		it("should handle frontmatter string values", () => {
			const frontmatterValue: unknown = "10";
			expect(parsePositiveInt(frontmatterValue, 1)).toBe(10);
		});

		it("should handle missing frontmatter values", () => {
			const frontmatterValue: unknown = undefined;
			expect(parsePositiveInt(frontmatterValue, 7)).toBe(7);
		});

		it("should handle pagination defaults", () => {
			expect(parsePositiveInt(undefined, 10)).toBe(10); // Default page size
			expect(parsePositiveInt("20", 10)).toBe(20); // User-provided page size
			expect(parsePositiveInt(-5, 10)).toBe(10); // Invalid, use default
		});

		it("should handle priority values", () => {
			expect(parsePositiveInt("high", 5)).toBe(5); // Invalid string
			expect(parsePositiveInt("1", 5)).toBe(1); // Low priority
			expect(parsePositiveInt("10", 5)).toBe(10); // High priority
			expect(parsePositiveInt(0, 5)).toBe(5); // Zero not allowed
		});
	});
});
