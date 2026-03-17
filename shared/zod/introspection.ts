import type { $ZodType } from "zod/v4/core";
import { toJSONSchema } from "zod/v4/core";

// ─── JSON Schema Types ─────────────────────────────────────────

export interface JSONSchemaProperty {
	type?: string;
	enum?: string[];
	format?: string;
	default?: unknown;
	minimum?: number;
	maximum?: number;
	anyOf?: JSONSchemaProperty[];
	items?: JSONSchemaProperty;
}

export interface JSONSchemaObject {
	type: "object";
	properties?: Record<string, JSONSchemaProperty>;
	required?: string[];
}

// ─── Schema → JSON Schema Conversion ───────────────────────────

export function schemaToJSONSchema(schema: $ZodType): JSONSchemaObject {
	return toJSONSchema(schema, { unrepresentable: "any" }) as JSONSchemaObject;
}

// ─── Field Type Resolution ─────────────────────────────────────

export type FieldType = "string" | "number" | "boolean" | "date" | "unknown";

const DATE_FORMATS = new Set(["date", "date-time"]);

export function resolveFieldType(prop: JSONSchemaProperty): FieldType {
	if (prop.anyOf) {
		if (!prop.anyOf.length) return "unknown";
		const types = new Set(prop.anyOf.map((p) => resolveFieldType(p)));
		types.delete("unknown");
		if (types.size === 1) return types.values().next().value!;
		if (types.has("string")) return "string";
		return "unknown";
	}

	switch (prop.type) {
		case "string":
			return prop.format && DATE_FORMATS.has(prop.format) ? "date" : "string";
		case "number":
		case "integer":
			return "number";
		case "boolean":
			return "boolean";
		default:
			return "unknown";
	}
}

// ─── Property Introspection Helpers ────────────────────────────

export function hasDateFormat(prop: JSONSchemaProperty): boolean {
	if (!prop.format) return false;
	return DATE_FORMATS.has(prop.format);
}

export function extractNumberBounds(prop: JSONSchemaProperty): { min?: number; max?: number } {
	return {
		...(prop.minimum !== undefined ? { min: prop.minimum } : {}),
		...(prop.maximum !== undefined ? { max: prop.maximum } : {}),
	};
}

export function extractEnumValues(prop: JSONSchemaProperty): string[] {
	return prop.enum ?? [];
}

export function isOptionalField(key: string, required: string[]): boolean {
	return !required.includes(key);
}

export function resolveArrayItemType(prop: JSONSchemaProperty): "string" | "number" | undefined {
	if (prop.type !== "array" || !prop.items) return undefined;
	if (prop.items.type === "number" || prop.items.type === "integer") return "number";
	if (prop.items.type === "string") return "string";
	return undefined;
}
