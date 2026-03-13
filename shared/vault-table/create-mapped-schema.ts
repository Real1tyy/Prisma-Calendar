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
 *
 * The returned schema carries a `.serialize()` method for the reverse direction.
 * VaultTable detects this automatically — no separate serialize config needed.
 */
export function createMappedSchema<TShape extends z.ZodRawShape>(
	shape: TShape,
	settings: Record<string, unknown>
): SerializableSchema<z.infer<z.ZodObject<TShape>>> {
	type TData = z.infer<z.ZodObject<TShape>>;

	const fieldToSettingsKey = Object.fromEntries(Object.keys(shape).map((key) => [key, `${key}Prop`])) as Record<
		string,
		string
	>;

	const remapFromRaw = (raw: Record<string, unknown>): Record<string, unknown> => {
		const result: Record<string, unknown> = { ...raw };
		for (const [internalKey, settingsKey] of Object.entries(fieldToSettingsKey)) {
			const externalKey = settings[settingsKey] as string;
			result[internalKey] = raw[externalKey];
		}
		return result;
	};

	const serialize = (data: TData): Record<string, unknown> => {
		const result: Record<string, unknown> = {};
		for (const [internalKey, settingsKey] of Object.entries(fieldToSettingsKey)) {
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

	return schema;
}
