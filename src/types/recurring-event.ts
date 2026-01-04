import { capitalize } from "@real1ty-obsidian-plugins/utils";
import { z } from "zod";
import type { Weekday } from "../utils/date-recurrence";
import { WEEKDAY_TO_NUMBER } from "../utils/date-recurrence";
import { booleanTransform, optionalDateTransform, optionalTimeTransform } from "../utils/validation";
import type { Frontmatter } from "./index";
import type { SingleCalendarConfig } from "./settings";

export const RECURRENCE_TYPE_OPTIONS = {
	daily: "Daily",
	weekly: "Weekly",
	"bi-weekly": "Bi-weekly (every 2 weeks)",
	monthly: "Monthly",
	"bi-monthly": "Bi-monthly (every 2 months)",
	quarterly: "Quarterly (every 3 months)",
	"semi-annual": "Semi-annual (every 6 months)",
	yearly: "Yearly",
} as const;

export type RecurrenceType = keyof typeof RECURRENCE_TYPE_OPTIONS;

export const WEEKDAY_SUPPORTED_TYPES = ["weekly", "bi-weekly"] as const;

export const WEEKDAY_OPTIONS = Object.keys(WEEKDAY_TO_NUMBER).reduce(
	(acc, weekday) => {
		acc[weekday as keyof typeof WEEKDAY_TO_NUMBER] = capitalize(weekday);
		return acc;
	},
	{} as Record<keyof typeof WEEKDAY_TO_NUMBER, string>
);

const RecurrenceTypeSchema = z.enum(Object.keys(RECURRENCE_TYPE_OPTIONS) as [RecurrenceType, ...RecurrenceType[]]);

const WeekdaySchema = z.enum(Object.keys(WEEKDAY_TO_NUMBER) as [Weekday, ...Weekday[]]);

const weekdaysTransform = z
	.union([z.string(), z.null()])
	.transform((value) => {
		if (value === null) return [];
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
	content?: string;
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
