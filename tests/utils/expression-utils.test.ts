import { describe, expect, it } from "vitest";
import {
	buildPropertyMapping,
	normalizeFrontmatterForColorEvaluation,
	sanitizeExpression,
	sanitizePropertyName,
} from "../../src/utils/expression-utils";

describe("sanitizePropertyName", () => {
	it("should leave valid identifiers unchanged", () => {
		expect(sanitizePropertyName("Status")).toBe("Status");
		expect(sanitizePropertyName("Priority")).toBe("Priority");
		expect(sanitizePropertyName("folder")).toBe("folder");
		expect(sanitizePropertyName("_ZettelID")).toBe("_ZettelID");
	});

	it("should replace spaces with underscores", () => {
		expect(sanitizePropertyName("Start Date")).toBe("Start_Date");
		expect(sanitizePropertyName("End Date")).toBe("End_Date");
		expect(sanitizePropertyName("All Day")).toBe("All_Day");
	});

	it("should replace special characters with underscores", () => {
		expect(sanitizePropertyName("Backlink-Tags")).toBe("Backlink_Tags");
		expect(sanitizePropertyName("User@Email")).toBe("User_Email");
		expect(sanitizePropertyName("Price$Amount")).toBe("Price_Amount");
		expect(sanitizePropertyName("Test#Value")).toBe("Test_Value");
	});

	it("should handle multiple spaces and special chars", () => {
		expect(sanitizePropertyName("Start  Date")).toBe("Start__Date");
		expect(sanitizePropertyName("User-Name-Here")).toBe("User_Name_Here");
		expect(sanitizePropertyName("Test  @#$  Value")).toBe("Test_______Value");
	});

	it("should handle leading and trailing special characters", () => {
		expect(sanitizePropertyName("-Status-")).toBe("_Status_");
		expect(sanitizePropertyName(" Value ")).toBe("_Value_");
		expect(sanitizePropertyName("@Property@")).toBe("_Property_");
	});

	it("should preserve numbers and underscores", () => {
		expect(sanitizePropertyName("Property123")).toBe("Property123");
		expect(sanitizePropertyName("test_value_123")).toBe("test_value_123");
		expect(sanitizePropertyName("_123")).toBe("_123");
	});
});

describe("buildPropertyMapping", () => {
	it("should create mapping for simple properties", () => {
		const properties = ["Status", "Priority", "folder"];
		const mapping = buildPropertyMapping(properties);

		expect(mapping.size).toBe(3);
		expect(mapping.get("Status")).toBe("Status");
		expect(mapping.get("Priority")).toBe("Priority");
		expect(mapping.get("folder")).toBe("folder");
	});

	it("should sanitize properties with spaces", () => {
		const properties = ["Start Date", "End Date", "All Day"];
		const mapping = buildPropertyMapping(properties);

		expect(mapping.size).toBe(3);
		expect(mapping.get("Start Date")).toBe("Start_Date");
		expect(mapping.get("End Date")).toBe("End_Date");
		expect(mapping.get("All Day")).toBe("All_Day");
	});

	it("should handle mixed valid and invalid identifiers", () => {
		const properties = ["Status", "Start Date", "Priority", "All Day"];
		const mapping = buildPropertyMapping(properties);

		expect(mapping.size).toBe(4);
		expect(mapping.get("Status")).toBe("Status");
		expect(mapping.get("Start Date")).toBe("Start_Date");
		expect(mapping.get("Priority")).toBe("Priority");
		expect(mapping.get("All Day")).toBe("All_Day");
	});

	it("should handle empty array", () => {
		const properties: string[] = [];
		const mapping = buildPropertyMapping(properties);

		expect(mapping.size).toBe(0);
	});

	it("should handle properties with special characters", () => {
		const properties = ["User-Name", "Price$Amount", "Test#Value"];
		const mapping = buildPropertyMapping(properties);

		expect(mapping.size).toBe(3);
		expect(mapping.get("User-Name")).toBe("User_Name");
		expect(mapping.get("Price$Amount")).toBe("Price_Amount");
		expect(mapping.get("Test#Value")).toBe("Test_Value");
	});
});

describe("sanitizeExpression", () => {
	it("should not modify expressions with valid identifiers", () => {
		const mapping = new Map([
			["Status", "Status"],
			["Priority", "Priority"],
		]);

		expect(sanitizeExpression('Status === "Done"', mapping)).toBe('Status === "Done"');
		expect(sanitizeExpression("Priority > 5", mapping)).toBe("Priority > 5");
		expect(sanitizeExpression('Status === "Done" && Priority > 5', mapping)).toBe('Status === "Done" && Priority > 5');
	});

	it("should replace properties with spaces", () => {
		const mapping = new Map([
			["Start Date", "Start_Date"],
			["End Date", "End_Date"],
			["All Day", "All_Day"],
		]);

		expect(sanitizeExpression("Start Date !== null", mapping)).toBe("Start_Date !== null");
		expect(sanitizeExpression('End Date > "2025-10-20"', mapping)).toBe('End_Date > "2025-10-20"');
		expect(sanitizeExpression("All Day === true", mapping)).toBe("All_Day === true");
	});

	it("should replace multiple properties in complex expressions", () => {
		const mapping = new Map([
			["Start Date", "Start_Date"],
			["End Date", "End_Date"],
			["Status", "Status"],
		]);

		const expression = 'Start Date !== null && End Date > "2025-10-20" && Status === "Done"';
		const expected = 'Start_Date !== null && End_Date > "2025-10-20" && Status === "Done"';

		expect(sanitizeExpression(expression, mapping)).toBe(expected);
	});

	it("should handle properties with special regex characters", () => {
		const mapping = new Map([
			["User-Name", "User_Name"],
			["Price$Amount", "Price_Amount"],
		]);

		expect(sanitizeExpression('User-Name === "Alice"', mapping)).toBe('User_Name === "Alice"');
		expect(sanitizeExpression("Price$Amount > 100", mapping)).toBe("Price_Amount > 100");
	});

	it("should only replace whole word boundaries", () => {
		const mapping = new Map([["Status", "Status_"]]);

		expect(sanitizeExpression('Status === "Done"', mapping)).toBe('Status_ === "Done"');
		expect(sanitizeExpression("StatusCode === 200", mapping)).toBe("StatusCode === 200");
		expect(sanitizeExpression("Status.length > 0", mapping)).toBe("Status_.length > 0");
	});

	it("should handle property names in various contexts", () => {
		const mapping = new Map([["All Day", "All_Day"]]);

		expect(sanitizeExpression("All Day === true", mapping)).toBe("All_Day === true");
		expect(sanitizeExpression("All Day !== false", mapping)).toBe("All_Day !== false");
		expect(sanitizeExpression("!All Day", mapping)).toBe("!All_Day");
		expect(sanitizeExpression("(All Day)", mapping)).toBe("(All_Day)");
	});

	it("should replace all occurrences including those in strings", () => {
		const mapping = new Map([["Status", "Status_"]]);

		const expression = 'Status === "Status is Done"';
		const result = sanitizeExpression(expression, mapping);

		expect(result).toBe('Status_ === "Status_ is Done"');
	});

	it("should handle array method calls", () => {
		const mapping = new Map([["Backlink Tags", "Backlink_Tags"]]);

		expect(sanitizeExpression('Backlink Tags.includes("work")', mapping)).toBe('Backlink_Tags.includes("work")');
		expect(sanitizeExpression("Backlink Tags.length > 0", mapping)).toBe("Backlink_Tags.length > 0");
	});

	it("should handle nested property access", () => {
		const mapping = new Map([["User Info", "User_Info"]]);

		expect(sanitizeExpression('User Info.name === "Alice"', mapping)).toBe('User_Info.name === "Alice"');
	});

	it("should handle logical operators", () => {
		const mapping = new Map([
			["Status", "Status_"],
			["Priority", "Priority_"],
		]);

		expect(sanitizeExpression('Status === "Done" || Priority > 5', mapping)).toBe(
			'Status_ === "Done" || Priority_ > 5'
		);
		expect(sanitizeExpression('Status === "Done" && Priority > 5', mapping)).toBe(
			'Status_ === "Done" && Priority_ > 5'
		);
	});

	it("should return unchanged expression when no properties need sanitization", () => {
		const mapping = new Map([
			["Status", "Status"],
			["Priority", "Priority"],
		]);

		const expression = 'Status === "Done"';
		expect(sanitizeExpression(expression, mapping)).toBe(expression);
	});

	it("should handle empty mapping", () => {
		const mapping = new Map<string, string>();
		const expression = 'Status === "Done"';

		expect(sanitizeExpression(expression, mapping)).toBe(expression);
	});

	it("should handle comparison with null and undefined", () => {
		const mapping = new Map([["Start Date", "Start_Date"]]);

		expect(sanitizeExpression("Start Date === null", mapping)).toBe("Start_Date === null");
		expect(sanitizeExpression("Start Date !== null", mapping)).toBe("Start_Date !== null");
		expect(sanitizeExpression("Start Date === undefined", mapping)).toBe("Start_Date === undefined");
	});

	it("should handle ternary operators", () => {
		const mapping = new Map([["Status", "Status_"]]);

		expect(sanitizeExpression('Status === "Done" ? true : false', mapping)).toBe('Status_ === "Done" ? true : false');
	});
});

describe("normalizeFrontmatterForColorEvaluation", () => {
	it("should return frontmatter unchanged when no color rules", () => {
		const frontmatter = { Status: "Done", Priority: "High" };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toBe(frontmatter);
		expect(result).toEqual({ Status: "Done", Priority: "High" });
	});

	it("should return frontmatter unchanged when all rules are disabled", () => {
		const frontmatter = { Status: "Done" };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "Category.includes('Work')", enabled: false },
			{ expression: "Priority === 'High'", enabled: false },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toBe(frontmatter);
		expect(result).toEqual({ Status: "Done" });
	});

	it("should return frontmatter unchanged when no .includes() expressions", () => {
		const frontmatter = { Status: "Done", Priority: "High" };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "Status === 'Done'", enabled: true },
			{ expression: "Priority === 'High'", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toBe(frontmatter);
		expect(result).toEqual({ Status: "Done", Priority: "High" });
	});

	it("should add empty array for missing property used with .includes()", () => {
		const frontmatter = { Status: "Done" };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "Category.includes('Work')", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).not.toBe(frontmatter);
		expect(result).toEqual({ Status: "Done", Category: [] });
	});

	it("should not override existing property values", () => {
		const frontmatter = { Status: "Done", Category: ["Work", "Personal"] };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "Category.includes('Work')", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toEqual({ Status: "Done", Category: ["Work", "Personal"] });
	});

	it("should handle multiple properties with .includes()", () => {
		const frontmatter = { Status: "Done" };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "Category.includes('Work')", enabled: true },
			{ expression: "Tags.includes('urgent')", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toEqual({ Status: "Done", Category: [], Tags: [] });
	});

	it("should handle optional chaining with .includes()", () => {
		const frontmatter = { Status: "Done" };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "Category?.includes('Work')", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toEqual({ Status: "Done", Category: [] });
	});

	it("should handle mixed expressions with and without .includes()", () => {
		const frontmatter = { Status: "Done" };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "Status === 'Done'", enabled: true },
			{ expression: "Category.includes('Work')", enabled: true },
			{ expression: "Priority === 'High'", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toEqual({ Status: "Done", Category: [] });
	});

	it("should handle complex expressions with .includes()", () => {
		const frontmatter = { Status: "Done" };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "Category.includes('Work') && Status === 'Done'", enabled: true },
			{ expression: "Tags.includes('urgent') || Priority === 'High'", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toEqual({ Status: "Done", Category: [], Tags: [] });
	});

	it("should handle property names with underscores", () => {
		const frontmatter = { Status: "Done" };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "backlink_tags.includes('work')", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toEqual({ Status: "Done", backlink_tags: [] });
	});

	it("should handle property names starting with underscore", () => {
		const frontmatter = { Status: "Done" };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "_tags.includes('work')", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toEqual({ Status: "Done", _tags: [] });
	});

	it("should skip JavaScript built-in methods", () => {
		const frontmatter = { Status: "Done" };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "Array.includes(1)", enabled: true },
			{ expression: "String.includes('test')", enabled: true },
			{ expression: "Category.includes('Work')", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toEqual({ Status: "Done", Category: [] });
	});

	it("should handle multiple occurrences of same property", () => {
		const frontmatter = { Status: "Done" };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "Category.includes('Work')", enabled: true },
			{ expression: "Category.includes('Personal')", enabled: true },
			{ expression: "Category.includes('Health')", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toEqual({ Status: "Done", Category: [] });
	});

	it("should handle expressions with nested .includes() calls", () => {
		const frontmatter = { Status: "Done" };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "Category.includes('Work') && Tags.includes('urgent')", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toEqual({ Status: "Done", Category: [], Tags: [] });
	});

	it("should preserve all existing frontmatter properties", () => {
		const frontmatter = {
			Status: "Done",
			Priority: "High",
			Project: "Work",
			Tags: ["urgent", "important"],
			Category: ["Work"],
		};
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "NewCategory.includes('Test')", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toEqual({
			Status: "Done",
			Priority: "High",
			Project: "Work",
			Tags: ["urgent", "important"],
			Category: ["Work"],
			NewCategory: [],
		});
	});

	it("should handle empty frontmatter object", () => {
		const frontmatter: Record<string, unknown> = {};
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "Category.includes('Work')", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toEqual({ Category: [] });
	});

	it("should handle case-sensitive property names", () => {
		const frontmatter = { status: "Done" };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "Category.includes('Work')", enabled: true },
			{ expression: "category.includes('work')", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toEqual({ status: "Done", Category: [], category: [] });
	});

	it("should handle property names with numbers", () => {
		const frontmatter = { Status: "Done" };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "Category123.includes('Work')", enabled: true },
			{ expression: "Tag_456.includes('urgent')", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toEqual({ Status: "Done", Category123: [], Tag_456: [] });
	});

	it("should convert null values to empty array for .includes() properties", () => {
		const frontmatter = { Status: "Done", Category: null };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "Category.includes('Work')", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toEqual({ Status: "Done", Category: [] });
	});

	it("should convert undefined values to empty array for .includes() properties", () => {
		const frontmatter = { Status: "Done", Category: undefined };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "Category.includes('Work')", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toEqual({ Status: "Done", Category: [] });
	});

	it("should preserve valid array values even if null/undefined also exist", () => {
		const frontmatter = { Status: "Done", Category: ["Work"], Tags: null, Labels: undefined };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "Category.includes('Work')", enabled: true },
			{ expression: "Tags.includes('urgent')", enabled: true },
			{ expression: "Labels.includes('important')", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toEqual({ Status: "Done", Category: ["Work"], Tags: [], Labels: [] });
	});

	it("should handle mixed null, undefined, and missing properties", () => {
		const frontmatter = { Status: "Done", Category: null, Tags: undefined };
		const colorRules: Array<{ expression: string; enabled: boolean }> = [
			{ expression: "Category.includes('Work')", enabled: true },
			{ expression: "Tags.includes('urgent')", enabled: true },
			{ expression: "Labels.includes('important')", enabled: true },
		];

		const result = normalizeFrontmatterForColorEvaluation(frontmatter, colorRules);

		expect(result).toEqual({ Status: "Done", Category: [], Tags: [], Labels: [] });
	});
});
