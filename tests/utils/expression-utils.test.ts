import { describe, expect, it } from "vitest";
import { buildPropertyMapping, sanitizeExpression, sanitizePropertyName } from "../../src/utils/expression-utils";

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
