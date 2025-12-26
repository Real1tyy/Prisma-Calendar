import { getFilenameFromPath, parseFrontmatterValue, sanitizeForFilename } from "@real1ty-obsidian-plugins/utils";
import ICAL from "ical.js";
import { DateTime } from "luxon";
import type { App, TFile } from "obsidian";
import type { Frontmatter, SingleCalendarConfig } from "../../types";
import { extractZettelId, generateUniqueEventPath, removeZettelId, setEventBasics } from "../../utils/calendar-events";
import { parseIntoList } from "../../utils/list-utils";
import { ensureFolderExists } from "../../utils/obsidian";
import type { CalendarBundle } from "../calendar-bundle";

export interface ImportedEvent {
	title: string;
	description?: string;
	start: Date;
	end?: Date;
	allDay: boolean;
	categories?: string[];
	reminderMinutes?: number;
	/** Frontmatter properties parsed from X-PRISMA-FM-* ICS properties */
	frontmatter?: Frontmatter;
	/** Original file path from X-PRISMA-FILE if present */
	originalFilePath?: string;
	/** Event UID from ICS - used for duplicate detection */
	uid: string;
	/** Last modified timestamp (DTSTAMP or LAST-MODIFIED) in milliseconds */
	lastModified?: number;
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

function parsePrismaFrontmatter(vevent: ICAL.Component): Frontmatter | undefined {
	const frontmatter: Frontmatter = {};

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

			const allDay = isAllDayEvent(dtstart);

			// Calculate end time: prefer DTEND, fall back to DURATION
			let endDate: Date | undefined;
			const dtend = vevent.getFirstPropertyValue("dtend") as ICAL.Time | null;
			if (dtend) {
				endDate = icalTimeToDate(dtend);
			} else {
				const duration = vevent.getFirstPropertyValue("duration") as ICAL.Duration | null;
				if (duration) {
					const startDate = icalTimeToDate(dtstart);
					const durationSeconds = duration.toSeconds();
					endDate = new Date(startDate.getTime() + durationSeconds * 1000);
				}
			}

			const categoriesProp = vevent.getFirstPropertyValue("categories");
			const categories = parseIntoList(categoriesProp);
			const parsedCategories = categories.length > 0 ? categories : undefined;

			const reminderMinutes = parseVAlarmTrigger(vevent);
			const frontmatter = parsePrismaFrontmatter(vevent);
			const originalFilePath = getPrismaProperty(vevent, "x-prisma-file");
			const uid = event.uid;

			// Extract last modified timestamp (prefer LAST-MODIFIED, fall back to DTSTAMP)
			let lastModified: number | undefined;
			const lastModifiedTime = vevent.getFirstPropertyValue("last-modified") as ICAL.Time | null;
			if (lastModifiedTime) {
				lastModified = icalTimeToDate(lastModifiedTime).getTime();
			} else {
				const dtstamp = vevent.getFirstPropertyValue("dtstamp") as ICAL.Time | null;
				if (dtstamp) {
					lastModified = icalTimeToDate(dtstamp).getTime();
				}
			}

			events.push({
				title: event.summary || "Untitled Event",
				description: event.description || undefined,
				start: icalTimeToDate(dtstart),
				end: endDate,
				allDay,
				categories: parsedCategories,
				reminderMinutes,
				frontmatter,
				originalFilePath,
				uid,
				lastModified,
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

function extractBasenameFromOriginalPath(originalPath: string | undefined): string | null {
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
	settings: SingleCalendarConfig,
	timezone: string = "UTC"
): Frontmatter {
	const fm: Frontmatter = { ...event.frontmatter };

	const startISO = event.allDay
		? `${dateToTimezoneDate(event.start, timezone)}T00:00:00`
		: dateToTimezoneISO(event.start, timezone);
	const endISO = event.end ? dateToTimezoneISO(event.end, timezone) : undefined;

	setEventBasics(fm, settings, {
		title: event.title,
		start: startISO,
		end: endISO,
		allDay: event.allDay,
	});

	if (event.allDay) {
		if (event.reminderMinutes !== undefined) {
			const days = Math.round(event.reminderMinutes / (24 * 60));
			if (days > 0) {
				fm[settings.daysBeforeProp] = days;
			}
		}
	} else {
		if (event.reminderMinutes !== undefined) {
			fm[settings.minutesBeforeProp] = event.reminderMinutes;
		}
	}

	if (event.categories && event.categories.length > 0) {
		fm[settings.categoryProp] = event.categories;
	}

	return fm;
}

export async function createEventNoteFromImportedEvent(
	app: App,
	bundle: CalendarBundle,
	event: ImportedEvent,
	options: {
		targetDirectory: string;
		timezone: string;
		additionalFrontmatter?: Frontmatter;
	}
): Promise<TFile> {
	const { targetDirectory, timezone, additionalFrontmatter } = options;
	await ensureFolderExists(app, targetDirectory);

	let filename: string;
	let zettelId: string;

	const originalBasename = extractBasenameFromOriginalPath(event.originalFilePath);
	const existingZettelId = originalBasename ? extractZettelId(originalBasename) : null;

	if (existingZettelId && originalBasename) {
		const titleWithoutZettel = removeZettelId(originalBasename);
		filename = `${titleWithoutZettel}-${existingZettelId}`;
		zettelId = existingZettelId;
	} else {
		const baseName = originalBasename || sanitizeForFilename(event.title, { style: "preserve" });
		const generated = generateUniqueEventPath(app, targetDirectory, baseName);
		filename = generated.filename;
		zettelId = generated.zettelId;
	}

	const calendarSettings = bundle.settingsStore.currentSettings;
	const frontmatter = buildFrontmatterFromImportedEvent(event, calendarSettings, timezone);

	if (calendarSettings.zettelIdProp) {
		frontmatter[calendarSettings.zettelIdProp] = zettelId;
	}

	if (additionalFrontmatter) {
		Object.assign(frontmatter, additionalFrontmatter);
	}

	const content = event.description ? `\n${event.description}\n` : undefined;

	return await bundle.templateService.createFile({
		title: event.title,
		targetDirectory,
		filename,
		content,
		frontmatter,
	});
}

type ImportProgressCallback = (current: number, total: number, eventTitle?: string) => void;

export async function importEventsToCalendar(
	app: App,
	bundle: CalendarBundle,
	events: ImportedEvent[],
	timezone: string,
	onProgress?: ImportProgressCallback
): Promise<{ successCount: number; errorCount: number; skippedCount: number }> {
	const settings = bundle.settingsStore.currentSettings;

	const existingEventIds = new Set(bundle.eventStore.getAllEvents().map((e) => e.id));
	const newEvents = events.filter((e) => !existingEventIds.has(e.uid));
	const skippedCount = events.length - newEvents.length;

	if (newEvents.length === 0) {
		return { successCount: 0, errorCount: 0, skippedCount };
	}

	let successCount = 0;
	let errorCount = 0;

	for (let i = 0; i < newEvents.length; i++) {
		const event = newEvents[i];
		try {
			await createEventNoteFromImportedEvent(app, bundle, event, {
				targetDirectory: settings.directory,
				timezone,
			});
			successCount++;
			onProgress?.(i + 1, newEvents.length, event.title);
		} catch (error) {
			console.error(`Failed to import event "${event.title}":`, error);
			errorCount++;
			onProgress?.(i + 1, newEvents.length, event.title);
		}
	}

	return { successCount, errorCount, skippedCount };
}
