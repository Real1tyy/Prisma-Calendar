import { z } from "zod";

import { isAllDayEvent } from "../utils/event-frontmatter";
import {
	optionalDateTimeTransform,
	optionalListTransform,
	optionalNumber,
	optionalPositiveNumber,
	optionalTrimmedString,
	requiredDateTimeTransform,
	requiredDateTransform,
	strictBooleanOptional,
	titleTransform,
} from "../utils/validation";
import type { Frontmatter, SingleCalendarConfig } from "./index";

export { stripZ, toInternalISO } from "../utils/iso";

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

type CalendarEventFrontmatter = z.infer<typeof EventFrontmatterSchema>;

// --- Event Metadata Schema ---
// Structured fields extracted from frontmatter via settings-based property names.
// Parsed through Zod at the boundary so consumers get clean, validated data.

export const EventMetadataSchema = z.object({
	skip: strictBooleanOptional.optional().describe("Hide event from calendar"),
	location: optionalTrimmedString.describe("Event location"),
	participants: optionalListTransform.describe("Comma-separated list of participants"),
	categories: optionalListTransform.describe("Event categories"),
	breakMinutes: optionalPositiveNumber.describe("Time to subtract from duration in statistics"),
	icon: optionalTrimmedString.describe("Event icon (emoji or text)"),
	status: optionalTrimmedString.describe("Event status"),
	minutesBefore: optionalNumber.describe("Notify minutes before"),
	daysBefore: optionalNumber.describe("Notify days before"),
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
});

export type EventMetadata = z.infer<typeof EventMetadataSchema>;

export function parseEventMetadata(frontmatter: Frontmatter, settings: SingleCalendarConfig): EventMetadata {
	const candidate = {
		skip: frontmatter[settings.skipProp],
		location: frontmatter[settings.locationProp],
		participants: frontmatter[settings.participantsProp],
		categories: frontmatter[settings.categoryProp],
		breakMinutes: frontmatter[settings.breakProp],
		icon: frontmatter[settings.iconProp],
		status: frontmatter[settings.statusProperty],
		minutesBefore: frontmatter[settings.minutesBeforeProp],
		daysBefore: frontmatter[settings.daysBeforeProp],
		alreadyNotified: frontmatter[settings.alreadyNotifiedProp],
		rruleType: frontmatter[settings.rruleProp],
		rruleSpec: frontmatter[settings.rruleSpecProp],
		rruleId: frontmatter[settings.rruleIdProp],
		instanceDate: frontmatter[settings.instanceDateProp],
		source: frontmatter[settings.sourceProp],
		futureInstancesCount: frontmatter[settings.futureInstancesCountProp],
		generatePastEvents: frontmatter[settings.generatePastEventsProp],
		caldav: frontmatter[settings.caldavProp],
		icsSubscription: frontmatter[settings.icsSubscriptionProp],
	};
	// All fields have transforms with fallbacks — parse() never throws
	return EventMetadataSchema.parse(candidate);
}

export function parseEventFrontmatter(
	frontmatter: Frontmatter,
	settings: SingleCalendarConfig
): { datetime: CalendarEventFrontmatter; metadata: EventMetadata } | null {
	const { startProp, endProp, dateProp, allDayProp, titleProp } = settings;
	const metadata = parseEventMetadata(frontmatter, settings);

	if (isAllDayEvent(frontmatter[allDayProp])) {
		// ALL-DAY EVENT: Only use dateProp, ignore startProp/endProp
		const candidateData = {
			date: frontmatter[dateProp],
			allDay: true as const,
			title: titleProp ? frontmatter[titleProp] : undefined,
		};

		const result = AllDayEventFrontmatterSchema.safeParse(candidateData);
		return result.success ? { datetime: result.data, metadata } : null;
	}

	const candidateData = {
		startTime: frontmatter[startProp],
		endTime: frontmatter[endProp],
		allDay: false as const,
		title: titleProp ? frontmatter[titleProp] : undefined,
	};

	const result = TimedEventFrontmatterSchema.safeParse(candidateData);
	return result.success ? { datetime: result.data, metadata } : null;
}
