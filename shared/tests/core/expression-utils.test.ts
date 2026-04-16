import { describe, expect, it } from "vitest";

import {
	buildPropertyMapping,
	extractExpressionIdentifiers,
	sanitizeExpression,
	sanitizePropertyName,
} from "../../src/utils/expression-utils";

describe("sanitizePropertyName", () => {
	it("replaces spaces with underscores and adds prefix", () => {
		expect(sanitizePropertyName("My Property")).toBe("prop_My_Property");
	});

	it("replaces special characters with underscores", () => {
		expect(sanitizePropertyName("start-date")).toBe("prop_start_date");
		expect(sanitizePropertyName("value@field")).toBe("prop_value_field");
		expect(sanitizePropertyName("a.b.c")).toBe("prop_a_b_c");
	});

	it("preserves alphanumeric characters and underscores", () => {
		expect(sanitizePropertyName("valid_name123")).toBe("prop_valid_name123");
	});

	it("handles empty string", () => {
		expect(sanitizePropertyName("")).toBe("prop_");
	});

	it("handles all-special-character names", () => {
		expect(sanitizePropertyName("@#$%")).toBe("prop_____");
	});

	it("handles single character", () => {
		expect(sanitizePropertyName("x")).toBe("prop_x");
	});

	it("replaces unicode characters with underscores", () => {
		expect(sanitizePropertyName("名前")).toBe("prop___");
	});
});

describe("buildPropertyMapping", () => {
	it("builds a mapping from property names to sanitized versions", () => {
		const mapping = buildPropertyMapping(["start-date", "My Property", "simple"]);
		expect(mapping.get("start-date")).toBe("prop_start_date");
		expect(mapping.get("My Property")).toBe("prop_My_Property");
		expect(mapping.get("simple")).toBe("prop_simple");
	});

	it("returns empty map for empty input", () => {
		const mapping = buildPropertyMapping([]);
		expect(mapping.size).toBe(0);
	});

	it("handles duplicate property names", () => {
		const mapping = buildPropertyMapping(["name", "name"]);
		expect(mapping.size).toBe(1);
		expect(mapping.get("name")).toBe("prop_name");
	});
});

describe("sanitizeExpression", () => {
	it("replaces property names with sanitized versions in expression", () => {
		const mapping = buildPropertyMapping(["start-date", "end-date"]);
		const result = sanitizeExpression("start-date > end-date", mapping);
		expect(result).toBe("prop_start_date > prop_end_date");
	});

	it("replaces longer property names first to avoid partial matches", () => {
		const mapping = buildPropertyMapping(["status", "status-code"]);
		const result = sanitizeExpression("status-code === 200", mapping);
		expect(result).toBe("prop_status_code === 200");
	});

	it("does not replace property names within larger words", () => {
		const mapping = buildPropertyMapping(["id"]);
		const result = sanitizeExpression("identity !== undefined", mapping);
		expect(result).toBe("identity !== undefined");
	});

	it("replaces multiple occurrences", () => {
		const mapping = buildPropertyMapping(["val"]);
		const result = sanitizeExpression("val + val", mapping);
		expect(result).toBe("prop_val + prop_val");
	});

	it("handles expression with no matching properties", () => {
		const mapping = buildPropertyMapping(["unused"]);
		const result = sanitizeExpression("1 + 2", mapping);
		expect(result).toBe("1 + 2");
	});

	it("handles empty expression", () => {
		const mapping = buildPropertyMapping(["x"]);
		expect(sanitizeExpression("", mapping)).toBe("");
	});

	it("handles empty mapping", () => {
		const mapping = buildPropertyMapping([]);
		expect(sanitizeExpression("any expression", mapping)).toBe("any expression");
	});

	it("handles properties with spaces in expressions", () => {
		const mapping = buildPropertyMapping(["My Property"]);
		const result = sanitizeExpression("My Property > 10", mapping);
		expect(result).toBe("prop_My_Property > 10");
	});
});

describe("extractExpressionIdentifiers", () => {
	it("extracts simple identifiers", () => {
		const ids = extractExpressionIdentifiers("Status === 'Done'");
		expect(ids).toContain("Status");
		expect(ids).not.toContain("Done");
	});

	it("extracts multiple identifiers", () => {
		const ids = extractExpressionIdentifiers("Status !== 'Archived' && priority > 3");
		expect(ids).toContain("Status");
		expect(ids).toContain("priority");
	});

	it("excludes JavaScript keywords", () => {
		const ids = extractExpressionIdentifiers("typeof Status !== 'undefined' && true");
		expect(ids).toContain("Status");
		expect(ids).not.toContain("typeof");
		expect(ids).not.toContain("undefined");
		expect(ids).not.toContain("true");
	});

	it("excludes identifiers inside string literals", () => {
		const ids = extractExpressionIdentifiers("Status === 'Active'");
		expect(ids).toContain("Status");
		expect(ids).not.toContain("Active");
	});

	it("handles underscore-prefixed properties", () => {
		const ids = extractExpressionIdentifiers("_Archived !== true");
		expect(ids).toContain("_Archived");
	});

	it("handles negation expressions", () => {
		const ids = extractExpressionIdentifiers("!_Archived");
		expect(ids).toContain("_Archived");
	});

	it("returns empty array for pure literals", () => {
		const ids = extractExpressionIdentifiers("1 + 2 === 3");
		expect(ids).toEqual([]);
	});

	it("excludes prop_ prefixed names", () => {
		const ids = extractExpressionIdentifiers("prop_Status === 'Done'");
		expect(ids).not.toContain("prop_Status");
	});
});
