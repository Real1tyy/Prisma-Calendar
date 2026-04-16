import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
	extractEnumValues,
	extractNumberBounds,
	isOptionalField,
	resolveFieldType,
	schemaToJSONSchema,
} from "../../src/utils/zod/introspection";

describe("schemaToJSONSchema", () => {
	it("converts a Zod object schema to JSON Schema", () => {
		const schema = z.object({ name: z.string(), age: z.number() });
		const result = schemaToJSONSchema(schema);
		expect(result.type).toBe("object");
		expect(result.properties?.name).toMatchObject({ type: "string" });
		expect(result.properties?.age).toMatchObject({ type: "number" });
	});

	it("marks required fields", () => {
		const schema = z.object({ name: z.string(), note: z.string().optional() });
		const result = schemaToJSONSchema(schema);
		expect(result.required).toContain("name");
		expect(result.required).not.toContain("note");
	});

	it("captures enum values", () => {
		const schema = z.object({ status: z.enum(["active", "inactive"]) });
		const result = schemaToJSONSchema(schema);
		expect(result.properties?.status?.enum).toEqual(["active", "inactive"]);
	});

	it("captures min/max on numbers", () => {
		const schema = z.object({ progress: z.number().min(0).max(100) });
		const result = schemaToJSONSchema(schema);
		expect(result.properties?.progress?.minimum).toBe(0);
		expect(result.properties?.progress?.maximum).toBe(100);
	});

	it("captures default values", () => {
		const schema = z.object({
			type: z
				.enum(["a", "b"] as const)
				.default("a")
				.optional(),
		});
		const result = schemaToJSONSchema(schema);
		expect(result.properties?.type?.default).toBe("a");
	});

	it("captures date format from z.string().date()", () => {
		const schema = z.object({ when: z.string().date() });
		const result = schemaToJSONSchema(schema);
		expect(result.properties?.when?.format).toBe("date");
	});

	it("captures datetime format from z.string().datetime()", () => {
		const schema = z.object({ ts: z.string().datetime() });
		const result = schemaToJSONSchema(schema);
		expect(result.properties?.ts?.format).toBe("date-time");
	});

	it("represents union as anyOf", () => {
		const schema = z.object({ val: z.union([z.boolean(), z.string()]) });
		const result = schemaToJSONSchema(schema);
		expect(result.properties?.val?.anyOf).toEqual([{ type: "boolean" }, { type: "string" }]);
	});
});

describe("resolveFieldType", () => {
	it("resolves string type", () => {
		expect(resolveFieldType({ type: "string" })).toBe("string");
	});

	it("resolves number type", () => {
		expect(resolveFieldType({ type: "number" })).toBe("number");
	});

	it("resolves integer as number", () => {
		expect(resolveFieldType({ type: "integer" })).toBe("number");
	});

	it("resolves boolean type", () => {
		expect(resolveFieldType({ type: "boolean" })).toBe("boolean");
	});

	it("resolves date format as date", () => {
		expect(resolveFieldType({ type: "string", format: "date" })).toBe("date");
	});

	it("resolves date-time format as date", () => {
		expect(resolveFieldType({ type: "string", format: "date-time" })).toBe("date");
	});

	it("resolves homogeneous union", () => {
		expect(resolveFieldType({ anyOf: [{ type: "string" }, { type: "string" }] })).toBe("string");
	});

	it("resolves mixed union with string as string", () => {
		expect(resolveFieldType({ anyOf: [{ type: "boolean" }, { type: "string" }] })).toBe("string");
	});

	it("returns unknown for unrecognized types", () => {
		expect(resolveFieldType({ type: "array" })).toBe("unknown");
	});
});

describe("extractNumberBounds", () => {
	it("extracts minimum and maximum", () => {
		expect(extractNumberBounds({ type: "number", minimum: 0, maximum: 100 })).toEqual({ min: 0, max: 100 });
	});

	it("extracts only minimum", () => {
		expect(extractNumberBounds({ type: "number", minimum: 5 })).toEqual({ min: 5 });
	});

	it("returns empty for unconstrained number", () => {
		expect(extractNumberBounds({ type: "number" })).toEqual({});
	});
});

describe("extractEnumValues", () => {
	it("extracts enum values", () => {
		expect(extractEnumValues({ type: "string", enum: ["a", "b", "c"] })).toEqual(["a", "b", "c"]);
	});

	it("returns empty for non-enum", () => {
		expect(extractEnumValues({ type: "string" })).toEqual([]);
	});
});

describe("isOptionalField", () => {
	it("returns true when key is not in required", () => {
		expect(isOptionalField("note", ["name"])).toBe(true);
	});

	it("returns false when key is in required", () => {
		expect(isOptionalField("name", ["name"])).toBe(false);
	});
});
