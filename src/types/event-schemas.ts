import type { DateTime } from "luxon";
import { z } from "zod";
import type { ISO, SingleCalendarConfig } from "./index";
import {
	booleanTransform,
	optionalDateTimeTransform,
	requiredDateTimeTransform,
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

export const EventFrontmatterSchema = z
	.object({
		startTime: requiredDateTimeTransform,
		endTime: optionalDateTimeTransform,
		allDay: booleanTransform,
		title: titleTransform,
		timezone: timezoneSchema,
	})
	.loose()
	.refine((data) => (data.allDay ? data.endTime === undefined : true), {
		message:
			"When allDay is true, endTime must be undefined. All-day events should not have end times in frontmatter.",
	});

export type ParsedEventFrontmatter = z.infer<typeof EventFrontmatterSchema>;

export function parseEventFrontmatter(
	frontmatter: Record<string, unknown>,
	settings: SingleCalendarConfig
): ParsedEventFrontmatter | null {
	const { startProp, endProp, allDayProp, titleProp, timezoneProp } = settings;

	const candidateData = {
		startTime: frontmatter[startProp],
		endTime: frontmatter[endProp],
		allDay: frontmatter[allDayProp],
		title: titleProp ? frontmatter[titleProp] : undefined,
		timezone: timezoneProp ? frontmatter[timezoneProp] : undefined,
	};

	const result = EventFrontmatterSchema.safeParse(candidateData);
	return result.success ? result.data : null;
}

export function convertToISO(parsedDateTime: DateTime, timezone: string): ISO {
	const dateTimeInTimezone =
		timezone !== "system" ? parsedDateTime.setZone(timezone) : parsedDateTime;
	return dateTimeInTimezone.toUTC().toISO({ suppressMilliseconds: true }) || "";
}
