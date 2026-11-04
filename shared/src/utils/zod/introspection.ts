import { toJSONSchema, type $ZodType } from "zod/v4/core";

// ─── JSON Schema Types ─────────────────────────────────────────

export interface JSONSchemaProperty {
	type?: string;
	enum?: string[];
	format?: string;
	default?: unknown;
	description?: string;
	title?: string;
	placeholder?: string;
	widget?: string;
	enumLabels?: Record<string, string>;
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
	const json = toJSONSchema(schema, { unrepresentable: "any" });
	expandTypeUnions(json);
	return json as JSONSchemaObject;
}

// zod >=4.6 compacts `anyOf: [{type: "a"}, {type: "b"}]` into `type: ["a", "b"]`. The two
// are equivalent JSON Schema, but every consumer here reads a union as `anyOf`, so the
// compacted form is expanded back rather than taught to each of them.
function expandTypeUnions(node: unknown): void {
	if (!node || typeof node !== "object") return;
	if (Array.isArray(node)) {
		for (const child of node) expandTypeUnions(child);
		return;
	}
	const record = node as { type?: unknown; anyOf?: unknown };
	if (Array.isArray(record.type)) {
		record.anyOf = record.type.map((type: unknown) => ({ type }));
		delete record.type;
	}
	for (const value of Object.values(record)) expandTypeUnions(value);
}

// ─── Field Type Resolution ─────────────────────────────────────

export type FieldType = "string" | "number" | "boolean" | "date" | "unknown";

const DATE_FORMATS = new Set(["date", "date-time"]);

export function resolveFieldType(prop: JSONSchemaProperty): FieldType {
	if (prop.anyOf) {
		if (!prop.anyOf.length) return "unknown";
		const types = new Set(prop.anyOf.map((p) => resolveFieldType(p)));
		types.delete("unknown");
		const [first] = types;
		if (types.size === 1) return first;
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
	const max = prop.maximum !== undefined && prop.maximum < Number.MAX_SAFE_INTEGER ? prop.maximum : undefined;
	return {
		...(prop.minimum !== undefined ? { min: prop.minimum } : {}),
		...(max !== undefined ? { max } : {}),
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
