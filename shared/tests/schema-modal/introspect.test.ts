import { describe, expect, it } from "vitest";
import { z } from "zod";

import { camelCaseToLabel, introspectField, introspectShape } from "../../src/components/schema-modal/introspect";
import { zSecret } from "../../src/utils/zod/validation";

describe("camelCaseToLabel", () => {
	it("converts camelCase to title case", () => {
		expect(camelCaseToLabel("accountType")).toBe("Account Type");
		expect(camelCaseToLabel("startDate")).toBe("Start Date");
		expect(camelCaseToLabel("amount")).toBe("Amount");
		expect(camelCaseToLabel("active")).toBe("Active");
	});

	it("handles single-word keys", () => {
		expect(camelCaseToLabel("balance")).toBe("Balance");
		expect(camelCaseToLabel("note")).toBe("Note");
	});

	it("handles multiple uppercase transitions", () => {
		expect(camelCaseToLabel("myLongFieldName")).toBe("My Long Field Name");
	});
});

describe("introspectShape", () => {
	it("detects z.string() as string", () => {
		const result = introspectShape({ name: z.string() });
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ key: "name", type: "string", optional: false });
	});

	it("detects z.number() as number", () => {
		const result = introspectShape({ amount: z.number() });
		expect(result[0]).toMatchObject({ key: "amount", type: "number", optional: false });
	});

	it("detects z.boolean() as boolean", () => {
		const result = introspectShape({ active: z.boolean() });
		expect(result[0]).toMatchObject({ key: "active", type: "boolean", optional: false });
	});

	it("detects z.enum() as enum with values", () => {
		const result = introspectShape({ status: z.enum(["active", "inactive", "pending"]) });
		expect(result[0]).toMatchObject({
			key: "status",
			type: "enum",
			enumValues: ["active", "inactive", "pending"],
		});
	});

	it("detects date fields by Zod format only, never by key name", () => {
		const result = introspectShape({
			when: z.string().date(),
			startDate: z.string().optional(),
			sortDateProp: z.string(),
			createdDate: z.string().optional(),
		});
		expect(result[0]).toMatchObject({ key: "when", type: "date" });
		expect(result[1]).toMatchObject({ key: "startDate", type: "string" });
		expect(result[2]).toMatchObject({ key: "sortDateProp", type: "string" });
		expect(result[3]).toMatchObject({ key: "createdDate", type: "string" });
	});

	it("detects z.union([z.boolean(), z.string()]) as toggle", () => {
		const result = introspectShape({
			recurring: z.union([z.boolean(), z.string()]),
		});
		expect(result[0]).toMatchObject({ key: "recurring", type: "toggle" });
	});

	it("extracts min/max from z.number().min().max()", () => {
		const result = introspectShape({
			progress: z.number().min(0).max(100),
		});
		expect(result[0]).toMatchObject({ key: "progress", type: "number", min: 0, max: 100 });
	});

	it("marks optional fields", () => {
		const result = introspectShape({
			name: z.string(),
			note: z.string().optional(),
		});
		expect(result[0].optional).toBe(false);
		expect(result[1].optional).toBe(true);
	});

	it("unwraps optional wrapper before detecting type", () => {
		const result = introspectShape({
			amount: z.number().optional(),
			active: z.boolean().optional(),
		});
		expect(result[0]).toMatchObject({ key: "amount", type: "number", optional: true });
		expect(result[1]).toMatchObject({ key: "active", type: "boolean", optional: true });
	});

	it("generates labels from camelCase keys", () => {
		const result = introspectShape({
			accountType: z.string(),
			startDate: z.string(),
		});
		expect(result[0].label).toBe("Account Type");
		expect(result[1].label).toBe("Start Date");
	});

	it("handles the GoalFrontmatterShape pattern", () => {
		const GoalShape = {
			startDate: z.string().optional(),
			endDate: z.string().optional(),
			archived: z.union([z.boolean(), z.string()]).optional(),
			status: z.string().optional(),
			priority: z.string().optional(),
			progress: z.number().min(0).max(100).optional(),
		};

		const result = introspectShape(GoalShape);
		const byKey = Object.fromEntries(result.map((d) => [d.key, d]));

		expect(byKey.startDate).toMatchObject({ type: "string", optional: true });
		expect(byKey.endDate).toMatchObject({ type: "string", optional: true });
		expect(byKey.archived).toMatchObject({ type: "toggle", optional: true });
		expect(byKey.status).toMatchObject({ type: "string", optional: true });
		expect(byKey.priority).toMatchObject({ type: "string", optional: true });
		expect(byKey.progress).toMatchObject({ type: "number", optional: true, min: 0, max: 100 });
	});

	it("handles the AccountFrontmatterShape pattern", () => {
		const CurrencyCodeSchema = z.enum(["USD", "EUR", "GBP"]);
		const AccountShape = {
			balance: z.number().optional(),
			currency: CurrencyCodeSchema.optional(),
			accountType: z.string().optional(),
			active: z.union([z.boolean(), z.string()]).optional(),
		};

		const result = introspectShape(AccountShape);
		const byKey = Object.fromEntries(result.map((d) => [d.key, d]));

		expect(byKey.balance).toMatchObject({ type: "number", optional: true });
		expect(byKey.currency).toMatchObject({ type: "enum", optional: true, enumValues: ["USD", "EUR", "GBP"] });
		expect(byKey.accountType).toMatchObject({ type: "string", optional: true });
		expect(byKey.active).toMatchObject({ type: "toggle", optional: true });
	});

	it("preserves field order from the shape", () => {
		const shape = {
			alpha: z.string(),
			beta: z.number(),
			gamma: z.boolean(),
		};
		const result = introspectShape(shape);
		expect(result.map((d) => d.key)).toEqual(["alpha", "beta", "gamma"]);
	});

	it("does not include min/max when not specified on number", () => {
		const result = introspectShape({ count: z.number() });
		expect(result[0].min).toBeUndefined();
		expect(result[0].max).toBeUndefined();
	});

	it("does not include enumValues for non-enum types", () => {
		const result = introspectShape({ name: z.string() });
		expect(result[0].enumValues).toBeUndefined();
	});

	it("extracts default values from z.enum().default()", () => {
		const result = introspectShape({
			type: z.enum(["income", "expense"]).default("expense").optional(),
			interval: z.enum(["weekly", "monthly"]).default("monthly").optional(),
		});
		expect(result[0]).toMatchObject({ type: "enum", defaultValue: "expense", enumValues: ["income", "expense"] });
		expect(result[1]).toMatchObject({ type: "enum", defaultValue: "monthly", enumValues: ["weekly", "monthly"] });
	});

	it("does not include defaultValue when none specified", () => {
		const result = introspectShape({ name: z.string().optional() });
		expect(result[0].defaultValue).toBeUndefined();
	});

	it("detects z.array(z.string()) as array with string itemType", () => {
		const result = introspectShape({ tags: z.array(z.string()) });
		expect(result[0]).toMatchObject({ key: "tags", type: "array", itemType: "string" });
	});

	it("detects z.array(z.number()) as array with number itemType", () => {
		const result = introspectShape({ scores: z.array(z.number()) });
		expect(result[0]).toMatchObject({ key: "scores", type: "array", itemType: "number" });
	});

	it("detects optional arrays", () => {
		const result = introspectShape({ items: z.array(z.string()).optional() });
		expect(result[0]).toMatchObject({ key: "items", type: "array", itemType: "string", optional: true });
	});

	it("detects arrays with defaults", () => {
		const result = introspectShape({ tags: z.array(z.string()).default(["work"]) });
		expect(result[0]).toMatchObject({ key: "tags", type: "array", itemType: "string" });
		expect(result[0].defaultValue).toEqual(["work"]);
	});

	it("extracts description from .describe()", () => {
		const result = introspectShape({
			location: z.string().describe("Event location"),
			skip: z.boolean().describe("Hide event from calendar"),
		});
		expect(result[0]).toMatchObject({ key: "location", description: "Event location" });
		expect(result[1]).toMatchObject({ key: "skip", description: "Hide event from calendar" });
	});

	it("does not include description when not specified", () => {
		const result = introspectShape({ name: z.string() });
		expect(result[0].description).toBeUndefined();
	});

	it("extracts placeholder from .meta({ placeholder })", () => {
		const result = introspectShape({
			location: z.string().meta({ placeholder: "Event location" }),
			icon: z.string().meta({ placeholder: "Emoji or text" }),
		});
		expect(result[0]).toMatchObject({ key: "location", placeholder: "Event location" });
		expect(result[1]).toMatchObject({ key: "icon", placeholder: "Emoji or text" });
	});

	it("does not include placeholder when not specified", () => {
		const result = introspectShape({ name: z.string() });
		expect(result[0].placeholder).toBeUndefined();
	});

	it("extracts both description and placeholder together", () => {
		const result = introspectShape({
			participants: z.string().describe("Comma-separated list").meta({ placeholder: "Alice, Bob" }),
		});
		expect(result[0]).toMatchObject({
			key: "participants",
			description: "Comma-separated list",
			placeholder: "Alice, Bob",
		});
	});

	it("extracts placeholder from fields with defaults", () => {
		const result = introspectShape({
			breakMinutes: z.string().default("").describe("Break time").meta({ placeholder: "0" }),
		});
		expect(result[0]).toMatchObject({
			key: "breakMinutes",
			description: "Break time",
			placeholder: "0",
			defaultValue: "",
		});
	});

	it("detects z.string().meta({ format: 'password' }) as secret", () => {
		const result = introspectShape({
			apiKey: z.string().meta({ format: "secret" }),
		});
		expect(result[0]).toMatchObject({ key: "apiKey", type: "secret", optional: false });
	});

	it("detects zSecret helper as secret", () => {
		const result = introspectShape({ token: zSecret });
		expect(result[0]).toMatchObject({ key: "token", type: "secret", optional: false });
	});

	it("detects optional password fields", () => {
		const result = introspectShape({
			token: z.string().meta({ format: "secret" }).optional(),
		});
		expect(result[0]).toMatchObject({ key: "token", type: "secret", optional: true });
	});

	it("preserves description on password fields", () => {
		const result = introspectShape({
			password: z.string().describe("Account password").meta({ format: "secret" }),
		});
		expect(result[0]).toMatchObject({
			key: "password",
			type: "secret",
			description: "Account password",
		});
	});

	it("preserves placeholder on password fields", () => {
		const result = introspectShape({
			secret: z.string().meta({ format: "secret", placeholder: "Enter secret" }),
		});
		expect(result[0]).toMatchObject({
			key: "secret",
			type: "secret",
			placeholder: "Enter secret",
		});
	});
});

describe("introspectField", () => {
	it("introspects a single boolean field", () => {
		const result = introspectField("hideWeekends", z.boolean().catch(false).describe("Hide Saturday and Sunday"));
		expect(result).toMatchObject({
			key: "hideWeekends",
			label: "Hide Weekends",
			type: "boolean",
			description: "Hide Saturday and Sunday",
		});
	});

	it("introspects a single number field with bounds", () => {
		const result = introspectField(
			"eventMaxStack",
			z.number().min(1).max(10).catch(3).describe("Max events to stack vertically")
		);
		expect(result).toMatchObject({
			key: "eventMaxStack",
			label: "Event Max Stack",
			type: "number",
			min: 1,
			max: 10,
			description: "Max events to stack vertically",
		});
	});

	it("introspects a single string field", () => {
		const result = introspectField("directory", z.string().catch("Events").describe("Directory to scan"));
		expect(result).toMatchObject({
			key: "directory",
			label: "Directory",
			type: "string",
			description: "Directory to scan",
		});
	});

	it("introspects a single enum field", () => {
		const result = introspectField("sortOrder", z.enum(["asc", "desc"]).catch("asc").describe("Sort direction"));
		expect(result).toMatchObject({
			key: "sortOrder",
			type: "enum",
			enumValues: ["asc", "desc"],
			description: "Sort direction",
		});
	});

	it("introspects a single array field", () => {
		const result = introspectField("tags", z.array(z.string()).catch([]).describe("Event tags"));
		expect(result).toMatchObject({
			key: "tags",
			type: "array",
			itemType: "string",
			description: "Event tags",
		});
	});

	it("introspects a number field without bounds", () => {
		const result = introspectField("count", z.number().catch(0));
		expect(result).toMatchObject({ key: "count", type: "number" });
		expect(result.min).toBeUndefined();
		expect(result.max).toBeUndefined();
	});

	it("introspects an optional field", () => {
		const result = introspectField("note", z.string().optional());
		expect(result).toMatchObject({ key: "note", type: "string", optional: true });
	});

	it("extracts placeholder from .meta()", () => {
		const result = introspectField("location", z.string().meta({ placeholder: "Event location" }));
		expect(result).toMatchObject({ key: "location", placeholder: "Event location" });
	});

	it("extracts enum labels from .meta()", () => {
		const result = introspectField(
			"side",
			z.enum(["left", "right"]).meta({ enumLabels: { left: "Left sidebar", right: "Right sidebar" } })
		);
		expect(result).toMatchObject({
			key: "side",
			type: "enum",
			enumLabels: { left: "Left sidebar", right: "Right sidebar" },
		});
	});

	it("returns consistent result with introspectShape for the same field", () => {
		const field = z.number().min(0).max(100).catch(50).describe("Progress percentage");
		const fromField = introspectField("progress", field);
		const fromShape = introspectShape({ progress: field })[0];
		expect(fromField).toEqual(fromShape);
	});

	it("introspects a secret/password field", () => {
		const result = introspectField(
			"apiToken",
			z.string().describe("API authentication token").meta({ format: "secret" })
		);
		expect(result).toMatchObject({
			key: "apiToken",
			label: "Api Token",
			type: "secret",
			description: "API authentication token",
		});
	});
});
