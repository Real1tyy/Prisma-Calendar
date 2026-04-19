import { capitalize } from "@real1ty-obsidian-plugins";
import { booleanTransform, optionalDateTransform, optionalTimeTransform } from "@real1ty-obsidian-plugins";
import type { DateTime } from "luxon";
import { z } from "zod";

import type { CalendarEvent } from "./calendar";
import type { EventMetadata } from "./event";
import type { Frontmatter } from "./index";
import type { SingleCalendarConfig } from "./settings";
import type { Weekday } from "./weekday";
import { WEEKDAY_TO_NUMBER } from "./weekday";

export const RECURRENCE_TYPE_OPTIONS = {
	daily: "Daily",
	"bi-daily": "Bi-daily (every 2 days)",
	weekdays: "Weekdays (Mon–Fri)",
	weekends: "Weekends (Sat–Sun)",
	weekly: "Weekly",
	"bi-weekly": "Bi-weekly (every 2 weeks)",
	monthly: "Monthly",
	"bi-monthly": "Bi-monthly (every 2 months)",
	quarterly: "Quarterly (every 3 months)",
	"semi-annual": "Semi-annual (every 6 months)",
	yearly: "Yearly",
} as const;

export type RecurrencePreset = keyof typeof RECURRENCE_TYPE_OPTIONS;

export type RecurrenceType = RecurrencePreset | string;

export const WEEKDAY_SUPPORTED_TYPES = ["weekly", "bi-weekly", "weekdays", "weekends"] as const;

export const WEEKDAY_PRESET_DAYS: Record<string, Weekday[]> = {
	weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
	weekends: ["saturday", "sunday"],
};

export const WEEKDAY_OPTIONS = Object.keys(WEEKDAY_TO_NUMBER).reduce(
	(acc, weekday) => {
		acc[weekday as keyof typeof WEEKDAY_TO_NUMBER] = capitalize(weekday);
		return acc;
	},
	{} as Record<keyof typeof WEEKDAY_TO_NUMBER, string>
);

// ─── Custom Recurrence DSL ───────────────────────────────────────

export type RecurrenceFreq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface ParsedRecurrence {
	freq: RecurrenceFreq;
	interval: number;
}

export const CUSTOM_RRULE_PATTERN = /^(DAILY|WEEKLY|MONTHLY|YEARLY);INTERVAL=(\d+)$/;

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

	const match = CUSTOM_RRULE_PATTERN.exec(value);
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

function isValidRecurrenceType(value: string): boolean {
	if (isPresetType(value)) return true;
	const match = CUSTOM_RRULE_PATTERN.exec(value);
	if (!match) return false;
	const interval = Number.parseInt(match[2], 10);
	return interval >= 1;
}

const RecurrenceTypeSchema = z.string().refine(isValidRecurrenceType, {
	message: "Must be a valid recurrence preset or custom interval (e.g. DAILY;INTERVAL=5)",
});

const WeekdaySchema = z.enum(Object.keys(WEEKDAY_TO_NUMBER) as [Weekday, ...Weekday[]]);

const weekdaysTransform = z
	.union([z.string(), z.null(), z.undefined()])
	.transform((value) => {
		if (value == null) return [];
		return value
			.split(",")
			.map((day) => day.trim().toLowerCase())
			.filter((day) => Object.keys(WEEKDAY_TO_NUMBER).includes(day));
	})
	.pipe(z.array(WeekdaySchema));

export const RRuleFrontmatterSchema = z
	.object({
		type: RecurrenceTypeSchema,
		weekdays: weekdaysTransform,
		date: optionalDateTransform,
		startTime: optionalTimeTransform,
		endTime: optionalTimeTransform,
		allDay: booleanTransform,
	})
	.refine(
		(data) => {
			if (data.allDay) {
				// All-day event: date must be defined
				return data.date !== undefined;
			}
			// Timed event (allDay is false or undefined): both startTime and endTime must be defined
			return data.startTime !== undefined && data.endTime !== undefined;
		},
		{
			message:
				"When allDay is true, date is required. When allDay is false or undefined, both startTime and endTime are required.",
		}
	);

export type RRuleFrontmatter = z.infer<typeof RRuleFrontmatterSchema>;

export interface NodeRecurringEvent {
	sourceFilePath: string;
	title: string;
	rRuleId: string; // unique ID for this recurring event
	rrules: RRuleFrontmatter;
	frontmatter: Frontmatter;
	metadata: EventMetadata;
	content?: string | undefined;
}

export interface RecurringEventInstance {
	event: CalendarEvent;
	instanceDate: DateTime;
}

export interface RecurringEventSeries {
	sourceTitle: string;
	sourceFilePath: string;
	instances: RecurringEventInstance[];
	rruleType?: string | undefined;
	rruleSpec?: string | undefined;
	sourceCategory?: string | undefined;
}

export function parseRRuleFromFrontmatter(
	frontmatter: Frontmatter,
	settings: SingleCalendarConfig
): RRuleFrontmatter | null {
	const { rruleProp, rruleSpecProp, dateProp, startProp, endProp, allDayProp } = settings;

	const candidateData = {
		type: frontmatter[rruleProp],
		weekdays: frontmatter[rruleSpecProp],
		date: frontmatter[dateProp],
		startTime: frontmatter[startProp],
		endTime: frontmatter[endProp],
		allDay: frontmatter[allDayProp],
	};
	const result = RRuleFrontmatterSchema.safeParse(candidateData);
	return result.success ? result.data : null;
}
