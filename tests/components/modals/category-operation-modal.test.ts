import { describe, expect, it } from "vitest";

import { getCategoryExpression } from "../../../src/react/modals/category/category-operation-modal";

describe("getCategoryExpression", () => {
	it("builds an includes expression for a plain category", () => {
		expect(getCategoryExpression("Work", "categories")).toBe("categories.includes('Work')");
	});

	it("escapes single quotes in the category name", () => {
		expect(getCategoryExpression("Alice's Tasks", "categories")).toBe("categories.includes('Alice\\'s Tasks')");
	});

	it("escapes multiple single quotes", () => {
		expect(getCategoryExpression("it's a 'test'", "cat")).toBe("cat.includes('it\\'s a \\'test\\'')");
	});

	it("uses the provided categoryProp", () => {
		expect(getCategoryExpression("Fitness", "tags")).toBe("tags.includes('Fitness')");
	});
});
