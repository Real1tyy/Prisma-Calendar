import { describe, expect, it } from "vitest";
import { parseIntoList } from "../../src/utils/list-utils";

describe("parseIntoList", () => {
	describe("null and undefined values", () => {
		it("should return empty array for null", () => {
			expect(parseIntoList(null)).toEqual([]);
		});

		it("should return empty array for undefined", () => {
			expect(parseIntoList(undefined)).toEqual([]);
		});

		it("should return default value for null when specified", () => {
			expect(parseIntoList(null, { defaultValue: ["default"] })).toEqual(["default"]);
		});

		it("should return default value for undefined when specified", () => {
			expect(parseIntoList(undefined, { defaultValue: ["No Category"] })).toEqual(["No Category"]);
		});
	});

	describe("string values", () => {
		it("should convert single string to array", () => {
			expect(parseIntoList("work")).toEqual(["work"]);
		});

		it("should split comma-separated string", () => {
			expect(parseIntoList("work, meeting, important")).toEqual(["work", "meeting", "important"]);
		});

		it("should trim whitespace from items", () => {
			expect(parseIntoList("  work  ,  meeting  ")).toEqual(["work", "meeting"]);
		});

		it("should filter empty strings after split", () => {
			expect(parseIntoList("work,,meeting")).toEqual(["work", "meeting"]);
		});

		it("should return default for empty string", () => {
			expect(parseIntoList("")).toEqual([]);
			expect(parseIntoList("", { defaultValue: ["default"] })).toEqual(["default"]);
		});

		it("should return default for whitespace-only string", () => {
			expect(parseIntoList("   ")).toEqual([]);
			expect(parseIntoList("   ", { defaultValue: ["default"] })).toEqual(["default"]);
		});

		it("should not split commas when splitCommas is false", () => {
			expect(parseIntoList("work, meeting", { splitCommas: false })).toEqual(["work, meeting"]);
		});
	});

	describe("array values", () => {
		it("should handle array of strings", () => {
			expect(parseIntoList(["work", "meeting"])).toEqual(["work", "meeting"]);
		});

		it("should trim strings in array", () => {
			expect(parseIntoList(["  work  ", "  meeting  "])).toEqual(["work", "meeting"]);
		});

		it("should filter empty strings in array", () => {
			expect(parseIntoList(["work", "", "meeting"])).toEqual(["work", "meeting"]);
		});

		it("should split comma-separated strings in array", () => {
			expect(parseIntoList(["work, meeting", "important"])).toEqual(["work", "meeting", "important"]);
		});

		it("should not split commas in array when splitCommas is false", () => {
			expect(parseIntoList(["work, meeting", "important"], { splitCommas: false })).toEqual([
				"work, meeting",
				"important",
			]);
		});

		it("should return default for empty array", () => {
			expect(parseIntoList([])).toEqual([]);
			expect(parseIntoList([], { defaultValue: ["default"] })).toEqual(["default"]);
		});

		it("should convert numbers in array to strings", () => {
			expect(parseIntoList([1, 2, 3])).toEqual(["1", "2", "3"]);
		});

		it("should handle mixed array of strings and numbers", () => {
			expect(parseIntoList(["work", 123, "meeting"])).toEqual(["work", "123", "meeting"]);
		});
	});

	describe("number values", () => {
		it("should convert number to string array", () => {
			expect(parseIntoList(123)).toEqual(["123"]);
		});

		it("should convert zero to string array", () => {
			expect(parseIntoList(0)).toEqual(["0"]);
		});

		it("should convert negative number to string array", () => {
			expect(parseIntoList(-5)).toEqual(["-5"]);
		});

		it("should convert decimal number to string array", () => {
			expect(parseIntoList(3.14)).toEqual(["3.14"]);
		});
	});

	describe("other types", () => {
		it("should return default for object", () => {
			expect(parseIntoList({ key: "value" })).toEqual([]);
		});

		it("should return default for boolean", () => {
			expect(parseIntoList(true)).toEqual([]);
			expect(parseIntoList(false)).toEqual([]);
		});

		it("should return default for function", () => {
			expect(parseIntoList(() => {})).toEqual([]);
		});
	});

	describe("real-world use cases", () => {
		it("should handle category frontmatter value (single)", () => {
			expect(parseIntoList("Work")).toEqual(["Work"]);
		});

		it("should handle category frontmatter value (multiple)", () => {
			expect(parseIntoList("Work, Personal, Important")).toEqual(["Work", "Personal", "Important"]);
		});

		it("should handle category frontmatter value (array)", () => {
			expect(parseIntoList(["Work", "Personal"])).toEqual(["Work", "Personal"]);
		});

		it("should handle ICS categories (comma-separated in single string)", () => {
			expect(parseIntoList("work,meeting,important")).toEqual(["work", "meeting", "important"]);
		});

		it("should provide default for missing category", () => {
			expect(parseIntoList(undefined, { defaultValue: ["No Category"] })).toEqual(["No Category"]);
		});
	});
});
