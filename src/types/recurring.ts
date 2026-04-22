import { booleanTransform, capitalize, optionalDateTransform, optionalTimeTransform } from "@real1ty-obsidian-plugins";
import type { DateTime } from "luxon";
import { z } from "zod";

import type { CalendarEvent } from "./calendar";
import type { EventMetadata } from "./event-metadata";
import type { Frontmatter } from "./index";

// ─── Weekday ─────────────────────────────────────────────────────────

export type Weekday = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

export const WEEKDAY_TO_NUMBER: Record<Weekday, number> = {
	sunday: 0,
	monday: 1,
	tuesday: 2,
	wednesday: 3,
	thursday: 4,
	friday: 5,
	saturday: 6,
};

export const WEEKDAY_OPTIONS = Object.keys(WEEKDAY_TO_NUMBER).reduce(
	(acc, weekday) => {
		acc[weekday as keyof typeof WEEKDAY_TO_NUMBER] = capitalize(weekday);
		return acc;
	},
	{} as Record<keyof typeof WEEKDAY_TO_NUMBER, string>
);

// ─── Recurrence Presets ──────────────────────────────────────────────

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

// ─── Custom Recurrence DSL ───────────────────────────────────────────

export type RecurrenceFreq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface ParsedRecurrence {
	freq: RecurrenceFreq;
	interval: number;
}

export const CUSTOM_RRULE_PATTERN = /^(DAILY|WEEKLY|MONTHLY|YEARLY);INTERVAL=(\d+)$/;

// ─── RRule Frontmatter Schema ────────────────────────────────────────

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

function isValidRecurrenceTypeString(value: string): boolean {
	if (value in RECURRENCE_TYPE_OPTIONS) return true;
	const match = value.match(CUSTOM_RRULE_PATTERN);
	if (!match) return false;
	const interval = Number.parseInt(match[2], 10);
	return interval >= 1;
}

const RecurrenceTypeSchema = z.string().refine(isValidRecurrenceTypeString, {
	message: "Must be a valid recurrence preset or custom interval (e.g. DAILY;INTERVAL=5)",
});

export const RRuleFrontmatterSchema = z
	.object({
		type: RecurrenceTypeSchema,
		weekdays: weekdaysTransform,
		until: optionalDateTransform,
		date: optionalDateTransform,
		startTime: optionalTimeTransform,
		endTime: optionalTimeTransform,
		allDay: booleanTransform,
	})
	.refine(
		(data) => {
			if (data.allDay) {
				return data.date !== undefined;
			}
			return data.startTime !== undefined && data.endTime !== undefined;
		},
		{
			message:
				"When allDay is true, date is required. When allDay is false or undefined, both startTime and endTime are required.",
		}
	);

export type RRuleFrontmatter = z.infer<typeof RRuleFrontmatterSchema>;

// ─── Recurring Event Domain ──────────────────────────────────────────

export interface NodeRecurringEvent {
	sourceFilePath: string;
	title: string;
	rRuleId: string;
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
