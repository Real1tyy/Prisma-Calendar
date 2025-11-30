import { getFilenameFromPath, parseFrontmatterValue } from "@real1ty-obsidian-plugins/utils";
import ICAL from "ical.js";
import { DateTime } from "luxon";
import { parseIntoList } from "./list-utils";

export interface ImportedEvent {
	title: string;
	description?: string;
	start: Date;
	end?: Date;
	allDay: boolean;
	categories?: string[];
	reminderMinutes?: number;
	/** Frontmatter properties parsed from X-PRISMA-FM-* ICS properties */
	frontmatter?: Record<string, unknown>;
	/** Original file path from X-PRISMA-FILE if present */
	originalFilePath?: string;
	/** Event UID from ICS - used for duplicate detection */
	uid: string;
}

export interface ICSImportResult {
	success: boolean;
	events: ImportedEvent[];
	error?: Error;
}

function icalTimeToDate(icalTime: ICAL.Time): Date {
	return icalTime.toJSDate();
}

function isAllDayEvent(dtstart: ICAL.Time): boolean {
	return dtstart.isDate;
}

function parseVAlarmTrigger(vevent: ICAL.Component): number | undefined {
	const valarm = vevent.getFirstSubcomponent("valarm");
	if (!valarm) return undefined;

	const trigger = valarm.getFirstPropertyValue("trigger");
	if (!trigger) return undefined;

	if (trigger instanceof ICAL.Duration) {
		const totalSeconds = trigger.toSeconds();
		const minutes = Math.abs(Math.round(totalSeconds / 60));
		return minutes > 0 ? minutes : undefined;
	}

	if (typeof trigger === "string") {
		const match = trigger.match(/^-?P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
		if (match) {
			const days = Number.parseInt(match[1] || "0", 10);
			const hours = Number.parseInt(match[2] || "0", 10);
			const mins = Number.parseInt(match[3] || "0", 10);
			const totalMinutes = days * 24 * 60 + hours * 60 + mins;
			return totalMinutes > 0 ? totalMinutes : undefined;
		}
	}

	return undefined;
}

function extractOriginalKey(param: unknown, fallback: string): string {
	if (typeof param === "string") return param;
	if (Array.isArray(param) && param.length > 0 && typeof param[0] === "string") return param[0];
	return fallback;
}

function parsePrismaFrontmatter(vevent: ICAL.Component): Record<string, unknown> | undefined {
	const frontmatter: Record<string, unknown> = {};

	// Get all properties from the VEVENT
	const properties = vevent.getAllProperties();

	for (const prop of properties) {
		const propName = prop.name.toLowerCase();

		// Only process X-PRISMA-FM-* properties
		if (!propName.startsWith("x-prisma-fm-")) continue;

		// Get the original property name from the ORIGINAL parameter, or reconstruct from sanitized name
		const originalParam: unknown = prop.getParameter("original");
		const originalKey = extractOriginalKey(originalParam, propName.replace("x-prisma-fm-", ""));
		const value = prop.getFirstValue();

		if (value === undefined || value === null) continue;

		frontmatter[originalKey] = parseFrontmatterValue(String(value));
	}

	return Object.keys(frontmatter).length > 0 ? frontmatter : undefined;
}

function getPrismaProperty(vevent: ICAL.Component, propName: string): string | undefined {
	const value = vevent.getFirstPropertyValue(propName);
	return value ? String(value) : undefined;
}

export function parseICSContent(icsContent: string): ICSImportResult {
	try {
		const jcalData = ICAL.parse(icsContent) as string | unknown[];
		const vcalendar = new ICAL.Component(jcalData);
		const vevents = vcalendar.getAllSubcomponents("vevent");

		if (vevents.length === 0) {
			return {
				success: false,
				events: [],
				error: new Error("No events found in ICS file"),
			};
		}

		const events: ImportedEvent[] = [];

		for (const vevent of vevents) {
			const event = new ICAL.Event(vevent);

			const dtstart = vevent.getFirstPropertyValue("dtstart") as ICAL.Time | null;
			if (!dtstart) continue;

			const dtend = vevent.getFirstPropertyValue("dtend") as ICAL.Time | null;
			const allDay = isAllDayEvent(dtstart);

			const categoriesProp = vevent.getFirstPropertyValue("categories");
			const categories = parseIntoList(categoriesProp);
			const parsedCategories = categories.length > 0 ? categories : undefined;

			const reminderMinutes = parseVAlarmTrigger(vevent);
			const frontmatter = parsePrismaFrontmatter(vevent);
			const originalFilePath = getPrismaProperty(vevent, "x-prisma-file");
			const uid = event.uid;

			events.push({
				title: event.summary || "Untitled Event",
				description: event.description || undefined,
				start: icalTimeToDate(dtstart),
				end: dtend ? icalTimeToDate(dtend) : undefined,
				allDay,
				categories: parsedCategories,
				reminderMinutes,
				frontmatter,
				originalFilePath,
				uid,
			});
		}

		return {
			success: true,
			events,
		};
	} catch (error) {
		return {
			success: false,
			events: [],
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

export interface ImportFrontmatterSettings {
	startProp: string;
	endProp: string;
	dateProp: string;
	allDayProp: string;
	titleProp?: string;
	minutesBeforeProp: string;
	daysBeforeProp: string;
	categoryProp: string;
}

export function extractBasenameFromOriginalPath(originalPath: string | undefined): string | null {
	if (!originalPath) return null;
	return getFilenameFromPath(originalPath).replace(/\.md$/, "");
}

/**
 * Converts a UTC Date to an ISO string, interpreting it in the specified timezone
 * but outputting as UTC (Z suffix). This normalizes the local time to UTC representation.
 *
 * Example: 13:00 UTC with timezone "Europe/Berlin" (UTC+1)
 * → Local time is 14:00 in Berlin
 * → Output: "2025-01-15T14:00:00.000Z" (local time stored as UTC)
 */
function dateToTimezoneISO(date: Date, timezone: string): string {
	const dt = DateTime.fromJSDate(date, { zone: "utc" }).setZone(timezone);
	// Take the local time components and format as UTC (Z)
	return `${dt.toFormat("yyyy-MM-dd")}T${dt.toFormat("HH:mm:ss")}.000Z`;
}

/**
 * Converts a UTC Date to a date string (YYYY-MM-DD) in the specified timezone.
 * Important for all-day events to ensure the correct calendar date.
 */
function dateToTimezoneDate(date: Date, timezone: string): string {
	const dt = DateTime.fromJSDate(date, { zone: "utc" }).setZone(timezone);
	return dt.toISODate() || date.toISOString().split("T")[0];
}

export function buildFrontmatterFromImportedEvent(
	event: ImportedEvent,
	settings: ImportFrontmatterSettings,
	timezone: string = "UTC"
): Record<string, unknown> {
	const fm: Record<string, unknown> = { ...event.frontmatter };

	if (settings.titleProp) {
		fm[settings.titleProp] = event.title;
	}

	if (event.allDay) {
		fm[settings.allDayProp] = true;
		fm[settings.dateProp] = dateToTimezoneDate(event.start, timezone);
		delete fm[settings.startProp];
		delete fm[settings.endProp];

		if (event.reminderMinutes !== undefined) {
			const days = Math.round(event.reminderMinutes / (24 * 60));
			if (days > 0) {
				fm[settings.daysBeforeProp] = days;
			}
		}
	} else {
		fm[settings.startProp] = dateToTimezoneISO(event.start, timezone);
		if (event.end) {
			fm[settings.endProp] = dateToTimezoneISO(event.end, timezone);
		}
		delete fm[settings.dateProp];
		delete fm[settings.allDayProp];

		if (event.reminderMinutes !== undefined) {
			fm[settings.minutesBeforeProp] = event.reminderMinutes;
		}
	}

	if (event.categories && event.categories.length > 0) {
		fm[settings.categoryProp] = event.categories;
	}

	return fm;
}
