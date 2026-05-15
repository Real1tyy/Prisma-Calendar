import type { z } from "zod";

import { ParamCoercion } from "./param-coercion";

/**
 * Schema-driven URL parameter coercion.
 *
 * URL strings are flat — `obsidian://protocolKey?call=foo&allDay=true&...`.
 * To call a typed handler from one, we have to know each field's target type
 * to apply the right `ParamCoercion.*`. Historically each action carried its
 * own hand-written `parseParams: (raw) => ({ allDay: ParamCoercion.boolean(...) })`,
 * which duplicated type information that already lives in the `input` Zod
 * schema.
 *
 * `deriveUrlCoercer` walks the schema once at gateway-build time and emits a
 * single `(raw) => T` closure. It is the *only* place URL transport conventions
 * live (comma-separated arrays, "true"/"1" booleans). Custom URL parsing
 * (multi-key fan-in, renames) stays available as the `parseParams` escape
 * hatch on `ActionDef`.
 */

interface FieldCoercer {
	coerce: (raw: Record<string, string>, key: string) => unknown;
}

interface UnwrappedSchema {
	inner: unknown;
	isOptional: boolean;
}

/**
 * Strips `ZodOptional` / `ZodNullable` / `ZodDefault` wrappers. URL params
 * can't distinguish "missing" from "null", and a default value never reaches
 * the wire — the inner type is the only thing that matters for coercion.
 */
function unwrapWrappers(schema: unknown): UnwrappedSchema {
	if (typeof schema !== "object" || schema === null) {
		return { inner: schema, isOptional: false };
	}
	const def = (schema as { def?: { type?: string; innerType?: unknown } }).def;
	if (def && (def.type === "optional" || def.type === "nullable" || def.type === "default")) {
		const inner = unwrapWrappers(def.innerType);
		return { inner: inner.inner, isOptional: true };
	}
	return { inner: schema, isOptional: false };
}

function deriveFieldCoercer(fieldSchema: unknown, fieldName: string): FieldCoercer {
	const { inner, isOptional } = unwrapWrappers(fieldSchema);
	if (typeof inner !== "object" || inner === null) {
		throw new Error(`deriveUrlCoercer: field "${fieldName}" has no recognisable Zod schema`);
	}
	const innerDef = (inner as { def?: { type?: string; element?: unknown } }).def;
	if (!innerDef || typeof innerDef.type !== "string") {
		throw new Error(`deriveUrlCoercer: field "${fieldName}" has no recognisable Zod schema`);
	}

	if (innerDef.type === "array") {
		const element = innerDef.element as { def?: { type?: string } } | undefined;
		const elementType = element?.def?.type;
		if (elementType !== "string") {
			throw new Error(
				`deriveUrlCoercer: field "${fieldName}" is an array of "${elementType ?? "?"}"; only arrays of strings are URL-representable (comma-separated).`
			);
		}
		return {
			coerce: isOptional
				? (raw, key) => ParamCoercion.stringArray(raw, key)
				: (raw, key) => ParamCoercion.required.stringArray(raw, key),
		};
	}

	const scalarMap = isOptional
		? {
				string: (raw: Record<string, string>, key: string) => ParamCoercion.string(raw, key),
				number: (raw: Record<string, string>, key: string) => ParamCoercion.number(raw, key),
				boolean: (raw: Record<string, string>, key: string) => ParamCoercion.boolean(raw, key),
				enum: (raw: Record<string, string>, key: string) => ParamCoercion.string(raw, key),
			}
		: {
				string: (raw: Record<string, string>, key: string) => ParamCoercion.required.string(raw, key),
				number: (raw: Record<string, string>, key: string) => ParamCoercion.required.number(raw, key),
				boolean: (raw: Record<string, string>, key: string) => ParamCoercion.required.boolean(raw, key),
				enum: (raw: Record<string, string>, key: string) => ParamCoercion.required.string(raw, key),
			};

	const fn = (scalarMap as Record<string, FieldCoercer["coerce"] | undefined>)[innerDef.type];
	if (!fn) {
		throw new Error(
			`deriveUrlCoercer: field "${fieldName}" has unsupported type "${innerDef.type}". URL params can only carry strings, numbers, booleans, string enums, or arrays of strings — wrap the action in a custom \`parseParams\` if it needs something else.`
		);
	}
	return { coerce: fn };
}

/**
 * Returns `true` if `schema` is a (possibly Optional/Nullable/Default-wrapped)
 * `ZodObject`. The gateway uses this to decide whether the schema is rich
 * enough to drive URL coercion automatically, or whether the action needs an
 * explicit `parseParams`.
 */
export function canDeriveUrlCoercer(schema: unknown): boolean {
	const { inner } = unwrapWrappers(schema);
	if (typeof inner !== "object" || inner === null) return false;
	const innerDef = (inner as { def?: { type?: string } }).def;
	return innerDef?.type === "object";
}

export function deriveUrlCoercer<T>(schema: z.ZodType<T>): (raw: Record<string, string>) => T {
	const { inner } = unwrapWrappers(schema);
	if (typeof inner !== "object" || inner === null) {
		throw new Error(
			"deriveUrlCoercer: top-level input schema must be a ZodObject (URL params cannot represent non-object inputs)."
		);
	}
	const innerDef = (inner as { def?: { type?: string; shape?: Record<string, unknown> } }).def;
	if (!innerDef || innerDef.type !== "object") {
		throw new Error(
			"deriveUrlCoercer: top-level input schema must be a ZodObject (URL params cannot represent non-object inputs)."
		);
	}

	const shape = innerDef.shape ?? {};
	const fieldEntries = Object.entries(shape).map(
		([key, fieldSchema]) => [key, deriveFieldCoercer(fieldSchema, key)] as const
	);

	return (raw) => {
		const out: Record<string, unknown> = {};
		for (const [key, coercer] of fieldEntries) {
			const value = coercer.coerce(raw, key);
			if (value !== undefined) out[key] = value;
		}
		return out as T;
	};
}
