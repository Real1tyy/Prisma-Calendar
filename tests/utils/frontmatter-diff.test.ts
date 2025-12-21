import { describe, expect, it } from "vitest";
import type { Frontmatter } from "../../src/types";
import { compareFrontmatter, formatChangeForDisplay } from "../../src/utils/frontmatter-diff";

describe("compareFrontmatter", () => {
	it("should detect no changes when frontmatter is identical", () => {
		const old: Frontmatter = { title: "Test", category: "work" };
		const updated: Frontmatter = { title: "Test", category: "work" };

		const diff = compareFrontmatter(old, updated);

		expect(diff.hasChanges).toBe(false);
		expect(diff.changes).toHaveLength(0);
	});

	it("should detect added properties", () => {
		const old: Frontmatter = { title: "Test" };
		const updated: Frontmatter = { title: "Test", category: "work", priority: 1 };

		const diff = compareFrontmatter(old, updated);

		expect(diff.hasChanges).toBe(true);
		expect(diff.added).toHaveLength(2);
		expect(diff.added[0]).toEqual({
			key: "category",
			oldValue: undefined,
			newValue: "work",
			changeType: "added",
		});
		expect(diff.added[1]).toEqual({
			key: "priority",
			oldValue: undefined,
			newValue: 1,
			changeType: "added",
		});
	});

	it("should detect deleted properties", () => {
		const old: Frontmatter = { title: "Test", category: "work", priority: 1 };
		const updated: Frontmatter = { title: "Test" };

		const diff = compareFrontmatter(old, updated);

		expect(diff.hasChanges).toBe(true);
		expect(diff.deleted).toHaveLength(2);
		expect(diff.deleted[0]).toEqual({
			key: "category",
			oldValue: "work",
			newValue: undefined,
			changeType: "deleted",
		});
		expect(diff.deleted[1]).toEqual({
			key: "priority",
			oldValue: 1,
			newValue: undefined,
			changeType: "deleted",
		});
	});

	it("should detect modified properties", () => {
		const old: Frontmatter = { title: "Test", category: "work", priority: 1 };
		const updated: Frontmatter = { title: "Updated Test", category: "personal", priority: 2 };

		const diff = compareFrontmatter(old, updated);

		expect(diff.hasChanges).toBe(true);
		expect(diff.modified).toHaveLength(3);
		expect(diff.modified[0].key).toBe("title");
		expect(diff.modified[0].oldValue).toBe("Test");
		expect(diff.modified[0].newValue).toBe("Updated Test");
		expect(diff.modified[1].key).toBe("category");
		expect(diff.modified[2].key).toBe("priority");
	});

	it("should detect mixed changes (added, modified, deleted)", () => {
		const old: Frontmatter = { title: "Test", category: "work", oldProp: "remove" };
		const updated: Frontmatter = { title: "Updated", category: "work", newProp: "added" };

		const diff = compareFrontmatter(old, updated);

		expect(diff.hasChanges).toBe(true);
		expect(diff.added).toHaveLength(1);
		expect(diff.modified).toHaveLength(1);
		expect(diff.deleted).toHaveLength(1);
		expect(diff.changes).toHaveLength(3);
	});

	it("should exclude specified properties from comparison", () => {
		const old: Frontmatter = { title: "Test", start: "2025-01-01", category: "work" };
		const updated: Frontmatter = { title: "Updated", start: "2025-01-02", category: "personal" };

		const excludeProps = new Set(["start"]);
		const diff = compareFrontmatter(old, updated, excludeProps);

		expect(diff.hasChanges).toBe(true);
		expect(diff.modified).toHaveLength(2);
		expect(diff.modified.some((c) => c.key === "start")).toBe(false);
		expect(diff.modified.some((c) => c.key === "title")).toBe(true);
		expect(diff.modified.some((c) => c.key === "category")).toBe(true);
	});

	it("should handle array values correctly", () => {
		const old: Frontmatter = { tags: ["work", "important"] };
		const updated: Frontmatter = { tags: ["work", "urgent"] };

		const diff = compareFrontmatter(old, updated);

		expect(diff.hasChanges).toBe(true);
		expect(diff.modified).toHaveLength(1);
		expect(diff.modified[0].key).toBe("tags");
	});

	it("should detect identical arrays as unchanged", () => {
		const old: Frontmatter = { tags: ["work", "important"] };
		const updated: Frontmatter = { tags: ["work", "important"] };

		const diff = compareFrontmatter(old, updated);

		expect(diff.hasChanges).toBe(false);
	});

	it("should handle nested object values", () => {
		const old: Frontmatter = { metadata: { author: "John", version: 1 } };
		const updated: Frontmatter = { metadata: { author: "Jane", version: 1 } };

		const diff = compareFrontmatter(old, updated);

		expect(diff.hasChanges).toBe(true);
		expect(diff.modified).toHaveLength(1);
		expect(diff.modified[0].key).toBe("metadata");
	});

	it("should detect identical nested objects as unchanged", () => {
		const old: Frontmatter = { metadata: { author: "John", version: 1 } };
		const updated: Frontmatter = { metadata: { author: "John", version: 1 } };

		const diff = compareFrontmatter(old, updated);

		expect(diff.hasChanges).toBe(false);
	});

	it("should handle null and undefined values", () => {
		const old: Frontmatter = { a: null, b: undefined, c: "value" };
		const updated: Frontmatter = { a: "changed", b: null, c: "value" };

		const diff = compareFrontmatter(old, updated);

		expect(diff.hasChanges).toBe(true);
		expect(diff.modified).toHaveLength(2);
		expect(diff.modified.some((c) => c.key === "a")).toBe(true);
		expect(diff.modified.some((c) => c.key === "b")).toBe(true);
	});

	it("should handle empty frontmatter objects", () => {
		const old: Frontmatter = {};
		const updated: Frontmatter = {};

		const diff = compareFrontmatter(old, updated);

		expect(diff.hasChanges).toBe(false);
		expect(diff.changes).toHaveLength(0);
	});

	it("should handle boolean values", () => {
		const old: Frontmatter = { completed: false };
		const updated: Frontmatter = { completed: true };

		const diff = compareFrontmatter(old, updated);

		expect(diff.hasChanges).toBe(true);
		expect(diff.modified).toHaveLength(1);
		expect(diff.modified[0].oldValue).toBe(false);
		expect(diff.modified[0].newValue).toBe(true);
	});
});

describe("formatChangeForDisplay", () => {
	it("should format added properties", () => {
		const change = {
			key: "category",
			oldValue: undefined,
			newValue: "work",
			changeType: "added" as const,
		};

		const formatted = formatChangeForDisplay(change);

		expect(formatted).toBe('+ category: "work"');
	});

	it("should format deleted properties", () => {
		const change = {
			key: "priority",
			oldValue: 1,
			newValue: undefined,
			changeType: "deleted" as const,
		};

		const formatted = formatChangeForDisplay(change);

		expect(formatted).toBe("- priority: 1");
	});

	it("should format modified properties", () => {
		const change = {
			key: "title",
			oldValue: "Old Title",
			newValue: "New Title",
			changeType: "modified" as const,
		};

		const formatted = formatChangeForDisplay(change);

		expect(formatted).toBe('~ title: "Old Title" → "New Title"');
	});

	it("should format null values", () => {
		const change = {
			key: "value",
			oldValue: null,
			newValue: "something",
			changeType: "modified" as const,
		};

		const formatted = formatChangeForDisplay(change);

		expect(formatted).toBe('~ value: null → "something"');
	});

	it("should format object values", () => {
		const change = {
			key: "metadata",
			oldValue: { a: 1 },
			newValue: { a: 2 },
			changeType: "modified" as const,
		};

		const formatted = formatChangeForDisplay(change);

		expect(formatted).toBe('~ metadata: {"a":1} → {"a":2}');
	});

	it("should format array values", () => {
		const change = {
			key: "tags",
			oldValue: ["old"],
			newValue: ["new"],
			changeType: "modified" as const,
		};

		const formatted = formatChangeForDisplay(change);

		expect(formatted).toBe('~ tags: ["old"] → ["new"]');
	});
});


