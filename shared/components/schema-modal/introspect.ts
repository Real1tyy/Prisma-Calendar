import type { ZodRawShape } from "zod";
import { z } from "zod";

import {
	extractEnumValues,
	extractNumberBounds,
	isOptionalField,
	type JSONSchemaProperty,
	resolveArrayItemType,
	schemaToJSONSchema,
} from "../../utils/zod/introspection";
import type { SchemaFieldDescriptor } from "./types";

const DATE_KEY_PATTERN = /date/i;

function isBooleanStringUnion(prop: JSONSchemaProperty): boolean {
	if (!prop.anyOf || prop.anyOf.length !== 2) return false;
	const types = new Set(prop.anyOf.map((p) => p.type));
	return types.has("boolean") && types.has("string");
}

function resolveFieldDescriptor(key: string, prop: JSONSchemaProperty, optional: boolean): SchemaFieldDescriptor {
	const label = prop.title ?? camelCaseToLabel(key);
	const base = {
		key,
		label,
		optional,
		...(prop.description !== undefined ? { description: prop.description } : {}),
		...(prop.placeholder !== undefined ? { placeholder: prop.placeholder } : {}),
		...(prop.widget !== undefined ? { widget: prop.widget } : {}),
		...(prop.default !== undefined ? { defaultValue: prop.default } : {}),
	};

	if (prop.anyOf) {
		if (isBooleanStringUnion(prop)) return { ...base, type: "toggle" };
		return { ...base, type: "string" };
	}

	switch (prop.type) {
		case "string": {
			if (prop.enum) {
				return {
					...base,
					type: "enum",
					enumValues: extractEnumValues(prop),
					...(prop.enumLabels ? { enumLabels: prop.enumLabels } : {}),
				};
			}
			if (prop.format === "secret") return { ...base, type: "secret" };
			if (prop.format === "date-time") return { ...base, type: "datetime" };
			if (prop.format === "date" || DATE_KEY_PATTERN.test(key)) return { ...base, type: "date" };
			return { ...base, type: "string" };
		}
		case "number":
		case "integer": {
			const { min, max } = extractNumberBounds(prop);
			return { ...base, type: "number", ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
		}
		case "boolean":
			return { ...base, type: "boolean" };
		case "array": {
			const itemType = resolveArrayItemType(prop);
			return { ...base, type: "array", itemType: itemType ?? "string" };
		}
		default:
			return { ...base, type: "string" };
	}
}

export function camelCaseToLabel(key: string): string {
	return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

export function introspectShape(shape: ZodRawShape): SchemaFieldDescriptor[] {
	const jsonSchema = schemaToJSONSchema(z.object(shape));
	const properties = jsonSchema.properties ?? {};
	const required = jsonSchema.required ?? [];

	return Object.entries(properties).map(([key, prop]) => {
		const optional = isOptionalField(key, required);
		return resolveFieldDescriptor(key, prop, optional);
	});
}

export function introspectField(key: string, field: z.ZodType): SchemaFieldDescriptor {
	const [descriptor] = introspectShape({ [key]: field });
	if (!descriptor) {
		throw new Error(`Could not introspect field "${key}"`);
	}
	return descriptor;
}
