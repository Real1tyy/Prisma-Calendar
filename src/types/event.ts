import type { DateTime } from "luxon";
import { z } from "zod";
import { isAllDayEvent } from "../utils/calendar-events";
import {
	optionalDateTimeTransform,
	requiredDateTimeTransform,
	requiredDateTransform,
	titleTransform,
} from "../utils/validation";
import type { Frontmatter, ISO, SingleCalendarConfig } from "./index";

const BaseEventFrontmatterSchema = z.object({
	title: titleTransform,
});

// Schema for TIMED events (has startTime, optional endTime, allDay = false)
const TimedEventFrontmatterSchema = BaseEventFrontmatterSchema.extend({
	startTime: requiredDateTimeTransform,
	endTime: optionalDateTimeTransform,
	allDay: z.literal(false).optional().nullable(),
}).strict();

// Schema for ALL-DAY events (has date, allDay = true, no startTime/endTime)
const AllDayEventFrontmatterSchema = BaseEventFrontmatterSchema.extend({
	date: requiredDateTransform,
	allDay: z.literal(true),
}).strict();

// Union of both event types
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const EventFrontmatterSchema = z.discriminatedUnion("allDay", [
	TimedEventFrontmatterSchema,
	AllDayEventFrontmatterSchema,
]);

type ParsedEventFrontmatter = z.infer<typeof EventFrontmatterSchema>;

export function parseEventFrontmatter(
	frontmatter: Frontmatter,
	settings: SingleCalendarConfig
): ParsedEventFrontmatter | null {
	const { startProp, endProp, dateProp, allDayProp, titleProp } = settings;

	if (isAllDayEvent(frontmatter[allDayProp])) {
		// ALL-DAY EVENT: Only use dateProp, ignore startProp/endProp
		const candidateData = {
			date: frontmatter[dateProp],
			allDay: true as const,
			title: titleProp ? frontmatter[titleProp] : undefined,
		};

		const result = AllDayEventFrontmatterSchema.safeParse(candidateData);
		return result.success ? result.data : null;
	}

	const candidateData = {
		startTime: frontmatter[startProp],
		endTime: frontmatter[endProp],
		allDay: false as const,
		title: titleProp ? frontmatter[titleProp] : undefined,
	};

	const result = TimedEventFrontmatterSchema.safeParse(candidateData);
	return result.success ? result.data : null;
}

export function convertToISO(parsedDateTime: DateTime): ISO {
	return parsedDateTime.toUTC().toISO({ suppressMilliseconds: true }) || "";
}
