import {
	createMappedSchema,
	optionalDateTimeTransform,
	optionalDateTransform,
	optionalListTransform,
	optionalNumber,
	optionalPositiveNumber,
	optionalTrimmedString,
	requiredDateTimeTransform,
	requiredDateTransform,
	strictBooleanOptional,
	titleTransform,
} from "@real1ty-obsidian-plugins";
import { z } from "zod";

import type { SingleCalendarConfig } from "./settings";

/**
 * Boolean coercion for the `allDay` frontmatter flag. Accepts `true`, `"true"`
 * (case-insensitive), or anything else (→ `false`). Stays optional in the
 * canonical envelope so callers can distinguish "absent" from "explicitly false".
 */
const allDayTransform = z
	.unknown()
	.optional()
	.transform((value) => {
		if (value === true) return true;
		if (typeof value === "string" && value.toLowerCase() === "true") return true;
		if (value == null || value === "") return undefined;
		return false;
	});

/**
 * Canonical event frontmatter shape — internal camelCase keys produced by mapping
 * settings-driven external property names. Used to drive a single mapped Zod schema
 * over the entire event frontmatter (timing + identity + metadata).
 *
 * Per-field transforms run during parse; the result is a fully typed envelope that
 * downstream event schemas (timed/all-day/untracked) consume without touching raw
 * frontmatter or settings prop names.
 */
const EventFrontmatterShape = {
	// ── Timing & identity (convention: `${key}Prop`) ──
	// Date/time fields catch parse failures → undefined so the unified envelope
	// always succeeds; downstream event schemas decide validity based on presence.
	start: optionalDateTimeTransform.catch(undefined),
	end: optionalDateTimeTransform.catch(undefined),
	date: optionalDateTransform.catch(undefined),
	allDay: allDayTransform,
	title: optionalTrimmedString,
	calendarTitle: optionalTrimmedString,
	zettelId: optionalTrimmedString,
	sortDate: optionalTrimmedString,

	// ── Metadata fields (overrides below for non-conventional mappings) ──
	skip: strictBooleanOptional.optional(),
	location: optionalTrimmedString,
	participants: optionalListTransform,
	categories: optionalListTransform,
	breakMinutes: optionalPositiveNumber,
	icon: optionalTrimmedString,
	status: optionalTrimmedString,
	minutesBefore: optionalNumber,
	daysBefore: optionalNumber,
	alreadyNotified: strictBooleanOptional.optional(),
	rruleType: optionalTrimmedString,
	rruleSpec: optionalTrimmedString,
	rruleId: optionalTrimmedString,
	instanceDate: optionalTrimmedString,
	source: optionalTrimmedString,
	futureInstancesCount: optionalPositiveNumber,
	generatePastEvents: strictBooleanOptional.optional(),
	caldav: z.unknown().optional(),
	icsSubscription: z.unknown().optional(),
} as const;

/**
 * Settings prop overrides for keys that don't follow the `${key}Prop` convention.
 */
const FIELD_OVERRIDES: Partial<Record<keyof typeof EventFrontmatterShape, string>> = {
	categories: "categoryProp",
	breakMinutes: "breakProp",
	status: "statusProperty",
	rruleType: "rruleProp",
};

/**
 * Builds the unified mapped Zod schema for the entire event frontmatter,
 * driven by the calendar settings' property name configuration.
 *
 * Output is a typed envelope with internal canonical keys; raw frontmatter keys
 * are remapped automatically. Use `.serialize()` for the reverse direction.
 */
export function createEventFrontmatterSchema(settings: SingleCalendarConfig) {
	return createMappedSchema(EventFrontmatterShape, { ...settings }, FIELD_OVERRIDES);
}

export type ParsedEventFrontmatter = ReturnType<typeof createEventFrontmatterSchema>["_output"];

// ─── Validated Event Frontmatter Schemas ────────────────────────────
// Strict discriminated schemas used by `parseEventFrontmatter` to distinguish
// timed vs all-day events after reading the raw frontmatter values. Unlike the
// mapped schema above, these fail parsing when required fields are missing.

const BaseEventFrontmatterSchema = z.object({
	title: titleTransform,
});

export const TimedEventFrontmatterSchema = BaseEventFrontmatterSchema.extend({
	startTime: requiredDateTimeTransform,
	endTime: optionalDateTimeTransform,
	allDay: z.literal(false).optional().nullable(),
}).strict();

export const AllDayEventFrontmatterSchema = BaseEventFrontmatterSchema.extend({
	date: requiredDateTransform,
	allDay: z.literal(true),
}).strict();

export type CalendarEventFrontmatter =
	| z.infer<typeof TimedEventFrontmatterSchema>
	| z.infer<typeof AllDayEventFrontmatterSchema>;
