import { parseDateTimeString, parseTimeString } from "@real1ty-obsidian-plugins/utils/date-utils";
import { DateTime } from "luxon";
import { z } from "zod";

export type ISO = string;

export const ColorSchema = z.string().refine((color) => {
	const testEl = document.createElement("div");
	testEl.style.color = color;
	return testEl.style.color !== "";
}, "Invalid CSS color format");

export const timezoneSchema = z
	.unknown()
	.transform((value) => {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
		return undefined;
	})
	.pipe(z.string().optional())
	.refine((timezone) => {
		if (!timezone || timezone === "system") return true;

		// Validate timezone using Luxon
		try {
			const testDate = DateTime.now().setZone(timezone);
			return testDate.isValid;
		} catch {
			return false;
		}
	}, "Invalid timezone identifier");

export const booleanTransform = z
	.unknown()
	.transform((value) => {
		if (typeof value === "boolean") return value;
		if (typeof value === "string") {
			const lower = value.toLowerCase();
			if (lower === "true") return true;
			if (lower === "false") return false;
		}
		return false;
	})
	.pipe(z.boolean());

export const requiredDateTimeTransform = z.string().transform((val, ctx) => {
	const result = parseDateTimeString(val);
	if (!result) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: `Invalid datetime format: ${val}`,
		});
		return z.NEVER;
	}
	return result;
});

export const optionalDateTimeTransform = z
	.union([z.string(), z.null()])
	.transform((val) => parseDateTimeString(val))
	.refine((val): val is DateTime | undefined => val === undefined || val instanceof DateTime, {
		message: "Invalid datetime format",
	})
	.optional();

export const requiredTimeTransform = z.string().transform((val, ctx) => {
	const result = parseTimeString(val);
	if (!result) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: `Invalid time format: ${val}`,
		});
		return z.NEVER;
	}
	return result;
});

export const optionalTimeTransform = z
	.union([z.string(), z.null()])
	.transform((val) => parseTimeString(val))
	.refine((val): val is DateTime | undefined => val === undefined || val instanceof DateTime, {
		message: "Invalid time format",
	})
	.optional();
