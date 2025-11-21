import { parseDateTimeString, parseTimeString } from "@real1ty-obsidian-plugins/utils";
import { DateTime } from "luxon";
import { z } from "zod";

export type ISO = string;

export const titleTransform = z
	.unknown()
	.transform((value) => {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
		return undefined;
	})
	.pipe(z.string().optional());

function requiredParsed<T>(what: string, parse: (s: string) => T | undefined) {
	return z.string().transform((val, ctx) => {
		const result = parse(val);
		if (result === undefined) {
			ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid ${what} format: ${val}` });
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
						ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid ${what} format` });
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

export const requiredDateTimeTransform = requiredParsed<DateTime>("datetime", parseDT);
export const optionalDateTimeTransform = optionalParsed<DateTime>("datetime", parseDT);

// Time
export const requiredTimeTransform = requiredParsed<DateTime>("time", parseTime);
export const optionalTimeTransform = optionalParsed<DateTime>("time", parseTime);

// Date
export const requiredDateTransform = requiredParsed<DateTime>("date", parseISODateStart);
export const optionalDateTransform = optionalParsed<DateTime>("date", parseISODateStart);
