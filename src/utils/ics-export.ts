import { serializeFrontmatterValue } from "@real1ty-obsidian-plugins/utils";
import ICAL from "ical.js";
import type { ParsedEvent } from "../core/parser";
import { extractZettelId, removeZettelId } from "./calendar-events";
import { parseIntoList } from "./list-utils";

export interface NotificationSettings {
	minutesBeforeProp?: string;
	defaultMinutesBefore?: number;
	daysBeforeProp?: string;
	defaultDaysBefore?: number;
}

export interface ICSExportOptions {
	calendarName: string;
	vaultName: string;
	timezone: string;
	noteContents: Map<string, string>;
	categoryProp: string;
	notifications: NotificationSettings;
	/** Property names that are already exported via standard ICS fields and should be excluded from X-PRISMA-FM-* */
	excludeProps: {
		startProp: string;
		endProp: string;
		dateProp: string;
		allDayProp: string;
		titleProp?: string;
	};
}

export interface ICSExportResult {
	success: boolean;
	content?: string;
	error?: Error;
}

function zettelIdToICALTime(zettelId: string | null): ICAL.Time {
	if (!zettelId || zettelId.length !== 14) {
		return ICAL.Time.now();
	}

	const year = Number.parseInt(zettelId.slice(0, 4), 10);
	const month = Number.parseInt(zettelId.slice(4, 6), 10);
	const day = Number.parseInt(zettelId.slice(6, 8), 10);
	const hour = Number.parseInt(zettelId.slice(8, 10), 10);
	const minute = Number.parseInt(zettelId.slice(10, 12), 10);
	const second = Number.parseInt(zettelId.slice(12, 14), 10);

	if ([year, month, day, hour, minute, second].some(Number.isNaN)) {
		return ICAL.Time.now();
	}

	return new ICAL.Time({ year, month, day, hour, minute, second, isDate: false }, ICAL.Timezone.utcTimezone);
}

function dateToICALTime(date: Date, allDay: boolean, timezone?: ICAL.Timezone): ICAL.Time {
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

	const time = ICAL.Time.fromJSDate(date, true);
	if (timezone && timezone !== ICAL.Timezone.utcTimezone) {
		time.zone = timezone;
	}
	return time;
}

function generateObsidianURI(vaultName: string, filePath: string): string {
	const encodedVault = encodeURIComponent(vaultName);
	const encodedFile = encodeURIComponent(filePath.replace(/\.md$/, ""));
	return `obsidian://open?vault=${encodedVault}&file=${encodedFile}`;
}

function createVAlarm(triggerMinutes: number): ICAL.Component {
	const valarm = new ICAL.Component("valarm");
	valarm.addPropertyWithValue("action", "DISPLAY");
	valarm.addPropertyWithValue("description", "Reminder");

	const roundedMinutes = Math.round(triggerMinutes);
	const duration = new ICAL.Duration({ minutes: -roundedMinutes });
	valarm.addPropertyWithValue("trigger", duration);

	return valarm;
}

function getNotificationMinutes(event: ParsedEvent, notifications?: NotificationSettings): number | null {
	if (!notifications) return null;

	if (event.allDay) {
		if (notifications.daysBeforeProp) {
			const daysBeforeValue = event.meta?.[notifications.daysBeforeProp];
			if (daysBeforeValue !== undefined && daysBeforeValue !== null) {
				const days = Number(daysBeforeValue);
				if (!Number.isNaN(days) && days >= 0) {
					return Math.round(days * 24 * 60);
				}
			}
		}
		if (notifications.defaultDaysBefore !== undefined) {
			return Math.round(notifications.defaultDaysBefore * 24 * 60);
		}
	} else {
		if (notifications.minutesBeforeProp) {
			const minutesBeforeValue = event.meta?.[notifications.minutesBeforeProp];
			if (minutesBeforeValue !== undefined && minutesBeforeValue !== null) {
				const minutes = Number(minutesBeforeValue);
				if (!Number.isNaN(minutes) && minutes >= 0) {
					return Math.round(minutes);
				}
			}
		}
		if (notifications.defaultMinutesBefore !== undefined) {
			return Math.round(notifications.defaultMinutesBefore);
		}
	}

	return null;
}

function parsedEventToVEvent(event: ParsedEvent, options: ICSExportOptions, timezone?: ICAL.Timezone): ICAL.Component {
	const vevent = new ICAL.Component("vevent");

	const zettelId = extractZettelId(event.ref.filePath);
	const createdTime = zettelIdToICALTime(zettelId);
	const strippedTitle = removeZettelId(event.title);

	vevent.addPropertyWithValue("uid", event.id);
	vevent.addPropertyWithValue("dtstamp", createdTime);
	vevent.addPropertyWithValue("created", createdTime);
	vevent.addPropertyWithValue("last-modified", createdTime);
	vevent.addPropertyWithValue("summary", strippedTitle);

	const startDate = new Date(event.start);
	const dtstart = dateToICALTime(startDate, event.allDay, timezone);
	vevent.addPropertyWithValue("dtstart", dtstart);

	if (event.end) {
		const endDate = new Date(event.end);
		const dtend = dateToICALTime(endDate, event.allDay, timezone);
		vevent.addPropertyWithValue("dtend", dtend);
	}

	const noteContent = options.noteContents.get(event.ref.filePath);
	if (noteContent) {
		vevent.addPropertyWithValue("description", noteContent);
	}

	const categories = parseIntoList(event.meta?.[options.categoryProp]);
	if (categories.length > 0) {
		vevent.addPropertyWithValue("categories", categories.join(","));
	}

	const notificationMinutes = getNotificationMinutes(event, options.notifications);
	if (notificationMinutes !== null) {
		const valarm = createVAlarm(notificationMinutes);
		vevent.addSubcomponent(valarm);
	}

	vevent.addPropertyWithValue("url", generateObsidianURI(options.vaultName, event.ref.filePath));
	vevent.addPropertyWithValue("x-prisma-file", event.ref.filePath);
	vevent.addPropertyWithValue("x-prisma-vault", options.vaultName);

	// Export additional frontmatter as X-PRISMA-FM-* properties for round-trip preservation
	// Excludes: standard ICS fields, empty arrays, and internal parser metadata
	if (event.meta) {
		const excludedProps = new Set<string>([
			// Standard ICS field properties
			options.excludeProps.startProp,
			options.excludeProps.endProp,
			options.excludeProps.dateProp,
			options.excludeProps.allDayProp,
			options.categoryProp,
			// Internal parser metadata (added by parser.ts, not user frontmatter)
			"folder",
			"isAllDay",
			"originalStart",
			"originalEnd",
			"originalDate",
		]);

		if (options.excludeProps.titleProp) excludedProps.add(options.excludeProps.titleProp);
		if (options.notifications.minutesBeforeProp) excludedProps.add(options.notifications.minutesBeforeProp);
		if (options.notifications.daysBeforeProp) excludedProps.add(options.notifications.daysBeforeProp);

		for (const [key, value] of Object.entries(event.meta)) {
			if (value === undefined || value === null) continue;
			if (excludedProps.has(key)) continue;
			if (Array.isArray(value) && value.length === 0) continue;

			const sanitizedKey = key.toLowerCase().replace(/[^a-z0-9-]/g, "-");
			const propName = `x-prisma-fm-${sanitizedKey}`;
			const serialized = serializeFrontmatterValue(value);

			const prop = new ICAL.Property(propName);
			prop.setParameter("original", key);
			prop.setValue(serialized);
			vevent.addProperty(prop);
		}
	}

	return vevent;
}

export function createICSFromEvents(events: ParsedEvent[], options: ICSExportOptions): ICSExportResult {
	if (events.length === 0) {
		return {
			success: false,
			error: new Error("No events to export"),
		};
	}

	try {
		const vcalendar = new ICAL.Component("vcalendar");
		vcalendar.addPropertyWithValue("version", "2.0");
		vcalendar.addPropertyWithValue("prodid", `-//${options.calendarName}//Prisma Calendar//EN`);
		vcalendar.addPropertyWithValue("calscale", "GREGORIAN");
		vcalendar.addPropertyWithValue("method", "PUBLISH");
		vcalendar.addPropertyWithValue("x-wr-calname", options.calendarName);

		let timezone: ICAL.Timezone | undefined;
		if (options.timezone && options.timezone !== "UTC") {
			vcalendar.addPropertyWithValue("x-wr-timezone", options.timezone);
			timezone = new ICAL.Timezone({ tzid: options.timezone });
		}

		for (const event of events) {
			const vevent = parsedEventToVEvent(event, options, timezone);
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

export interface TimezoneInfo {
	id: string;
	label: string;
}

export const COMMON_TIMEZONES: TimezoneInfo[] = [
	{ id: "UTC", label: "UTC" },
	{ id: "Europe/London", label: "Europe/London (UTC)" },
	{ id: "Europe/Paris", label: "Europe/Paris (UTC+1)" },
	{ id: "Europe/Berlin", label: "Europe/Berlin (UTC+1)" },
	{ id: "Europe/Prague", label: "Europe/Prague (UTC+1)" },
	{ id: "Europe/Moscow", label: "Europe/Moscow (UTC+3)" },
	{ id: "America/New_York", label: "America/New_York (UTC-5)" },
	{ id: "America/Chicago", label: "America/Chicago (UTC-6)" },
	{ id: "America/Denver", label: "America/Denver (UTC-7)" },
	{ id: "America/Los_Angeles", label: "America/Los_Angeles (UTC-8)" },
	{ id: "America/Sao_Paulo", label: "America/São Paulo (UTC-3)" },
	{ id: "Asia/Tokyo", label: "Asia/Tokyo (UTC+9)" },
	{ id: "Asia/Shanghai", label: "Asia/Shanghai (UTC+8)" },
	{ id: "Asia/Singapore", label: "Asia/Singapore (UTC+8)" },
	{ id: "Asia/Dubai", label: "Asia/Dubai (UTC+4)" },
	{ id: "Asia/Kolkata", label: "Asia/Kolkata (UTC+5:30)" },
	{ id: "Australia/Sydney", label: "Australia/Sydney (UTC+10)" },
	{ id: "Pacific/Auckland", label: "Pacific/Auckland (UTC+12)" },
];

export type CommonTimezone = string;
