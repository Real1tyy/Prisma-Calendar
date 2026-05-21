/**
 * `assignListToFrontmatter` is the canonical serialization rule for any
 * list-shaped frontmatter property (categories, participants, prerequisites):
 * empty list → blank string, single item → string, many items → array. The
 * event-form save path delegates category writing through this helper, so the
 * contract is exercised every time a user saves an event.
 */
import { describe, expect, it } from "vitest";

import type { Frontmatter } from "../../../src/types";
import { assignListToFrontmatter } from "../../../src/utils/frontmatter/props";

describe("assignListToFrontmatter", () => {
	it.each<{ scenario: string; input: string[]; expected: string | string[] }>([
		{ scenario: "writes an empty string when the list is empty", input: [], expected: "" },
		{ scenario: "writes a bare string when the list has one item", input: ["Work"], expected: "Work" },
		{
			scenario: "writes an array when the list has multiple items",
			input: ["Work", "Meeting", "Important"],
			expected: ["Work", "Meeting", "Important"],
		},
	])("$scenario", ({ input, expected }) => {
		const fm: Frontmatter = {};
		assignListToFrontmatter(fm, "Category", input);
		expect(fm["Category"]).toEqual(expected);
	});

	it("overwrites an existing value on the same property", () => {
		const fm: Frontmatter = { Category: "OldCategory" };
		assignListToFrontmatter(fm, "Category", ["NewCategory"]);
		expect(fm["Category"]).toBe("NewCategory");
	});
});
