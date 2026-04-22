import { parsePositiveInt } from "@real1ty-obsidian-plugins";
import type { DateTime } from "luxon";

import type { Frontmatter } from "../types/index";
import type { ParsedRecurrence, RecurrenceFreq, RecurrencePreset, RRuleFrontmatter } from "../types/recurring";
import {
	CUSTOM_RRULE_PATTERN,
	RECURRENCE_TYPE_OPTIONS,
	RRuleFrontmatterSchema,
	WEEKDAY_SUPPORTED_TYPES,
} from "../types/recurring";
import type { SingleCalendarConfig } from "../types/settings";
import { iterateOccurrencesInRange } from "./date-recurrence";

// ─── Recurrence DSL Parsers ──────────────────────────────────────────

const PRESET_TO_PARSED: Record<RecurrencePreset, ParsedRecurrence> = {
	daily: { freq: "DAILY", interval: 1 },
	"bi-daily": { freq: "DAILY", interval: 2 },
	weekdays: { freq: "WEEKLY", interval: 1 },
	weekends: { freq: "WEEKLY", interval: 1 },
	weekly: { freq: "WEEKLY", interval: 1 },
	"bi-weekly": { freq: "WEEKLY", interval: 2 },
	monthly: { freq: "MONTHLY", interval: 1 },
	"bi-monthly": { freq: "MONTHLY", interval: 2 },
	quarterly: { freq: "MONTHLY", interval: 3 },
	"semi-annual": { freq: "MONTHLY", interval: 6 },
	yearly: { freq: "YEARLY", interval: 1 },
};

const FREQ_LABELS: Record<RecurrenceFreq, { singular: string; plural: string }> = {
	DAILY: { singular: "day", plural: "days" },
	WEEKLY: { singular: "week", plural: "weeks" },
	MONTHLY: { singular: "month", plural: "months" },
	YEARLY: { singular: "year", plural: "years" },
};

export function isPresetType(value: string): value is RecurrencePreset {
	return value in RECURRENCE_TYPE_OPTIONS;
}

export function parseRecurrenceType(value: string): ParsedRecurrence | null {
	if (isPresetType(value)) {
		return PRESET_TO_PARSED[value];
	}

	const match = value.match(CUSTOM_RRULE_PATTERN);
	if (match) {
		const interval = Number.parseInt(match[2], 10);
		if (interval >= 1) {
			return { freq: match[1] as RecurrenceFreq, interval };
		}
	}

	return null;
}

export function formatRecurrenceLabel(value: string): string {
	if (isPresetType(value)) {
		return RECURRENCE_TYPE_OPTIONS[value];
	}

	const parsed = parseRecurrenceType(value);
	if (!parsed) return value;

	const labels = FREQ_LABELS[parsed.freq];
	if (parsed.interval === 1) {
		return `Every ${labels.singular}`;
	}
	return `Every ${parsed.interval} ${labels.plural}`;
}

export function isWeekdaySupported(value: string): boolean {
	return (WEEKDAY_SUPPORTED_TYPES as readonly string[]).includes(value);
}

/**
 * Constructs a custom interval DSL string from a frequency and interval.
 * Clamps interval to a minimum of 1.
 */
export function buildCustomIntervalDSL(freq: string, interval: number): string {
	return `${freq};INTERVAL=${Math.max(1, interval)}`;
}

export function parseRRuleFromFrontmatter(
	frontmatter: Frontmatter,
	settings: SingleCalendarConfig
): RRuleFrontmatter | null {
	const { rruleProp, rruleSpecProp, rruleUntilProp, dateProp, startProp, endProp, allDayProp } = settings;

	const candidateData = {
		type: frontmatter[rruleProp],
		weekdays: frontmatter[rruleSpecProp],
		until: frontmatter[rruleUntilProp],
		date: frontmatter[dateProp],
		startTime: frontmatter[startProp],
		endTime: frontmatter[endProp],
		allDay: frontmatter[allDayProp],
	};
	const result = RRuleFrontmatterSchema.safeParse(candidateData);
	return result.success ? result.data : null;
}

/**
 * Calculates the target number of physical instances to maintain for a recurring event.
 * For weekly-based events (weekly, bi-weekly, custom weekly), multiplies intervals by the number of weekdays.
 */
export function calculateTargetInstanceCount(
	rrules: RRuleFrontmatter,
	futureInstancesCountOverride: unknown,
	defaultFutureInstancesCount: number
): number {
	const intervals = parsePositiveInt(futureInstancesCountOverride, defaultFutureInstancesCount);

	const { type, weekdays } = rrules;

	if (isWeekdaySupported(type)) {
		return (weekdays?.length || 1) * intervals;
	}
	return intervals;
}

/**
 * Extracts the appropriate start DateTime from RRule frontmatter.
 * Returns the date for all-day events, or startTime for timed events.
 */
export function getStartDateTime(rrules: RRuleFrontmatter): DateTime {
	return rrules.allDay ? rrules.date! : rrules.startTime!;
}

export function isOccurrenceWithinUntil(instanceDate: DateTime, until?: DateTime): boolean {
	return !until || instanceDate.startOf("day") <= until.startOf("day");
}

/**
 * Finds the first valid occurrence date for a recurring event.
 * For weekly/bi-weekly events with weekday rules, the start date might not match
 * the weekday rule, so we iterate to find the first valid occurrence.
 * For other recurrence types, the start date IS the first occurrence.
 */
export function findFirstValidStartDate(rrules: RRuleFrontmatter): DateTime {
	const startDateTime = getStartDateTime(rrules);

	// For weekly-based types, the start date might not match the weekday rule.
	// We must find the first date that IS a valid weekday on or after the start time.
	if (isWeekdaySupported(rrules.type) && rrules.weekdays?.length) {
		// Use the iterator to find the true first occurrence.
		const iterator = iterateOccurrencesInRange(
			startDateTime,
			rrules,
			startDateTime, // Start searching from the start time
			startDateTime.plus({ years: 1 }) // Search a year ahead
		);
		const result = iterator.next();
		// If the iterator finds a value, that's our true start. Otherwise, fall back to the original start time.
		if (!result.done) {
			return result.value;
		}
	}

	// For all other types (daily, monthly, etc.), the start time IS the first occurrence.
	return startDateTime;
}
