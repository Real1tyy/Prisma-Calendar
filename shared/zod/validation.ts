import { DateTime } from "luxon";
import { z } from "zod";

import { parseDateTimeString, parseTimeString } from "../date/date";
import { parseIntoList } from "../utils/list-utils";

export type ISO = string;

function requiredParsed<T>(what: string, parse: (s: string) => T | undefined) {
	return z.string().transform((val, ctx) => {
		const result = parse(val);
		if (result === undefined) {
			ctx.addIssue({
				code: "custom",
				message: `Invalid ${what} format: ${val}`,
			});
			return z.NEVER;
		}
		return result;
	});
}

function optionalParsed<T>(what: string, parse: (s: string) => T | undefined) {
	return z
		.preprocess(
			(val) => {
				if (val == null) return undefined;
				if (typeof val !== "string") return val;
				const trimmed = val.trim();
				return trimmed === "" ? undefined : trimmed;
			},
			z
				.string()
				.transform((val, ctx) => {
					const result = parse(val);
					if (result === undefined) {
						ctx.addIssue({ code: "custom", message: `Invalid ${what} format` });
						return z.NEVER;
					}
					return result;
				})
				.optional()
		)
		.optional();
}

const parseDT = (s: string) => parseDateTimeString(s);
const parseTime = (s: string) => parseTimeString(s);

const parseISODateStart = (s: string) => {
	const dt = DateTime.fromISO(s, { zone: "utc" });
	return dt.isValid ? dt.startOf("day") : undefined;
};

export const titleTransform = z
	.unknown()
	.transform((value) => {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
		return undefined;
	})
	.pipe(z.string().optional());

export const ColorSchema = z
	.string()
	.refine(
		(color) => (typeof CSS !== "undefined" && typeof CSS.supports === "function" ? CSS.supports("color", color) : true),
		"Invalid CSS color format"
	);

export const booleanTransform = z.preprocess((value) => {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") {
		const lower = value.toLowerCase();
		if (lower === "true") return true;
		if (lower === "false") return false;
	}
	return false;
}, z.boolean());

/** Trimmed string → undefined if empty */
export const optionalTrimmedString = z
	.unknown()
	.transform((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined))
	.pipe(z.string().optional());

/** Unknown → string[] via parseIntoList, undefined if empty */
export const optionalListTransform = z
	.unknown()
	.transform((v) => {
		if (!v) return undefined;
		const list = parseIntoList(v);
		return list.length > 0 ? list : undefined;
	})
	.pipe(z.array(z.string()).optional());

/** Unknown → positive number, undefined otherwise */
export const optionalPositiveNumber = z
	.unknown()
	.transform((v) => {
		if (v == null) return undefined;
		const n = Number(v);
		return !Number.isNaN(n) && n > 0 ? n : undefined;
	})
	.pipe(z.number().optional());

/** Unknown → non-negative integer, undefined otherwise */
export const optionalNonNegativeInt = z
	.unknown()
	.transform((v) => {
		if (v == null) return undefined;
		const n = Number.parseInt(String(v), 10);
		return !Number.isNaN(n) && n >= 0 ? n : undefined;
	})
	.pipe(z.number().optional());

/** Unknown → number (any valid finite number), undefined otherwise */
export const optionalNumber = z
	.unknown()
	.transform((v) => {
		if (v == null) return undefined;
		const n = Number(v);
		return Number.isFinite(n) ? n : undefined;
	})
	.pipe(z.number().optional());

/** Unknown → true if boolean true or string "true" */
export const strictBooleanTransform = z
	.unknown()
	.transform((v) => v === true || v === "true")
	.pipe(z.boolean());

/** Optional unknown → boolean | undefined; missing/undefined stays undefined so the key can be omitted */
export const strictBooleanOptional = z
	.unknown()
	.optional()
	.transform((v) => (v === true || v === "true" ? true : v === undefined ? undefined : false));

export const requiredDateTimeTransform = requiredParsed<DateTime>("datetime", parseDT);
export const optionalDateTimeTransform = optionalParsed<DateTime>("datetime", parseDT);

export const optionalTimeTransform = optionalParsed<DateTime>("time", parseTime);

export const requiredDateTransform = requiredParsed<DateTime>("date", parseISODateStart);
export const optionalDateTransform = optionalParsed<DateTime>("date", parseISODateStart);
