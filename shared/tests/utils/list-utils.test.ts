import { describe, expect, it } from "vitest";

import {
	areSetsEqual,
	formatListLikeOriginal,
	parseCategories,
	parseIntoList,
	parseLinkedList,
} from "../../src/utils/list-utils";

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

describe("formatListLikeOriginal", () => {
	it("should return undefined for empty array when original was string", () => {
		expect(formatListLikeOriginal([], "original")).toBeUndefined();
	});

	it("should return empty array when original was array", () => {
		expect(formatListLikeOriginal([], ["original"])).toEqual([]);
	});

	it("should return array when original was array", () => {
		expect(formatListLikeOriginal(["a", "b"], ["original"])).toEqual(["a", "b"]);
	});

	it("should return comma-separated string when original was string", () => {
		expect(formatListLikeOriginal(["a", "b", "c"], "original")).toBe("a, b, c");
	});

	it("should return array for unknown types", () => {
		expect(formatListLikeOriginal(["a", "b"], 123)).toEqual(["a", "b"]);
	});

	it("should handle single item array with string original", () => {
		expect(formatListLikeOriginal(["a"], "original")).toBe("a");
	});

	it("should handle single item array with array original", () => {
		expect(formatListLikeOriginal(["a"], ["original"])).toEqual(["a"]);
	});

	it("should return undefined for empty array with unknown original", () => {
		expect(formatListLikeOriginal([], 123)).toBeUndefined();
	});
});

describe("parseCategories", () => {
	it("should return ['No Category'] for undefined value", () => {
		expect(parseCategories(undefined)).toEqual(["No Category"]);
	});

	it("should return ['No Category'] for null value", () => {
		expect(parseCategories(null)).toEqual(["No Category"]);
	});

	it("should return ['No Category'] for empty string", () => {
		expect(parseCategories("")).toEqual(["No Category"]);
	});

	it("should return ['No Category'] for whitespace only", () => {
		expect(parseCategories("   ")).toEqual(["No Category"]);
	});

	it("should parse single category", () => {
		expect(parseCategories("Work")).toEqual(["Work"]);
	});

	it("should parse multiple comma-separated categories", () => {
		expect(parseCategories("Work, Personal")).toEqual(["Work", "Personal"]);
	});

	it("should trim whitespace from categories", () => {
		expect(parseCategories("  Work  ,  Personal  ,  Health  ")).toEqual(["Work", "Personal", "Health"]);
	});

	it("should handle categories without spaces after comma", () => {
		expect(parseCategories("Work,Personal,Health")).toEqual(["Work", "Personal", "Health"]);
	});

	it("should filter out empty categories from trailing commas", () => {
		expect(parseCategories("Work, Personal,")).toEqual(["Work", "Personal"]);
	});

	it("should filter out empty categories from leading commas", () => {
		expect(parseCategories(",Work, Personal")).toEqual(["Work", "Personal"]);
	});

	it("should handle categories with numbers", () => {
		expect(parseCategories("Project1, Project2")).toEqual(["Project1", "Project2"]);
	});

	it("should handle categories with special characters", () => {
		expect(parseCategories("Work-Life, Health & Fitness")).toEqual(["Work-Life", "Health & Fitness"]);
	});

	it("should convert non-string values to string", () => {
		expect(parseCategories(123)).toEqual(["123"]);
	});

	it("should handle array input", () => {
		expect(parseCategories(["Work", "Personal"])).toEqual(["Work", "Personal"]);
	});

	it("should handle array with comma-separated strings", () => {
		expect(parseCategories(["Work, Personal", "Health"])).toEqual(["Work", "Personal", "Health"]);
	});
});

describe("parseLinkedList", () => {
	describe("without resolve (extract link paths)", () => {
		it("should return empty array for null/undefined", () => {
			expect(parseLinkedList(null)).toEqual([]);
			expect(parseLinkedList(undefined)).toEqual([]);
		});

		it("should extract path from a single wiki-link", () => {
			expect(parseLinkedList("[[Projects/Alpha]]")).toEqual(["Projects/Alpha"]);
		});

		it("should extract paths from an array of wiki-links", () => {
			expect(parseLinkedList(["[[Task A]]", "[[Task B]]"])).toEqual(["Task A", "Task B"]);
		});

		it("should strip display aliases from wiki-links", () => {
			expect(parseLinkedList("[[Projects/Alpha|Alpha]]")).toEqual(["Projects/Alpha"]);
		});

		it("should skip non-wiki-link strings", () => {
			expect(parseLinkedList(["plain text", "[[Valid Link]]", "also plain"])).toEqual(["Valid Link"]);
		});

		it("should handle comma-separated wiki-links by default", () => {
			expect(parseLinkedList("[[Task A]], [[Task B]]")).toEqual(["Task A", "Task B"]);
		});

		it("should respect splitCommas: false", () => {
			expect(parseLinkedList("[[Task A]], [[Task B]]", { splitCommas: false })).toEqual([]);
		});

		it("should handle mixed array with numbers and empty strings", () => {
			expect(parseLinkedList(["[[Link]]", "", 42])).toEqual(["Link"]);
		});

		it("should handle nested paths with aliases", () => {
			expect(parseLinkedList(["[[Folder/Sub/File|Display]]", "[[Root]]"])).toEqual(["Folder/Sub/File", "Root"]);
		});
	});

	describe("with resolve closure", () => {
		const mockResolve = (linkPath: string): string | null => {
			const lookup: Record<string, string> = {
				"Task A": "tasks/task-a.md",
				"Task B": "tasks/task-b.md",
				"Projects/Alpha": "projects/alpha.md",
			};
			return lookup[linkPath] ?? null;
		};

		it("should resolve link paths through the closure", () => {
			expect(parseLinkedList(["[[Task A]]", "[[Task B]]"], { resolve: mockResolve })).toEqual([
				"tasks/task-a.md",
				"tasks/task-b.md",
			]);
		});

		it("should filter out links that resolve to null", () => {
			expect(parseLinkedList(["[[Task A]]", "[[Unknown]]"], { resolve: mockResolve })).toEqual(["tasks/task-a.md"]);
		});

		it("should handle resolve returning undefined", () => {
			const resolveWithUndefined = (linkPath: string) => (linkPath === "Keep" ? "resolved" : undefined);

			expect(parseLinkedList(["[[Keep]]", "[[Skip]]"], { resolve: resolveWithUndefined })).toEqual(["resolved"]);
		});

		it("should return empty array when all links fail to resolve", () => {
			expect(parseLinkedList(["[[Unknown]]"], { resolve: () => null })).toEqual([]);
		});

		it("should support generic return types from resolve", () => {
			const resolveToNumber = (linkPath: string): number | null => (linkPath === "A" ? 1 : linkPath === "B" ? 2 : null);

			const result: number[] = parseLinkedList(["[[A]]", "[[B]]", "[[C]]"], { resolve: resolveToNumber });
			expect(result).toEqual([1, 2]);
		});
	});
});

describe("areSetsEqual", () => {
	it("should return true for identical sets", () => {
		const set = new Set([1, 2, 3]);
		expect(areSetsEqual(set, set)).toBe(true);
	});

	it("should return true for equal sets", () => {
		const set1 = new Set([1, 2, 3]);
		const set2 = new Set([1, 2, 3]);
		expect(areSetsEqual(set1, set2)).toBe(true);
	});

	it("should return false for sets with different sizes", () => {
		const set1 = new Set([1, 2, 3]);
		const set2 = new Set([1, 2]);
		expect(areSetsEqual(set1, set2)).toBe(false);
	});

	it("should return false for sets with different values", () => {
		const set1 = new Set([1, 2, 3]);
		const set2 = new Set([1, 2, 4]);
		expect(areSetsEqual(set1, set2)).toBe(false);
	});

	it("should return true for empty sets", () => {
		const set1 = new Set<number>();
		const set2 = new Set<number>();
		expect(areSetsEqual(set1, set2)).toBe(true);
	});

	it("should work with string sets", () => {
		const set1 = new Set(["a", "b", "c"]);
		const set2 = new Set(["a", "b", "c"]);
		expect(areSetsEqual(set1, set2)).toBe(true);
	});
});
