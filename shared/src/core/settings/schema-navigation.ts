import type { ZodRawShape } from "zod";

/**
 * Gets a nested property value from an object using dot notation (e.g., "basesView.tasksDirectory").
 */
export function getNestedValue(obj: Record<string, unknown>, key: string): unknown {
	const keys = key.split(".");
	let value: unknown = obj;

	for (const k of keys) {
		if (value === undefined || value === null) {
			return undefined;
		}
		value = (value as Record<string, unknown>)[k];
	}

	return value;
}

/**
 * Sets a nested property value using dot notation and returns a new object
 * with the change applied. Copy-on-write along the dotted path — only
 * ancestors of the changed key are shallow-cloned; sibling branches keep
 * their references, which avoids the O(size) cost of a full deep clone.
 *
 * Intended for JSON-shaped settings (Zod-parsed, round-trips through
 * `loadData` / `saveData`). Missing ancestors are created as `{}`. Arrays
 * may only appear as terminal values — a path that crosses an array
 * mid-way is outside the intended use and will silently overwrite it.
 */
export function setNestedValue<T extends Record<string, unknown>>(obj: T, key: string, value: unknown): T {
	const keys = key.split(".");
	const newRoot: Record<string, unknown> = { ...obj };

	let current: Record<string, unknown> = newRoot;
	for (let i = 0; i < keys.length - 1; i++) {
		const k = keys[i];
		const existing = current[k];
		const nextLevel: Record<string, unknown> =
			existing && typeof existing === "object" && !Array.isArray(existing)
				? { ...(existing as Record<string, unknown>) }
				: {};
		current[k] = nextLevel;
		current = nextLevel;
	}

	current[keys[keys.length - 1]] = value;

	return newRoot as T;
}

/**
 * Navigates a Zod schema shape using dot notation to find a nested field schema.
 * Unwraps intermediate wrapper types (optional, default, catch, etc.) along the way.
 */
export function navigateSchema(shape: ZodRawShape, dottedKey: string): unknown | undefined {
	const keys = dottedKey.split(".");
	let fieldSchema: unknown = shape;

	for (const k of keys) {
		if (!fieldSchema) return undefined;

		fieldSchema = unwrapInnerSchema(fieldSchema);

		if (fieldSchema && typeof fieldSchema === "object" && "shape" in fieldSchema) {
			fieldSchema = (fieldSchema as { shape: Record<string, unknown> }).shape?.[k];
		} else if (fieldSchema && typeof fieldSchema === "object" && k in fieldSchema) {
			fieldSchema = (fieldSchema as Record<string, unknown>)[k];
		} else {
			return undefined;
		}
	}

	return fieldSchema;
}

/**
 * Safely accesses the _def property of a Zod schema object.
 */
function getDef(schema: unknown): Record<string, unknown> | undefined {
	if (!schema || typeof schema !== "object" || !("_def" in schema)) return undefined;
	const def = (schema as Record<string, unknown>)["_def"];
	return def && typeof def === "object" ? (def as Record<string, unknown>) : undefined;
}

/**
 * Unwraps Zod wrapper types (_def.innerType chain) to get the core schema.
 */
export function unwrapInnerSchema(schema: unknown): unknown {
	let inner = schema;
	let def = getDef(inner);
	while (def && "innerType" in def) {
		inner = def["innerType"];
		def = getDef(inner);
	}
	return inner;
}

/**
 * Gets the Zod type name from a (possibly wrapped) schema.
 */
function getTypeName(schema: unknown): string | undefined {
	return getDef(schema)?.["typeName"] as string | undefined;
}

/**
 * Infers slider bounds (min/max) from a Zod number schema at the given key.
 */
export function inferSliderBounds(shape: ZodRawShape, key: string): { min?: number; max?: number } {
	try {
		const fieldSchema = navigateSchema(shape, key);
		if (!fieldSchema) return {};

		const innerSchema = unwrapInnerSchema(fieldSchema);
		if (getTypeName(innerSchema) !== "ZodNumber") return {};

		const def = getDef(innerSchema);
		const checks = def?.["checks"] as Array<{ kind: string; value: number }> | undefined;
		if (!checks) return {};

		let min: number | undefined;
		let max: number | undefined;

		for (const check of checks) {
			if (check.kind === "min") min = check.value;
			if (check.kind === "max") max = check.value;
		}

		return {
			...(min !== undefined ? { min } : {}),
			...(max !== undefined ? { max } : {}),
		};
	} catch (error) {
		console.warn(`Failed to infer slider bounds for key ${key}:`, error);
		return {};
	}
}

/**
 * Infers the array item type ("string" | "number") from a Zod array schema at the given key.
 */
export function inferArrayItemType(shape: ZodRawShape, key: string): "string" | "number" | undefined {
	try {
		const fieldSchema = navigateSchema(shape, key);
		if (!fieldSchema) return undefined;

		const innerSchema = unwrapInnerSchema(fieldSchema);
		if (getTypeName(innerSchema) !== "ZodArray") return undefined;

		const def = getDef(innerSchema);
		const elementType = def?.["type"] as unknown;
		const elementTypeName = getTypeName(elementType);

		if (elementTypeName === "ZodNumber") return "number";
		if (elementTypeName === "ZodString") return "string";

		return undefined;
	} catch (error) {
		console.warn(`Failed to infer array item type for key ${key}:`, error);
		return undefined;
	}
}
