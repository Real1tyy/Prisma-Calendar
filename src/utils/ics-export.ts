import ICAL from "ical.js";
import { PLUGIN_ID } from "../constants";
import type { ParsedEvent } from "../core/parser";

function dateToICALTime(date: Date, allDay: boolean): ICAL.Time {
	if (allDay) {
		return new ICAL.Time(
			{
				year: date.getUTCFullYear(),
				month: date.getUTCMonth() + 1,
				day: date.getUTCDate(),
				isDate: true,
			},
			ICAL.Timezone.utcTimezone
		);
	}
	return ICAL.Time.fromJSDate(date, true);
}

function parsedEventToVEvent(event: ParsedEvent, noteContent?: string): ICAL.Component {
	const vevent = new ICAL.Component("vevent");

	vevent.addPropertyWithValue("uid", `${event.id}@${PLUGIN_ID}`);
	vevent.addPropertyWithValue("dtstamp", ICAL.Time.now());
	vevent.addPropertyWithValue("summary", event.title);

	const startDate = new Date(event.start);
	const dtstart = dateToICALTime(startDate, event.allDay);
	vevent.addPropertyWithValue("dtstart", dtstart);

	if (event.end) {
		const endDate = new Date(event.end);
		const dtend = dateToICALTime(endDate, event.allDay);
		vevent.addPropertyWithValue("dtend", dtend);
	}

	if (noteContent) {
		vevent.addPropertyWithValue("description", noteContent);
	}

	const categories = event.meta?.tags as string[] | undefined;
	if (categories && Array.isArray(categories) && categories.length > 0) {
		vevent.addPropertyWithValue("categories", categories.join(","));
	}

	vevent.addPropertyWithValue("x-prisma-file", event.ref.filePath);

	return vevent;
}

export interface ICSExportResult {
	success: boolean;
	content?: string;
	error?: Error;
}

export function createICSFromEvents(
	events: ParsedEvent[],
	calendarName: string,
	noteContents: Map<string, string>
): ICSExportResult {
	if (events.length === 0) {
		return {
			success: false,
			error: new Error("No events to export"),
		};
	}

	try {
		const vcalendar = new ICAL.Component("vcalendar");
		vcalendar.addPropertyWithValue("version", "2.0");
		vcalendar.addPropertyWithValue("prodid", `-//${calendarName}//Prisma Calendar//EN`);
		vcalendar.addPropertyWithValue("calscale", "GREGORIAN");
		vcalendar.addPropertyWithValue("method", "PUBLISH");

		for (const event of events) {
			const noteContent = noteContents.get(event.ref.filePath);
			const vevent = parsedEventToVEvent(event, noteContent);
			vcalendar.addSubcomponent(vevent);
		}

		return {
			success: true,
			content: vcalendar.toString(),
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

export function generateICSFilename(calendarName: string): string {
	const sanitizedName = calendarName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
	return `${sanitizedName}-export-${timestamp}.ics`;
}
