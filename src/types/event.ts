import type { DateTime } from "luxon";
import { z } from "zod";
import { isAllDayEvent } from "../utils/calendar-events";
import {
	optionalDateTimeTransform,
	optionalListTransform,
	optionalNumber,
	optionalPositiveNumber,
	optionalTrimmedString,
	requiredDateTimeTransform,
	requiredDateTransform,
	strictBooleanTransform,
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

type CalendarEventFrontmatter = z.infer<typeof EventFrontmatterSchema>;

// --- Event Metadata Schema ---
// Structured fields extracted from frontmatter via settings-based property names.
// Parsed through Zod at the boundary so consumers get clean, validated data.

const EventMetadataSchema = z.object({
	skip: strictBooleanTransform,
	location: optionalTrimmedString,
	participants: optionalListTransform,
	categories: optionalListTransform,
	breakMinutes: optionalPositiveNumber,
	icon: optionalTrimmedString,
	status: optionalTrimmedString,
	minutesBefore: optionalNumber,
	daysBefore: optionalNumber,
	alreadyNotified: strictBooleanTransform,
	rruleType: optionalTrimmedString,
	rruleSpec: optionalTrimmedString,
	rruleId: optionalTrimmedString,
	instanceDate: optionalTrimmedString,
	source: optionalTrimmedString,
	ignoreRecurring: strictBooleanTransform,
	futureInstancesCount: optionalPositiveNumber,
	generatePastEvents: strictBooleanTransform,
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
		ignoreRecurring: frontmatter[settings.ignoreRecurringProp],
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

export function convertToISO(parsedDateTime: DateTime): ISO {
	return parsedDateTime.toUTC().toISO({ suppressMilliseconds: true }) || "";
}
