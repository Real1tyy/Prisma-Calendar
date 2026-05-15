import { describe, expect, it } from "vitest";
import { z } from "zod";

import { canDeriveUrlCoercer, deriveUrlCoercer } from "../../src/integrations/api-gateway/derive-url-coercer";

describe("canDeriveUrlCoercer", () => {
	it("returns true for ZodObject", () => {
		expect(canDeriveUrlCoercer(z.object({ a: z.string() }))).toBe(true);
	});

	it("returns true for an Optional-wrapped ZodObject", () => {
		expect(canDeriveUrlCoercer(z.object({ a: z.string() }).optional())).toBe(true);
	});

	it("returns true for a Default-wrapped ZodObject", () => {
		expect(canDeriveUrlCoercer(z.object({ a: z.string() }).default({ a: "x" }))).toBe(true);
	});

	it("returns false for a primitive schema", () => {
		expect(canDeriveUrlCoercer(z.string())).toBe(false);
		expect(canDeriveUrlCoercer(z.number())).toBe(false);
	});

	it("returns false for an array schema", () => {
		expect(canDeriveUrlCoercer(z.array(z.string()))).toBe(false);
	});

	it("returns false for non-schema input", () => {
		expect(canDeriveUrlCoercer(undefined)).toBe(false);
		expect(canDeriveUrlCoercer({})).toBe(false);
	});
});

describe("deriveUrlCoercer — scalars", () => {
	it("passes strings through", () => {
		const coerce = deriveUrlCoercer(z.object({ name: z.string() }));
		expect(coerce({ name: "Alice" })).toEqual({ name: "Alice" });
	});

	it("coerces optional booleans from 'true'/'false'/'1'/'0'", () => {
		const coerce = deriveUrlCoercer(z.object({ flag: z.boolean().optional() }));
		expect(coerce({ flag: "true" })).toEqual({ flag: true });
		expect(coerce({ flag: "false" })).toEqual({ flag: false });
		expect(coerce({ flag: "1" })).toEqual({ flag: true });
		expect(coerce({ flag: "0" })).toEqual({ flag: false });
	});

	it("coerces optional numbers and drops NaN", () => {
		const coerce = deriveUrlCoercer(z.object({ offset: z.number().optional() }));
		expect(coerce({ offset: "42" })).toEqual({ offset: 42 });
		expect(coerce({ offset: "not-a-number" })).toEqual({});
	});

	it("passes enum values through (downstream Zod parsing validates)", () => {
		const coerce = deriveUrlCoercer(
			z.object({
				mode: z.enum(["day", "week", "month"]).optional(),
			})
		);
		expect(coerce({ mode: "week" })).toEqual({ mode: "week" });
		expect(coerce({})).toEqual({});
	});
});

describe("deriveUrlCoercer — arrays", () => {
	it("splits a comma-separated string into an array", () => {
		const coerce = deriveUrlCoercer(z.object({ tags: z.array(z.string()).optional() }));
		expect(coerce({ tags: "a,b,c" })).toEqual({ tags: ["a", "b", "c"] });
	});

	it("trims and drops empty entries", () => {
		const coerce = deriveUrlCoercer(z.object({ tags: z.array(z.string()).optional() }));
		expect(coerce({ tags: " a , , b ," })).toEqual({ tags: ["a", "b"] });
	});

	it("throws at build time for arrays of non-strings", () => {
		expect(() => deriveUrlCoercer(z.object({ nums: z.array(z.number()) }))).toThrow(
			/only arrays of strings are URL-representable/
		);
	});
});

describe("deriveUrlCoercer — required vs optional fields", () => {
	it("throws at invoke time when a required field is missing", () => {
		const coerce = deriveUrlCoercer(z.object({ id: z.string() }));
		expect(() => coerce({})).toThrow(/Missing required URL parameter: id/);
	});

	it("omits absent optional fields entirely from the result", () => {
		const coerce = deriveUrlCoercer(z.object({ name: z.string(), nickname: z.string().optional() }));
		const out = coerce({ name: "Alice" });
		expect(out).toEqual({ name: "Alice" });
		expect("nickname" in out).toBe(false);
	});

	it("treats top-level Optional and Default wrappers as 'whole input may be absent' but still expects an object", () => {
		const coerce = deriveUrlCoercer(z.object({ id: z.string().optional() }).optional());
		expect(coerce({})).toEqual({});
		expect(coerce({ id: "x" })).toEqual({ id: "x" });
	});
});

describe("deriveUrlCoercer — unsupported shapes", () => {
	it("rejects a non-object top-level schema", () => {
		expect(() => deriveUrlCoercer(z.string())).toThrow(/top-level input schema must be a ZodObject/);
	});

	it("rejects records (nested key/value maps that URL params can't represent)", () => {
		expect(() => deriveUrlCoercer(z.object({ meta: z.record(z.string(), z.string()) }))).toThrow(
			/unsupported type "record"/
		);
	});

	it("rejects nested objects", () => {
		expect(() =>
			deriveUrlCoercer(
				z.object({
					nested: z.object({ a: z.string() }),
				})
			)
		).toThrow(/unsupported type "object"/);
	});
});
