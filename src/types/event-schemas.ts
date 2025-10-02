import type { DateTime } from "luxon";
import { z } from "zod";
import { isAllDayEvent } from "../utils/calendar";
import type { ISO, SingleCalendarConfig } from "./index";
import {
	optionalDateTimeTransform,
	requiredDateTimeTransform,
	requiredDateTransform,
	timezoneSchema,
} from "./validation-schemas";

const titleTransform = z
	.unknown()
	.transform((value) => {
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
		return undefined;
	})
	.pipe(z.string().optional());

const BaseEventFrontmatterSchema = z.object({
	title: titleTransform,
	timezone: timezoneSchema,
});

// Schema for TIMED events (has startTime, optional endTime, allDay = false)
export const TimedEventFrontmatterSchema = BaseEventFrontmatterSchema.extend({
	startTime: requiredDateTimeTransform,
	endTime: optionalDateTimeTransform,
	allDay: z.literal(false).optional().nullable(),
}).strict();

// Schema for ALL-DAY events (has date, allDay = true, no startTime/endTime)
export const AllDayEventFrontmatterSchema = BaseEventFrontmatterSchema.extend({
	date: requiredDateTransform,
	allDay: z.literal(true),
}).strict();

// Union of both event types
export const EventFrontmatterSchema = z.discriminatedUnion("allDay", [
	TimedEventFrontmatterSchema,
	AllDayEventFrontmatterSchema,
]);

export type ParsedEventFrontmatter = z.infer<typeof EventFrontmatterSchema>;
export type TimedEventFrontmatter = z.infer<typeof TimedEventFrontmatterSchema>;
export type AllDayEventFrontmatter = z.infer<typeof AllDayEventFrontmatterSchema>;

export function parseEventFrontmatter(
	frontmatter: Record<string, unknown>,
	settings: SingleCalendarConfig
): ParsedEventFrontmatter | null {
	const { startProp, endProp, dateProp, allDayProp, titleProp, timezoneProp } = settings;

	if (isAllDayEvent(frontmatter[allDayProp])) {
		// ALL-DAY EVENT: Only use dateProp, ignore startProp/endProp
		const candidateData = {
			date: frontmatter[dateProp],
			allDay: true as const,
			title: titleProp ? frontmatter[titleProp] : undefined,
			timezone: timezoneProp ? frontmatter[timezoneProp] : undefined,
		};

		const result = AllDayEventFrontmatterSchema.safeParse(candidateData);
		return result.success ? result.data : null;
	}

	// TIMED EVENT: Use startProp and endProp, ignore dateProp
	const candidateData = {
		startTime: frontmatter[startProp],
		endTime: frontmatter[endProp],
		allDay: false as const,
		title: titleProp ? frontmatter[titleProp] : undefined,
		timezone: timezoneProp ? frontmatter[timezoneProp] : undefined,
	};

	const result = TimedEventFrontmatterSchema.safeParse(candidateData);
	return result.success ? result.data : null;
}

export function convertToISO(parsedDateTime: DateTime, timezone: string): ISO {
	const dateTimeInTimezone = timezone !== "system" ? parsedDateTime.setZone(timezone) : parsedDateTime;
	return dateTimeInTimezone.toUTC().toISO({ suppressMilliseconds: true }) || "";
}
