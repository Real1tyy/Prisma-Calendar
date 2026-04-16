import { describe, expect, it } from "vitest";

import { parseFrontmatterRecord, parseFrontmatterValue, serializeFrontmatterValue } from "../../src/core/frontmatter";

describe("frontmatter", () => {
	describe("serializeFrontmatterValue", () => {
		it("should serialize strings as-is", () => {
			expect(serializeFrontmatterValue("hello")).toBe("hello");
		});

		it("should serialize numbers to strings", () => {
			expect(serializeFrontmatterValue(42)).toBe("42");
			expect(serializeFrontmatterValue(3.14)).toBe("3.14");
			expect(serializeFrontmatterValue(-10)).toBe("-10");
		});

		it("should serialize booleans to strings", () => {
			expect(serializeFrontmatterValue(true)).toBe("true");
			expect(serializeFrontmatterValue(false)).toBe("false");
		});

		it("should serialize arrays to JSON", () => {
			expect(serializeFrontmatterValue([])).toBe("[]");
			expect(serializeFrontmatterValue(["tag1", "tag2"])).toBe('["tag1","tag2"]');
			expect(serializeFrontmatterValue([1, 2, 3])).toBe("[1,2,3]");
		});

		it("should serialize objects to JSON", () => {
			expect(serializeFrontmatterValue({})).toBe("{}");
			expect(serializeFrontmatterValue({ key: "value" })).toBe('{"key":"value"}');
		});

		it("should return empty string for null/undefined", () => {
			expect(serializeFrontmatterValue(null)).toBe("");
			expect(serializeFrontmatterValue(undefined)).toBe("");
		});
	});

	describe("parseFrontmatterValue", () => {
		it("should parse strings as-is", () => {
			expect(parseFrontmatterValue("hello world")).toBe("hello world");
			expect(parseFrontmatterValue("some text")).toBe("some text");
		});

		it("should parse boolean strings to booleans", () => {
			expect(parseFrontmatterValue("true")).toBe(true);
			expect(parseFrontmatterValue("false")).toBe(false);
		});

		it("should parse integer strings to numbers", () => {
			expect(parseFrontmatterValue("42")).toBe(42);
			expect(parseFrontmatterValue("-10")).toBe(-10);
			expect(parseFrontmatterValue("0")).toBe(0);
		});

		it("should parse float strings to numbers", () => {
			expect(parseFrontmatterValue("3.14")).toBe(3.14);
			expect(parseFrontmatterValue("-2.5")).toBe(-2.5);
		});

		it("should parse JSON arrays", () => {
			expect(parseFrontmatterValue("[]")).toEqual([]);
			expect(parseFrontmatterValue('["tag1","tag2"]')).toEqual(["tag1", "tag2"]);
			expect(parseFrontmatterValue("[1,2,3]")).toEqual([1, 2, 3]);
		});

		it("should parse JSON objects", () => {
			expect(parseFrontmatterValue("{}")).toEqual({});
			expect(parseFrontmatterValue('{"key":"value"}')).toEqual({ key: "value" });
		});

		it("should parse null", () => {
			expect(parseFrontmatterValue("null")).toBe(null);
		});

		it("should return empty string for empty input", () => {
			expect(parseFrontmatterValue("")).toBe("");
		});

		it("should return string for invalid JSON", () => {
			expect(parseFrontmatterValue("[invalid")).toBe("[invalid");
			expect(parseFrontmatterValue("{broken}")).toBe("{broken}");
		});

		it("should not parse strings that look like numbers but have text", () => {
			expect(parseFrontmatterValue("42px")).toBe("42px");
			expect(parseFrontmatterValue("3.14.15")).toBe("3.14.15");
		});
	});

	describe("parseFrontmatterRecord", () => {
		it("should parse a record of string values to their correct types", () => {
			const input = {
				title: "My Event",
				count: "42",
				rating: "4.5",
				enabled: "true",
				disabled: "false",
				tags: '["tag1","tag2"]',
				metadata: '{"key":"value"}',
				empty: "[]",
			};

			const result = parseFrontmatterRecord(input);

			expect(result.title).toBe("My Event");
			expect(result.count).toBe(42);
			expect(result.rating).toBe(4.5);
			expect(result.enabled).toBe(true);
			expect(result.disabled).toBe(false);
			expect(result.tags).toEqual(["tag1", "tag2"]);
			expect(result.metadata).toEqual({ key: "value" });
			expect(result.empty).toEqual([]);
		});

		it("should handle mixed types correctly", () => {
			const input = {
				text: "some text",
				number: "123",
				bool: "false",
			};

			const result = parseFrontmatterRecord(input);

			expect(result.text).toBe("some text");
			expect(result.number).toBe(123);
			expect(result.bool).toBe(false);
		});

		it("should handle empty record", () => {
			expect(parseFrontmatterRecord({})).toEqual({});
		});
	});

	describe("round-trip serialization", () => {
		it("should maintain type through serialize -> parse cycle", () => {
			// Numbers
			expect(parseFrontmatterValue(serializeFrontmatterValue(42))).toBe(42);
			expect(parseFrontmatterValue(serializeFrontmatterValue(3.14))).toBe(3.14);

			// Booleans
			expect(parseFrontmatterValue(serializeFrontmatterValue(true))).toBe(true);
			expect(parseFrontmatterValue(serializeFrontmatterValue(false))).toBe(false);

			// Arrays
			expect(parseFrontmatterValue(serializeFrontmatterValue([]))).toEqual([]);
			expect(parseFrontmatterValue(serializeFrontmatterValue(["a", "b"]))).toEqual(["a", "b"]);

			// Objects
			expect(parseFrontmatterValue(serializeFrontmatterValue({}))).toEqual({});
			expect(parseFrontmatterValue(serializeFrontmatterValue({ key: "value" }))).toEqual({
				key: "value",
			});

			// Strings
			expect(parseFrontmatterValue(serializeFrontmatterValue("hello"))).toBe("hello");
		});
	});
});
