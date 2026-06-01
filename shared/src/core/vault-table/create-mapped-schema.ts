import { z } from "zod";

export interface SerializableSchema<TData> extends z.ZodType<TData> {
	serialize: (data: TData) => Record<string, unknown>;
}

/**
 * Wraps a plain Zod schema with identity serialization.
 * Use this when no field remapping is needed.
 */
export function withSerialize<TData>(schema: z.ZodType<TData>): SerializableSchema<TData> {
	const s = schema as SerializableSchema<TData>;
	s.serialize = (data) => data as Record<string, unknown>;
	return s;
}

/**
 * Creates a Zod schema with automatic field remapping between external frontmatter keys
 * (from settings) and internal camelCase keys (from the shape).
 *
 * Convention: each shape key `foo` maps to `settings[fooProp]` which holds the external key name.
 * Pass `fieldOverrides` to remap individual keys to a different settings prop name —
 * useful when the convention doesn't fit (e.g. `categories` → `categoryProp`).
 *
 * The returned schema carries a `.serialize()` method for the reverse direction.
 * VaultTable detects this automatically — no separate serialize config needed.
 */
// Building a Zod schema is far costlier than parsing one object through it, yet on
// hot ingest paths callers build the SAME schema once per row (one per event).
// Cache it here, at the shared layer, so every plugin gets build-once-reuse for
// free without caring about it. Keyed by the shape (a stable module-level object →
// WeakMap, GC-friendly) then by the resolved external field names — the only thing
// the schema depends on — so it hits regardless of whether a caller passes a fresh
// `{ ...settings }` or a stable reference. See docs/specs/2026-05-23-prisma-perf-analysis.md (#1).
// Control-char separator for the cache key — can't appear in a frontmatter prop
// name, so joined names can't collide ("ab"+"c" vs "a"+"bc").
const CACHE_KEY_SEP = String.fromCharCode(31);
const schemaCache = new WeakMap<z.ZodRawShape, Map<string, SerializableSchema<unknown>>>();

// The field → settings-key mapping depends only on (shape, fieldOverrides), which
// are a stable module-level pair per call site — so resolve it once per shape and
// reuse the `[internalKey, settingsKey]` list on every call AND every parse
// (remap/serialize iterate it), instead of rebuilding it each time on the hot path.
const mappingByShape = new WeakMap<z.ZodRawShape, ReadonlyArray<readonly [string, string]>>();

function fieldMapping<TShape extends z.ZodRawShape>(
	shape: TShape,
	fieldOverrides?: Partial<Record<keyof TShape, string>>
): ReadonlyArray<readonly [string, string]> {
	let entries = mappingByShape.get(shape);
	if (entries === undefined) {
		entries = Object.keys(shape).map((key) => [key, fieldOverrides?.[key as keyof TShape] ?? `${key}Prop`] as const);
		mappingByShape.set(shape, entries);
	}
	return entries;
}

export function createMappedSchema<TShape extends z.ZodRawShape>(
	shape: TShape,
	settings: Record<string, unknown>,
	fieldOverrides?: Partial<Record<keyof TShape, string>>
): SerializableSchema<z.infer<z.ZodObject<TShape>>> {
	type TData = z.infer<z.ZodObject<TShape>>;

	const entries = fieldMapping(shape, fieldOverrides);

	// Cheap key: the resolved external names in shape order (stable order, no
	// sort/JSON needed), built from the memoized mapping. Runs per row on the hot
	// path, so it stays far cheaper than building the schema.
	let cacheKey = "";
	for (const [, settingsKey] of entries) {
		cacheKey += `${String(settings[settingsKey])}${CACHE_KEY_SEP}`;
	}
	let byKey = schemaCache.get(shape);
	if (byKey === undefined) {
		byKey = new Map();
		schemaCache.set(shape, byKey);
	}
	const cached = byKey.get(cacheKey);
	if (cached) return cached as unknown as SerializableSchema<TData>;

	const remapFromRaw = (raw: Record<string, unknown>): Record<string, unknown> => {
		let result: Record<string, unknown> = { ...raw };
		for (const [internalKey, settingsKey] of entries) {
			const externalKey = settings[settingsKey] as string;
			if (externalKey in raw) {
				result[internalKey] = raw[externalKey];
			}
			if (externalKey !== internalKey) {
				const { [externalKey]: _drop, ...rest } = result;
				result = rest;
			}
		}
		return result;
	};

	const serialize = (data: TData): Record<string, unknown> => {
		const result: Record<string, unknown> = {};
		for (const [internalKey, settingsKey] of entries) {
			const externalKey = settings[settingsKey] as string;
			const value = (data as Record<string, unknown>)[internalKey];
			if (value !== undefined) {
				result[externalKey] = value;
			}
		}
		return result;
	};

	const schema = z.preprocess((value) => {
		if (typeof value !== "object" || value === null) return value;
		return remapFromRaw(value as Record<string, unknown>);
	}, z.looseObject(shape)) as unknown as SerializableSchema<TData>;

	schema.serialize = serialize;

	byKey.set(cacheKey, schema as unknown as SerializableSchema<unknown>);
	return schema;
}
