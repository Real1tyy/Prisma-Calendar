import type { CachedMetadata } from "obsidian";
import { describe, expect, it } from "vitest";

import { extractUserFrontmatter } from "../../src/core/frontmatter/frontmatter";

describe("extractUserFrontmatter", () => {
	it("returns empty object for null cache", () => {
		expect(extractUserFrontmatter(null)).toEqual({});
	});

	it("returns empty object when cache has no frontmatter", () => {
		const cache = {} as CachedMetadata;
		expect(extractUserFrontmatter(cache)).toEqual({});
	});

	it("returns empty object when frontmatter is undefined", () => {
		const cache = { frontmatter: undefined } as unknown as CachedMetadata;
		expect(extractUserFrontmatter(cache)).toEqual({});
	});

	it("strips the position property from frontmatter", () => {
		const cache = {
			frontmatter: {
				position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 5, col: 3, offset: 100 } },
				title: "Team Meeting",
				tags: ["Work"],
			},
		} as unknown as CachedMetadata;

		const result = extractUserFrontmatter(cache);
		expect(result).toEqual({ title: "Team Meeting", tags: ["Work"] });
		expect(result).not.toHaveProperty("position");
	});

	it("returns all user properties when position is the only internal property", () => {
		const cache = {
			frontmatter: {
				position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 3, col: 3, offset: 50 } },
				category: "Personal",
				priority: 1,
				completed: false,
			},
		} as unknown as CachedMetadata;

		const result = extractUserFrontmatter(cache);
		expect(result).toEqual({ category: "Personal", priority: 1, completed: false });
	});

	it("returns empty object when frontmatter only has position", () => {
		const cache = {
			frontmatter: {
				position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 1, col: 3, offset: 10 } },
			},
		} as unknown as CachedMetadata;

		const result = extractUserFrontmatter(cache);
		expect(result).toEqual({});
	});

	it("preserves complex nested values", () => {
		const cache = {
			frontmatter: {
				position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 5, col: 3, offset: 100 } },
				metadata: { nested: { deep: true } },
				list: ["Alice", "Bob"],
			},
		} as unknown as CachedMetadata;

		const result = extractUserFrontmatter(cache);
		expect(result).toEqual({ metadata: { nested: { deep: true } }, list: ["Alice", "Bob"] });
	});

	it("preserves null and empty string values", () => {
		const cache = {
			frontmatter: {
				position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 3, col: 3, offset: 50 } },
				empty: "",
				nothing: null,
			},
		} as unknown as CachedMetadata;

		const result = extractUserFrontmatter(cache);
		expect(result).toEqual({ empty: "", nothing: null });
	});
});
