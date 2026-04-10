import { z } from "zod";
import type { $ZodType } from "zod/v4/core";

import {
	type FieldType,
	type JSONSchemaProperty,
	resolveFieldType,
	schemaToJSONSchema,
} from "../../utils/zod/introspection";

type ZodShape = Record<string, $ZodType>;

// ─── Scalar Schemas ────────────────────────────────────────────

export const FieldTypeSchema = z.enum(["string", "number", "boolean", "date", "unknown"]);

export const FilterOperatorSchema = z.enum([
	"eq",
	"neq",
	"contains",
	"startsWith",
	"endsWith",
	"gt",
	"lt",
	"gte",
	"lte",
	"before",
	"after",
	"in",
]);

export const RestSortDirectionSchema = z.enum(["asc", "desc"]);

export const RestFilterValueSchema = z.union([z.string(), z.number(), z.boolean()]);

// ─── Structural Schemas ────────────────────────────────────────

export const FilterFieldSchema = z.object({
	key: z.string().min(1),
	operators: z.array(FilterOperatorSchema).min(1),
	type: FieldTypeSchema,
});

export const SortFieldSchema = z.object({
	key: z.string().min(1),
	type: FieldTypeSchema,
});

export const ParsedFilterSchema = z.object({
	field: z.string().min(1),
	operator: FilterOperatorSchema,
	value: RestFilterValueSchema,
});

export const ParsedSortSchema = z.object({
	field: z.string().min(1),
	direction: RestSortDirectionSchema,
});

// ─── Inferred Types ────────────────────────────────────────────

export type FilterOperator = z.infer<typeof FilterOperatorSchema>;
export type RestSortDirection = z.infer<typeof RestSortDirectionSchema>;
export type RestFilterValue = z.infer<typeof RestFilterValueSchema>;
export type FilterField = z.infer<typeof FilterFieldSchema>;
export type SortField = z.infer<typeof SortFieldSchema>;
export type ParsedFilter = z.infer<typeof ParsedFilterSchema>;
export type ParsedSort = z.infer<typeof ParsedSortSchema>;

// ─── Operator sets per field type ──────────────────────────────

const STRING_OPERATORS: FilterOperator[] = ["eq", "neq", "contains", "startsWith", "endsWith", "in"];
const NUMBER_OPERATORS: FilterOperator[] = ["eq", "neq", "gt", "lt", "gte", "lte"];
const BOOLEAN_OPERATORS: FilterOperator[] = ["eq", "neq"];
const DATE_OPERATORS: FilterOperator[] = ["eq", "neq", "before", "after", "gte", "lte"];

export const OPERATORS_BY_TYPE: Record<FieldType, FilterOperator[]> = {
	string: STRING_OPERATORS,
	number: NUMBER_OPERATORS,
	boolean: BOOLEAN_OPERATORS,
	date: DATE_OPERATORS,
	unknown: [],
};

const RESERVED_PARAMS = new Set(["sort", "limit", "offset"]);

const OPERATOR_SUFFIXES: FilterOperator[] = [
	"contains",
	"startsWith",
	"endsWith",
	"neq",
	"gte",
	"lte",
	"gt",
	"lt",
	"before",
	"after",
	"in",
];

// ─── Schema Introspection ──────────────────────────────────────

function shapeToProperties(shape: ZodShape): Record<string, JSONSchemaProperty> {
	const jsonSchema = schemaToJSONSchema(z.object(shape));
	return jsonSchema.properties ?? {};
}

function inferFields<T>(shape: ZodShape, mapFn: (key: string, type: FieldType) => T): T[] {
	const properties = shapeToProperties(shape);
	return Object.entries(properties)
		.map(([key, prop]) => ({ key, type: resolveFieldType(prop) }))
		.filter(({ type }) => type !== "unknown")
		.map(({ key, type }) => mapFn(key, type));
}

export function inferFilterFields(shape: ZodShape): FilterField[] {
	return inferFields(shape, (key, type) => ({ key, operators: OPERATORS_BY_TYPE[type], type }));
}

export function inferSortFields(shape: ZodShape): SortField[] {
	return inferFields(shape, (key, type) => ({ key, type }));
}

// ─── Query Param Parsing ───────────────────────────────────────

function resolveFieldAndOperator(
	rawKey: string,
	fieldMap: Map<string, FilterField>
): { field: string; operator: FilterOperator } | null {
	for (const suffix of OPERATOR_SUFFIXES) {
		const prefix = rawKey.slice(0, -(suffix.length + 1));
		if (rawKey.endsWith(`_${suffix}`) && fieldMap.has(prefix)) {
			return { field: prefix, operator: suffix };
		}
	}

	if (fieldMap.has(rawKey)) {
		return { field: rawKey, operator: "eq" };
	}

	return null;
}

export function parseFilterParams(query: Record<string, string>, fields: FilterField[]): ParsedFilter[] {
	const fieldMap = new Map(fields.map((f) => [f.key, f]));

	return Object.entries(query)
		.filter(([key]) => !RESERVED_PARAMS.has(key))
		.map(([rawKey, rawValue]) => {
			const resolved = resolveFieldAndOperator(rawKey, fieldMap);
			if (!resolved) return null;

			const fieldDef = fieldMap.get(resolved.field)!;
			if (!fieldDef.operators.includes(resolved.operator)) return null;

			return {
				field: resolved.field,
				operator: resolved.operator,
				value: coerceValue(rawValue, fieldDef.type),
			} satisfies ParsedFilter;
		})
		.filter((f): f is ParsedFilter => f !== null);
}

export function parseSortParams(query: Record<string, string>): ParsedSort[] {
	const sortParam = query["sort"];
	if (!sortParam) return [];

	return sortParam.split(",").map((segment) => {
		const [field, dir] = segment.trim().split(":");
		return { field, direction: dir === "desc" ? "desc" : "asc" } satisfies ParsedSort;
	});
}

export function coerceValue(raw: string, type: FieldType): RestFilterValue {
	switch (type) {
		case "number":
			return Number(raw);
		case "boolean":
			return raw === "true" || raw === "1";
		default:
			return raw;
	}
}

// ─── Filter Application ───────────────────────────────────────

export function applyFilters<T extends Record<string, unknown>>(items: T[], filters: ParsedFilter[]): T[] {
	if (filters.length === 0) return items;

	return items.filter((item) => filters.every((f) => matchesFilter(item, f)));
}

/** Tests whether a single record matches all filters. Used by VaultTableQuery for zero-allocation filtering. */
export function matchesAllFilters(item: Record<string, unknown>, filters: ParsedFilter[]): boolean {
	return filters.every((f) => matchesFilter(item, f));
}

function matchesFilter(item: Record<string, unknown>, filter: ParsedFilter): boolean {
	const val = item[filter.field];
	if (val === undefined || val === null) return false;

	const filterVal = filter.value;

	switch (filter.operator) {
		case "eq":
			return String(val) === String(filterVal);
		case "neq":
			return String(val) !== String(filterVal);
		case "contains":
			return String(val).toLowerCase().includes(String(filterVal).toLowerCase());
		case "startsWith":
			return String(val).toLowerCase().startsWith(String(filterVal).toLowerCase());
		case "endsWith":
			return String(val).toLowerCase().endsWith(String(filterVal).toLowerCase());
		case "in":
			return String(filterVal).split(",").includes(String(val));
		case "gt":
		case "after":
			return compareValues(val, filterVal) > 0;
		case "lt":
		case "before":
			return compareValues(val, filterVal) < 0;
		case "gte":
			return compareValues(val, filterVal) >= 0;
		case "lte":
			return compareValues(val, filterVal) <= 0;
	}
}

function compareValues(a: unknown, b: unknown): number {
	if (typeof a === "number" && typeof b === "number") return a - b;
	return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

// ─── Sort Application ─────────────────────────────────────────

export function applySorts<T extends Record<string, unknown>>(
	items: T[],
	sorts: ParsedSort[],
	fields: SortField[]
): T[] {
	if (sorts.length === 0) return items;

	const fieldMap = new Map(fields.map((f) => [f.key, f]));

	return [...items].sort((a, b) => {
		for (const sort of sorts) {
			const fieldDef = fieldMap.get(sort.field);
			if (!fieldDef) continue;

			const aVal = a[sort.field];
			const bVal = b[sort.field];

			if (aVal === undefined && bVal === undefined) continue;
			if (aVal === undefined) return 1;
			if (bVal === undefined) return -1;

			const cmp = compareSortValues(aVal, bVal, fieldDef.type);
			if (cmp !== 0) return sort.direction === "desc" ? -cmp : cmp;
		}
		return 0;
	});
}

/** Returns a sorted copy of items by accessing a nested data object via accessor. */
export function sortByFields<T>(
	items: T[],
	sorts: ParsedSort[],
	fields: SortField[],
	accessor: (item: T) => Record<string, unknown>
): T[] {
	if (sorts.length === 0) return items;

	const fieldMap = new Map(fields.map((f) => [f.key, f]));
	const resolvedSorts = sorts
		.map((sort) => {
			const field = fieldMap.get(sort.field);
			return field ? { field: sort.field, direction: sort.direction, fieldType: field.type } : null;
		})
		.filter((x): x is { field: string; direction: ParsedSort["direction"]; fieldType: FieldType } => x !== null);

	if (resolvedSorts.length === 0) return items;

	return [...items].sort((a, b) => {
		const aData = accessor(a);
		const bData = accessor(b);
		for (const sort of resolvedSorts) {
			const aVal = aData[sort.field];
			const bVal = bData[sort.field];

			if (aVal === undefined && bVal === undefined) continue;
			if (aVal === undefined) return 1;
			if (bVal === undefined) return -1;

			const cmp = compareSortValues(aVal, bVal, sort.fieldType);
			if (cmp !== 0) return sort.direction === "desc" ? -cmp : cmp;
		}
		return 0;
	});
}

function compareSortValues(a: unknown, b: unknown, type: FieldType): number {
	switch (type) {
		case "number":
			return Number(a) - Number(b);
		case "boolean":
			return Number(a) - Number(b);
		case "date":
		case "string":
		default:
			return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
	}
}
