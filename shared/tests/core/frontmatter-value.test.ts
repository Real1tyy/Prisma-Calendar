import * as fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	type DisplaySettings,
	filterPropertiesForDisplay,
	filterSpecificProperties,
	formatArrayCompact,
	formatValue,
	formatValueForNode,
	isEmptyValue,
	normalizeProperties,
	normalizeProperty,
	parseInlineWikiLinks,
	parseValue,
	parseWikiLinkWithDisplay,
	removeWikiLinks,
	serializeValue,
	truncateString,
} from "../../src/core/frontmatter/frontmatter-value";

// ============================================================================
// isEmptyValue Tests
// ============================================================================

describe("isEmptyValue", () => {
	describe("null and undefined", () => {
		it("should return true for null", () => {
			expect(isEmptyValue(null)).toBe(true);
		});

		it("should return true for undefined", () => {
			expect(isEmptyValue(undefined)).toBe(true);
		});
	});

	describe("strings", () => {
		it("should return true for empty string", () => {
			expect(isEmptyValue("")).toBe(true);
		});

		it("should return true for whitespace-only string", () => {
			expect(isEmptyValue("   ")).toBe(true);
			expect(isEmptyValue("\t")).toBe(true);
			expect(isEmptyValue("\n")).toBe(true);
			expect(isEmptyValue(" \t\n ")).toBe(true);
		});

		it("should return false for non-empty string", () => {
			expect(isEmptyValue("hello")).toBe(false);
			expect(isEmptyValue("0")).toBe(false);
			expect(isEmptyValue(" a ")).toBe(false);
		});
	});

	describe("arrays", () => {
		it("should return true for empty array", () => {
			expect(isEmptyValue([])).toBe(true);
		});

		it("should return false for non-empty array", () => {
			expect(isEmptyValue([1])).toBe(false);
			expect(isEmptyValue([null])).toBe(false);
			expect(isEmptyValue([""])).toBe(false);
			expect(isEmptyValue([undefined])).toBe(false);
		});
	});

	describe("other types", () => {
		it("should return false for numbers", () => {
			expect(isEmptyValue(0)).toBe(false);
			expect(isEmptyValue(1)).toBe(false);
			expect(isEmptyValue(-1)).toBe(false);
			expect(isEmptyValue(3.14)).toBe(false);
		});

		it("should return false for booleans", () => {
			expect(isEmptyValue(false)).toBe(false);
			expect(isEmptyValue(true)).toBe(false);
		});

		it("should return false for objects", () => {
			expect(isEmptyValue({})).toBe(false);
			expect(isEmptyValue({ key: "value" })).toBe(false);
		});

		it("should return false for functions", () => {
			expect(isEmptyValue(() => {})).toBe(false);
		});

		it("should return false for symbols", () => {
			expect(isEmptyValue(Symbol("test"))).toBe(false);
		});
	});

	describe("edge cases", () => {
		it("should handle empty object (not empty)", () => {
			expect(isEmptyValue({})).toBe(false);
		});

		it("should handle string with only spaces", () => {
			expect(isEmptyValue("     ")).toBe(true);
		});

		it("should handle zero as not empty", () => {
			expect(isEmptyValue(0)).toBe(false);
		});

		it("should handle false as not empty", () => {
			expect(isEmptyValue(false)).toBe(false);
		});
	});
});

// ============================================================================
// serializeValue Tests
// ============================================================================

describe("serializeValue", () => {
	it("should return empty string for null", () => {
		expect(serializeValue(null)).toBe("");
	});

	it("should return empty string for undefined", () => {
		expect(serializeValue(undefined)).toBe("");
	});

	it("should serialize string values", () => {
		expect(serializeValue("hello")).toBe("hello");
	});

	it("should serialize number values", () => {
		expect(serializeValue(42)).toBe("42");
		expect(serializeValue(3.14)).toBe("3.14");
	});

	it("should serialize boolean values", () => {
		expect(serializeValue(true)).toBe("true");
		expect(serializeValue(false)).toBe("false");
	});

	it("should serialize arrays with comma separation", () => {
		expect(serializeValue(["tag1", "tag2", "tag3"])).toBe("tag1, tag2, tag3");
	});

	it("should serialize nested arrays", () => {
		expect(serializeValue([1, 2, 3])).toBe("1, 2, 3");
	});

	it("should serialize objects as JSON", () => {
		const obj = { key: "value", nested: { prop: 123 } };
		expect(serializeValue(obj)).toBe(JSON.stringify(obj));
	});

	it("should handle mixed array types", () => {
		expect(serializeValue(["text", 123, true])).toBe("text, 123, true");
	});
});

// ============================================================================
// parseValue Tests
// ============================================================================

describe("parseValue", () => {
	it("should return empty string for empty input", () => {
		expect(parseValue("")).toBe("");
		expect(parseValue("   ")).toBe("");
	});

	it("should parse boolean true", () => {
		expect(parseValue("true")).toBe(true);
		expect(parseValue("True")).toBe(true);
		expect(parseValue("TRUE")).toBe(true);
	});

	it("should parse boolean false", () => {
		expect(parseValue("false")).toBe(false);
		expect(parseValue("False")).toBe(false);
		expect(parseValue("FALSE")).toBe(false);
	});

	it("should parse positive integers", () => {
		expect(parseValue("42")).toBe(42);
		expect(parseValue("0")).toBe(0);
	});

	it("should parse negative integers", () => {
		expect(parseValue("-42")).toBe(-42);
	});

	it("should parse decimal numbers", () => {
		expect(parseValue("3.14")).toBe(3.14);
		expect(parseValue("-2.5")).toBe(-2.5);
	});

	it("should parse comma-separated arrays", () => {
		expect(parseValue("tag1, tag2, tag3")).toEqual(["tag1", "tag2", "tag3"]);
	});

	it("should handle arrays with extra whitespace", () => {
		expect(parseValue("  tag1  ,  tag2  ,  tag3  ")).toEqual(["tag1", "tag2", "tag3"]);
	});

	it("should not parse arrays with empty items", () => {
		expect(parseValue("tag1, , tag3")).toBe("tag1, , tag3");
	});

	it("should parse JSON objects", () => {
		const jsonStr = '{"key": "value", "num": 123}';
		expect(parseValue(jsonStr)).toEqual({ key: "value", num: 123 });
	});

	it("should parse JSON arrays", () => {
		const jsonStr = '["item1", "item2", 123]';
		expect(parseValue(jsonStr)).toEqual(["item1", "item2", 123]);
	});

	it("should return string for invalid JSON", () => {
		expect(parseValue("{invalid json}")).toBe("{invalid json}");
		expect(parseValue("[invalid]")).toBe("[invalid]");
	});

	it("should return plain strings", () => {
		expect(parseValue("just a string")).toBe("just a string");
		expect(parseValue("[[wiki link]]")).toBe("[[wiki link]]");
	});

	it("should handle strings that look like numbers but have extra chars", () => {
		expect(parseValue("42px")).toBe("42px");
		expect(parseValue("3.14.159")).toBe("3.14.159");
	});
});

// ============================================================================
// formatValue Tests
// ============================================================================

describe("formatValue", () => {
	it("should format boolean true as 'Yes'", () => {
		expect(formatValue(true)).toBe("Yes");
	});

	it("should format boolean false as 'No'", () => {
		expect(formatValue(false)).toBe("No");
	});

	it("should format numbers as strings", () => {
		expect(formatValue(42)).toBe("42");
		expect(formatValue(3.14)).toBe("3.14");
	});

	it("should format objects as pretty JSON", () => {
		const obj = { key: "value" };
		expect(formatValue(obj)).toBe(JSON.stringify(obj, null, 2));
	});

	it("should format null as string", () => {
		expect(formatValue(null)).toBe("null");
	});

	it("should format strings as-is", () => {
		expect(formatValue("hello")).toBe("hello");
	});

	it("should format arrays as JSON", () => {
		const arr = ["a", "b", "c"];
		expect(formatValue(arr)).toBe(JSON.stringify(arr, null, 2));
	});
});

// ============================================================================
// parseWikiLinkWithDisplay Tests
// ============================================================================

describe("parseWikiLinkWithDisplay", () => {
	it("should parse simple wiki link", () => {
		const result = parseWikiLinkWithDisplay("[[My Note]]");
		expect(result).toEqual({
			linkPath: "My Note",
			displayText: "My Note",
		});
	});

	it("should parse wiki link with alias", () => {
		const result = parseWikiLinkWithDisplay("[[path/to/note|Display Name]]");
		expect(result).toEqual({
			linkPath: "path/to/note",
			displayText: "Display Name",
		});
	});

	it("should handle wiki link with path", () => {
		const result = parseWikiLinkWithDisplay("[[folder/subfolder/note]]");
		expect(result).toEqual({
			linkPath: "folder/subfolder/note",
			displayText: "folder/subfolder/note",
		});
	});

	it("should return null for non-wiki-link strings", () => {
		expect(parseWikiLinkWithDisplay("plain text")).toBeNull();
		expect(parseWikiLinkWithDisplay("[[incomplete")).toBeNull();
		expect(parseWikiLinkWithDisplay("incomplete]]")).toBeNull();
	});

	it("should handle wiki links with whitespace", () => {
		const result = parseWikiLinkWithDisplay("[[  My Note  |  Display  ]]");
		expect(result).toEqual({
			linkPath: "My Note",
			displayText: "Display",
		});
	});

	it("should handle empty wiki links", () => {
		const result = parseWikiLinkWithDisplay("[[]]");
		expect(result).toEqual({
			linkPath: "",
			displayText: "",
		});
	});

	it("should handle multiple pipes (takes first)", () => {
		const result = parseWikiLinkWithDisplay("[[path|alias|extra]]");
		expect(result).toEqual({
			linkPath: "path",
			displayText: "alias|extra",
		});
	});
});

// ============================================================================
// normalizeProperty Tests
// ============================================================================

describe("normalizeProperty", () => {
	beforeEach(() => {
		// Reset console.warn mock before each test
		vi.clearAllMocks();
	});

	describe("Basic type handling", () => {
		it("should return empty array for undefined", () => {
			expect(normalizeProperty(undefined)).toEqual([]);
		});

		it("should return empty array for null", () => {
			expect(normalizeProperty(null)).toEqual([]);
		});

		it("should convert single string to array", () => {
			expect(normalizeProperty("[[link]]")).toEqual(["[[link]]"]);
		});

		it("should return empty array for empty string", () => {
			expect(normalizeProperty("")).toEqual([]);
		});

		it("should return empty array for whitespace-only string", () => {
			expect(normalizeProperty("   ")).toEqual([]);
			expect(normalizeProperty("\t\n  ")).toEqual([]);
		});

		it("should return empty array for numbers", () => {
			expect(normalizeProperty(42, "testProp")).toEqual([]);
		});

		it("should return empty array for booleans", () => {
			expect(normalizeProperty(true, "testProp")).toEqual([]);
			expect(normalizeProperty(false, "testProp")).toEqual([]);
		});

		it("should return empty array for objects", () => {
			expect(normalizeProperty({ key: "value" }, "testProp")).toEqual([]);
		});

		it("should return empty array for functions", () => {
			const fn = () => {};
			expect(normalizeProperty(fn, "testProp")).toEqual([]);
		});

		it("should return empty array for symbols", () => {
			const sym = Symbol("test");
			expect(normalizeProperty(sym, "testProp")).toEqual([]);
		});
	});

	describe("Array handling", () => {
		it("should return empty array for empty array", () => {
			expect(normalizeProperty([])).toEqual([]);
		});

		it("should preserve array of strings", () => {
			expect(normalizeProperty(["[[link1]]", "[[link2]]"])).toEqual(["[[link1]]", "[[link2]]"]);
		});

		it("should filter out non-string values from array silently by default", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			expect(normalizeProperty(["[[link]]", 42, null, undefined, "[[link2]]"], "testProp")).toEqual([
				"[[link]]",
				"[[link2]]",
			]);
			// Should NOT log warnings by default
			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});

		it("should filter out null and undefined silently even with logWarnings enabled", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			expect(
				normalizeProperty(["[[link]]", null, undefined, "[[link2]]"], "testProp", {
					logWarnings: true,
				})
			).toEqual(["[[link]]", "[[link2]]"]);
			// Should NOT log warnings for null/undefined (expected in YAML)
			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});

		it("should log warnings for truly unexpected types when logWarnings is enabled", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			expect(
				normalizeProperty(["[[link]]", 42, true, { key: "value" }], "testProp", {
					logWarnings: true,
				})
			).toEqual(["[[link]]"]);
			// Should log warnings for number, boolean, object
			expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Property "testProp" contains non-string value (number)'),
				42
			);
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Property "testProp" contains non-string value (boolean)'),
				true
			);
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Property "testProp" contains non-string value (object)'),
				{ key: "value" }
			);
		});

		it("should filter out empty strings from array", () => {
			expect(normalizeProperty(["[[link1]]", "", "[[link2]]", "   ", "[[link3]]"])).toEqual([
				"[[link1]]",
				"[[link2]]",
				"[[link3]]",
			]);
		});

		it("should handle array with only invalid values", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			expect(normalizeProperty([42, null, undefined, true], "testProp")).toEqual([]);
			// Should NOT log warnings by default
			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});

		it("should handle array with only null/undefined", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			expect(normalizeProperty([null, undefined, null], "testProp", { logWarnings: true })).toEqual([]);
			// Should NOT log warnings for null/undefined even with logWarnings enabled
			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});

		it("should handle nested arrays", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			expect(normalizeProperty(["[[link]]", ["nested"]], "testProp", { logWarnings: true })).toEqual(["[[link]]"]);
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Property "testProp" contains non-string value'),
				["nested"]
			);
		});

		it("should handle array with objects", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			expect(normalizeProperty(["[[link]]", { key: "value" }], "testProp", { logWarnings: true })).toEqual([
				"[[link]]",
			]);
			expect(consoleWarnSpy).toHaveBeenCalled();
		});
	});

	describe("Obsidian frontmatter formats", () => {
		it("should handle single wikilink", () => {
			expect(normalizeProperty("[[Goals/Health|Health]]")).toEqual(["[[Goals/Health|Health]]"]);
		});

		it("should handle array of wikilinks", () => {
			expect(
				normalizeProperty([
					"[[Goals/Healthy & Body - Keep Feeling Better|Healthy & Body - Keep Feeling Better]]",
					"[[Tags/Health|Health]]",
					"[[Tags/Exercise|Exercise]]",
				])
			).toEqual([
				"[[Goals/Healthy & Body - Keep Feeling Better|Healthy & Body - Keep Feeling Better]]",
				"[[Tags/Health|Health]]",
				"[[Tags/Exercise|Exercise]]",
			]);
		});

		it("should handle plain file references", () => {
			expect(normalizeProperty("path/to/file.md")).toEqual(["path/to/file.md"]);
		});

		it("should handle array of plain file references", () => {
			expect(normalizeProperty(["file1.md", "folder/file2.md"])).toEqual(["file1.md", "folder/file2.md"]);
		});

		it("should handle mixed wikilinks and plain references", () => {
			expect(normalizeProperty(["[[wikilink]]", "plain/path.md"])).toEqual(["[[wikilink]]", "plain/path.md"]);
		});

		it("should handle wikilinks with special characters", () => {
			expect(
				normalizeProperty([
					"[[File with spaces]]",
					"[[File & Ampersand]]",
					"[[File-with-dashes]]",
					"[[File_with_underscores]]",
				])
			).toEqual(["[[File with spaces]]", "[[File & Ampersand]]", "[[File-with-dashes]]", "[[File_with_underscores]]"]);
		});
	});

	describe("Warning logging", () => {
		it("should NOT log warnings by default", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			normalizeProperty(42, "MyProperty");
			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});

		it("should log warning when logWarnings is enabled and propertyName is provided", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			normalizeProperty(42, "MyProperty", { logWarnings: true });
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Property "MyProperty" has unexpected type'),
				42
			);
		});

		it("should not log warning when logWarnings is enabled but propertyName is not provided", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			normalizeProperty(42, undefined, { logWarnings: true });
			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});

		it("should log warning for truly unexpected array items when logWarnings is enabled", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			normalizeProperty(["[[link]]", 42, null], "MyProperty", { logWarnings: true });
			// Should log for 42 (number) but NOT for null (expected)
			expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Property "MyProperty" contains non-string value (number)'),
				42
			);
		});

		it("should handle logWarnings: false explicitly", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			normalizeProperty(42, "MyProperty", { logWarnings: false });
			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});
	});

	describe("Property-based tests with fast-check", () => {
		it("should always return an array", () => {
			fc.assert(
				fc.property(fc.anything(), (value) => {
					const result = normalizeProperty(value);
					expect(Array.isArray(result)).toBe(true);
				})
			);
		});

		it("should only return strings in the array", () => {
			fc.assert(
				fc.property(fc.anything(), (value) => {
					const result = normalizeProperty(value);
					for (const item of result) {
						expect(typeof item).toBe("string");
					}
				})
			);
		});

		it("should not return empty strings", () => {
			fc.assert(
				fc.property(fc.anything(), (value) => {
					const result = normalizeProperty(value);
					for (const item of result) {
						expect(item.trim()).not.toBe("");
					}
				})
			);
		});

		it("should preserve valid string arrays", () => {
			fc.assert(
				fc.property(fc.array(fc.string().filter((s) => s.trim() !== "")), (stringArray) => {
					const result = normalizeProperty(stringArray);
					expect(result).toEqual(stringArray);
				})
			);
		});

		it("should convert single non-empty strings to single-item arrays", () => {
			fc.assert(
				fc.property(
					fc.string().filter((s) => s.trim() !== ""),
					(str) => {
						const result = normalizeProperty(str);
						expect(result).toEqual([str]);
					}
				)
			);
		});

		it("should return empty array for null/undefined", () => {
			fc.assert(
				fc.property(fc.constantFrom(null, undefined), (value) => {
					const result = normalizeProperty(value);
					expect(result).toEqual([]);
				})
			);
		});

		it("should handle mixed arrays with only strings extracted", () => {
			fc.assert(
				fc.property(
					fc.array(
						fc.oneof(
							fc.string().filter((s) => s.trim() !== ""),
							fc.integer(),
							fc.boolean(),
							fc.constant(null),
							fc.constant(undefined)
						)
					),
					(mixedArray) => {
						const result = normalizeProperty(mixedArray);
						const expectedStrings = mixedArray.filter((item) => typeof item === "string" && item.trim() !== "");
						expect(result).toEqual(expectedStrings);
					}
				)
			);
		});

		it("should be idempotent for valid inputs", () => {
			fc.assert(
				fc.property(fc.array(fc.string().filter((s) => s.trim() !== "")), (stringArray) => {
					const firstPass = normalizeProperty(stringArray);
					const secondPass = normalizeProperty(firstPass);
					expect(firstPass).toEqual(secondPass);
				})
			);
		});

		it("should handle deeply nested structures gracefully", () => {
			fc.assert(
				fc.property(
					fc.array(fc.oneof(fc.string(), fc.array(fc.anything()), fc.object(), fc.integer(), fc.constant(null))),
					(complexArray) => {
						const result = normalizeProperty(complexArray);
						// Should always return an array without throwing
						expect(Array.isArray(result)).toBe(true);
					}
				)
			);
		});

		it("should handle large arrays efficiently", () => {
			fc.assert(
				fc.property(fc.array(fc.string(), { minLength: 1000, maxLength: 5000 }), (largeArray) => {
					const start = Date.now();
					const result = normalizeProperty(largeArray);
					const duration = Date.now() - start;

					// Should complete in reasonable time (< 100ms)
					expect(duration).toBeLessThan(100);
					// Should preserve all valid strings
					expect(result.length).toBeLessThanOrEqual(largeArray.length);
				})
			);
		});

		it("should handle wikilink format strings", () => {
			const wikilinkArb = fc
				.tuple(fc.string(), fc.option(fc.string()))
				.map(([path, alias]) => (alias ? `[[${path}|${alias}]]` : `[[${path}]]`));

			fc.assert(
				fc.property(fc.array(wikilinkArb), (wikilinks) => {
					const result = normalizeProperty(wikilinks);
					expect(result).toEqual(wikilinks);
				})
			);
		});
	});

	describe("Edge cases", () => {
		it("should handle BigInt without logging by default", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			expect(normalizeProperty(BigInt(9007199254740991), "testProp")).toEqual([]);
			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});

		it("should handle BigInt with logging when enabled", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			expect(normalizeProperty(BigInt(9007199254740991), "testProp", { logWarnings: true })).toEqual([]);
			expect(consoleWarnSpy).toHaveBeenCalled();
		});

		it("should handle Date objects", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			expect(normalizeProperty(new Date(), "testProp")).toEqual([]);
			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});

		it("should handle RegExp", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			expect(normalizeProperty(/regex/, "testProp")).toEqual([]);
			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});

		it("should handle Map", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			expect(normalizeProperty(new Map(), "testProp")).toEqual([]);
			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});

		it("should handle Set", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			expect(normalizeProperty(new Set(), "testProp")).toEqual([]);
			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});

		it("should handle array with circular references", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const circular: any[] = ["[[link]]"];
			circular.push(circular);
			expect(normalizeProperty(circular, "testProp")).toEqual(["[[link]]"]);
			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});

		it("should handle very long strings", () => {
			const longString = `[[${"a".repeat(10000)}]]`;
			expect(normalizeProperty(longString)).toEqual([longString]);
		});

		it("should handle unicode characters", () => {
			expect(normalizeProperty(["[[文件]]", "[[файл]]", "[[🎯 Goal]]"])).toEqual([
				"[[文件]]",
				"[[файл]]",
				"[[🎯 Goal]]",
			]);
		});

		it("should handle special YAML characters", () => {
			expect(normalizeProperty(["[[file: with colon]]", "[[file | with pipe]]", "[[file # with hash]]"])).toEqual([
				"[[file: with colon]]",
				"[[file | with pipe]]",
				"[[file # with hash]]",
			]);
		});
	});

	describe("Real-world Obsidian frontmatter scenarios", () => {
		it("should handle the reported issue: array with null values", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			// This is the exact scenario from the bug report
			const parent = normalizeProperty(["[[Nexus Properties/S Parent|S Parent]]"], "Parent", {
				logWarnings: true,
			});
			const related = normalizeProperty(
				["[[Nexus Properties/S Related|S Related]]", "[[Nexus Properties/S Related 2|S Related 2]]"],
				"Related",
				{ logWarnings: true }
			);
			const child = normalizeProperty(["[[Nexus Properties/S Child|S Child]]"], "Child", {
				logWarnings: true,
			});

			expect(parent).toEqual(["[[Nexus Properties/S Parent|S Parent]]"]);
			expect(related).toEqual([
				"[[Nexus Properties/S Related|S Related]]",
				"[[Nexus Properties/S Related 2|S Related 2]]",
			]);
			expect(child).toEqual(["[[Nexus Properties/S Child|S Child]]"]);

			// Should NOT have logged any warnings for valid data
			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});

		it("should handle mixed valid and null values silently", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const result = normalizeProperty(["[[Valid Link]]", null, "[[Another Link]]", undefined], "TestProp", {
				logWarnings: true,
			});

			expect(result).toEqual(["[[Valid Link]]", "[[Another Link]]"]);
			// Should NOT log warnings for null/undefined
			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});

		it("should only log warnings for truly problematic values", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const result = normalizeProperty(["[[Valid Link]]", null, 42, undefined, true, "[[Another Link]]"], "TestProp", {
				logWarnings: true,
			});

			expect(result).toEqual(["[[Valid Link]]", "[[Another Link]]"]);
			// Should only log for 42 and true, NOT for null/undefined
			expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("non-string value (number)"), 42);
			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("non-string value (boolean)"), true);
		});

		it("should handle empty frontmatter properties gracefully", () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			expect(normalizeProperty(null, "EmptyProp", { logWarnings: true })).toEqual([]);
			expect(normalizeProperty(undefined, "EmptyProp", { logWarnings: true })).toEqual([]);
			expect(normalizeProperty("", "EmptyProp", { logWarnings: true })).toEqual([]);
			expect(normalizeProperty([], "EmptyProp", { logWarnings: true })).toEqual([]);

			// Should NOT log warnings for empty values
			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});
	});
});

// ============================================================================
// normalizeProperties Tests
// ============================================================================

describe("normalizeProperties", () => {
	it("should normalize multiple properties from frontmatter", () => {
		const frontmatter = {
			parent: "[[Parent]]",
			children: ["[[Child1]]", "[[Child2]]"],
			related: null,
			other: 42,
		};

		const result = normalizeProperties(frontmatter, ["parent", "children", "related", "other"]);

		expect(result.get("parent")).toEqual(["[[Parent]]"]);
		expect(result.get("children")).toEqual(["[[Child1]]", "[[Child2]]"]);
		expect(result.get("related")).toEqual([]);
		expect(result.get("other")).toEqual([]);
	});

	it("should handle missing properties", () => {
		const frontmatter = {
			parent: "[[Parent]]",
		};

		const result = normalizeProperties(frontmatter, ["parent", "children"]);

		expect(result.get("parent")).toEqual(["[[Parent]]"]);
		expect(result.get("children")).toEqual([]);
	});

	it("should return empty map for empty property names array", () => {
		const frontmatter = {
			parent: "[[Parent]]",
		};

		const result = normalizeProperties(frontmatter, []);

		expect(result.size).toBe(0);
	});

	it("should handle empty frontmatter", () => {
		const result = normalizeProperties({}, ["parent", "children"]);

		expect(result.get("parent")).toEqual([]);
		expect(result.get("children")).toEqual([]);
	});

	describe("Property-based tests", () => {
		it("should always return a Map with correct keys", () => {
			fc.assert(
				fc.property(fc.dictionary(fc.string(), fc.anything()), fc.array(fc.string()), (frontmatter, propNames) => {
					const result = normalizeProperties(frontmatter, propNames);
					// Map deduplicates keys, so check unique property names
					const uniquePropNames = [...new Set(propNames)];
					expect(result.size).toBe(uniquePropNames.length);
					for (const name of uniquePropNames) {
						expect(result.has(name)).toBe(true);
					}
				})
			);
		});

		it("should return arrays of strings for all properties", () => {
			fc.assert(
				fc.property(fc.dictionary(fc.string(), fc.anything()), fc.array(fc.string()), (frontmatter, propNames) => {
					const result = normalizeProperties(frontmatter, propNames);
					for (const value of result.values()) {
						expect(Array.isArray(value)).toBe(true);
						for (const item of value) {
							expect(typeof item).toBe("string");
							expect(item.trim()).not.toBe("");
						}
					}
				})
			);
		});
	});
});

// ============================================================================
// String Utility Tests
// ============================================================================

describe("truncateString", () => {
	it("should not truncate strings shorter than maxLength", () => {
		expect(truncateString("short", 10)).toBe("short");
		expect(truncateString("exactly10!", 10)).toBe("exactly10!");
	});

	it("should truncate strings longer than maxLength", () => {
		expect(truncateString("this is a very long string", 10)).toBe("this is a ...");
	});

	it("should handle empty strings", () => {
		expect(truncateString("", 10)).toBe("");
	});

	it("should handle maxLength of 0", () => {
		expect(truncateString("text", 0)).toBe("...");
	});
});

describe("removeWikiLinks", () => {
	it("should remove simple wiki links", () => {
		expect(removeWikiLinks("[[Link]]")).toBe("Link");
	});

	it("should remove wiki links with aliases", () => {
		expect(removeWikiLinks("[[Link|Alias]]")).toBe("Link");
	});

	it("should handle multiple wiki links", () => {
		expect(removeWikiLinks("[[Link1]] and [[Link2|Alias]]")).toBe("Link1 and Link2");
	});

	it("should handle text without wiki links", () => {
		expect(removeWikiLinks("plain text")).toBe("plain text");
	});

	it("should handle nested paths in wiki links", () => {
		expect(removeWikiLinks("[[folder/subfolder/file]]")).toBe("folder/subfolder/file");
	});

	it("should handle empty strings", () => {
		expect(removeWikiLinks("")).toBe("");
	});
});

describe("formatArrayCompact", () => {
	it("should return empty string for empty array", () => {
		expect(formatArrayCompact([], 20)).toBe("");
	});

	it("should return single item without truncation if it fits", () => {
		expect(formatArrayCompact(["item"], 20)).toBe("item");
	});

	it("should truncate single long item", () => {
		expect(formatArrayCompact(["this is a very long item"], 10)).toBe("this is a ...");
	});

	it("should join multiple items if they fit", () => {
		expect(formatArrayCompact(["a", "b", "c"], 20)).toBe("a, b, c");
	});

	it("should show +count when items exceed maxLength", () => {
		const result = formatArrayCompact(["tag1", "tag2", "tag3", "tag4", "tag5"], 15);
		expect(result).toMatch(/\+\d+$/); // Should end with +N
		expect(result.length).toBeLessThanOrEqual(15);
	});

	it("should handle exact fit without truncation", () => {
		expect(formatArrayCompact(["abc", "def"], 8)).toBe("abc, def");
	});

	it("should not produce leading comma for very small maxLength", () => {
		const result = formatArrayCompact(["long-item", "another"], 3);
		expect(result).not.toMatch(/^,/);
		expect(result).toBe("+2");
	});

	it("should not produce leading comma when first item exceeds budget", () => {
		const result = formatArrayCompact(["very-long-item-name", "b", "c"], 5);
		expect(result).not.toMatch(/^,/);
	});
});

// ============================================================================
// Property Filtering Tests
// ============================================================================

describe("filterPropertiesForDisplay", () => {
	it("should return all properties when no filters are set", () => {
		const frontmatter = {
			normal: "value",
			_private: "hidden",
			empty: "",
		};
		const settings: DisplaySettings = {};

		const result = filterPropertiesForDisplay(frontmatter, settings);

		expect(result).toHaveLength(3);
		expect(result.map(([key]) => key)).toEqual(["normal", "_private", "empty"]);
	});

	it("should hide underscore properties when configured", () => {
		const frontmatter = {
			normal: "value",
			_private: "hidden",
			__double: "also hidden",
		};
		const settings: DisplaySettings = {
			hideUnderscoreProperties: true,
		};

		const result = filterPropertiesForDisplay(frontmatter, settings);

		expect(result).toHaveLength(1);
		expect(result[0][0]).toBe("normal");
	});

	it("should hide empty properties when configured", () => {
		const frontmatter = {
			filled: "value",
			empty: "",
			nullValue: null,
			undefinedValue: undefined,
			emptyArray: [],
		};
		const settings: DisplaySettings = {
			hideEmptyProperties: true,
		};

		const result = filterPropertiesForDisplay(frontmatter, settings);

		expect(result).toHaveLength(1);
		expect(result[0][0]).toBe("filled");
	});

	it("should apply both filters when both are enabled", () => {
		const frontmatter = {
			normal: "value",
			_private: "hidden",
			empty: "",
			_empty: "",
		};
		const settings: DisplaySettings = {
			hideUnderscoreProperties: true,
			hideEmptyProperties: true,
		};

		const result = filterPropertiesForDisplay(frontmatter, settings);

		expect(result).toHaveLength(1);
		expect(result[0][0]).toBe("normal");
	});
});

describe("filterSpecificProperties", () => {
	it("should return only requested properties when no filters are set", () => {
		const frontmatter = {
			prop1: "value1",
			prop2: "value2",
			prop3: "value3",
		};
		const settings: DisplaySettings = {};

		const result = filterSpecificProperties(frontmatter, ["prop1", "prop3"], settings);

		expect(result).toHaveLength(2);
		expect(result.map((p) => p.key)).toEqual(["prop1", "prop3"]);
	});

	it("should hide underscore properties when configured", () => {
		const frontmatter = {
			normal: "value",
			_private: "hidden",
		};
		const settings: DisplaySettings = {
			hideUnderscoreProperties: true,
		};

		const result = filterSpecificProperties(frontmatter, ["normal", "_private"], settings);

		expect(result).toHaveLength(1);
		expect(result[0].key).toBe("normal");
	});

	it("should hide empty properties when configured", () => {
		const frontmatter = {
			filled: "value",
			empty: "",
		};
		const settings: DisplaySettings = {
			hideEmptyProperties: true,
		};

		const result = filterSpecificProperties(frontmatter, ["filled", "empty"], settings);

		expect(result).toHaveLength(1);
		expect(result[0].key).toBe("filled");
	});

	it("should handle missing properties gracefully", () => {
		const frontmatter = {
			prop1: "value1",
		};
		const settings: DisplaySettings = {};

		const result = filterSpecificProperties(frontmatter, ["prop1", "missing"], settings);

		expect(result).toHaveLength(1);
		expect(result[0].key).toBe("prop1");
	});
});

// ============================================================================
// Inline Wiki Link Parsing Tests
// ============================================================================

describe("parseInlineWikiLinks", () => {
	it("should parse text with single wiki link", () => {
		const result = parseInlineWikiLinks("Visit [[Page1]] now");
		expect(result).toEqual([
			{ type: "text", content: "Visit " },
			{ type: "link", content: "[[Page1]]", linkPath: "Page1", displayText: "Page1" },
			{ type: "text", content: " now" },
		]);
	});

	it("should parse text with multiple wiki links", () => {
		const result = parseInlineWikiLinks("Visit [[Page1]] and [[Page2|Second Page]]");
		expect(result).toEqual([
			{ type: "text", content: "Visit " },
			{ type: "link", content: "[[Page1]]", linkPath: "Page1", displayText: "Page1" },
			{ type: "text", content: " and " },
			{
				type: "link",
				content: "[[Page2|Second Page]]",
				linkPath: "Page2",
				displayText: "Second Page",
			},
		]);
	});

	it("should return single text segment when no links found", () => {
		const result = parseInlineWikiLinks("plain text without links");
		expect(result).toEqual([{ type: "text", content: "plain text without links" }]);
	});

	it("should handle text starting with wiki link", () => {
		const result = parseInlineWikiLinks("[[Start]] and more");
		expect(result).toEqual([
			{ type: "link", content: "[[Start]]", linkPath: "Start", displayText: "Start" },
			{ type: "text", content: " and more" },
		]);
	});

	it("should handle text ending with wiki link", () => {
		const result = parseInlineWikiLinks("Start and [[End]]");
		expect(result).toEqual([
			{ type: "text", content: "Start and " },
			{ type: "link", content: "[[End]]", linkPath: "End", displayText: "End" },
		]);
	});

	it("should handle empty string", () => {
		const result = parseInlineWikiLinks("");
		expect(result).toEqual([{ type: "text", content: "" }]);
	});
});

// ============================================================================
// Node Display Formatting Tests
// ============================================================================

describe("formatValueForNode", () => {
	describe("empty values", () => {
		it("should return empty string for null/undefined", () => {
			expect(formatValueForNode(null)).toBe("");
			expect(formatValueForNode(undefined)).toBe("");
		});

		it("should return empty string for empty string", () => {
			expect(formatValueForNode("")).toBe("");
			expect(formatValueForNode("   ")).toBe("");
		});

		it("should return empty string for empty array", () => {
			expect(formatValueForNode([])).toBe("");
		});
	});

	describe("booleans", () => {
		it("should format true as Yes", () => {
			expect(formatValueForNode(true)).toBe("Yes");
		});

		it("should format false as No", () => {
			expect(formatValueForNode(false)).toBe("No");
		});
	});

	describe("numbers", () => {
		it("should format numbers as strings", () => {
			expect(formatValueForNode(42)).toBe("42");
			expect(formatValueForNode(0)).toBe("0");
			expect(formatValueForNode(-10.5)).toBe("-10.5");
		});
	});

	describe("strings", () => {
		it("should remove wiki links", () => {
			expect(formatValueForNode("[[Link]]")).toBe("Link");
			expect(formatValueForNode("[[Link|Alias]]")).toBe("Link");
		});

		it("should truncate long strings", () => {
			const result = formatValueForNode("this is a very long string that exceeds limit", 10);
			expect(result).toBe("this is a ...");
		});

		it("should not truncate short strings", () => {
			expect(formatValueForNode("short", 20)).toBe("short");
		});
	});

	describe("arrays", () => {
		it("should format array of strings", () => {
			expect(formatValueForNode(["a", "b", "c"])).toBe("a, b, c");
		});

		it("should filter out non-string values", () => {
			expect(formatValueForNode(["a", 42, "b", null, "c"])).toBe("a, b, c");
		});

		it("should truncate long arrays", () => {
			const result = formatValueForNode(["tag1", "tag2", "tag3", "tag4", "tag5"], 15);
			expect(result).toMatch(/\+\d+$/);
		});

		it("should return empty for array of non-strings", () => {
			expect(formatValueForNode([1, 2, 3])).toBe("");
		});
	});

	describe("objects", () => {
		it("should stringify and truncate objects", () => {
			const obj = { key1: "value1", key2: "value2", key3: "value3" };
			const result = formatValueForNode(obj, 20);
			expect(result).toContain("{");
			expect(result.length).toBeLessThanOrEqual(23); // 20 + "..."
		});
	});

	describe("custom maxLength", () => {
		it("should respect custom maxLength parameter", () => {
			const result = formatValueForNode("this is a test string", 8);
			expect(result).toBe("this is ...");
		});
	});
});
