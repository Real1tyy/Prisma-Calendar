import { calculateDuration, formatDurationHumanReadable, intoDate, isNotEmpty } from "@real1ty-obsidian-plugins";
import { DateTime } from "luxon";

import type { Frontmatter } from "../types";
import { type CalendarEvent, type CalendarEventData, isAllDayEvent, isTimedEvent } from "../types/calendar";
import type { SingleCalendarConfig } from "../types/settings";
import { cleanupTitle } from "./events/naming";
import { getInternalProperties } from "./frontmatter/props";
import { stripZ } from "./iso";
import { extractPropertyText, getDisplayProperties } from "./property-display";

export function formatEventTimeInfo(event: CalendarEvent): string {
	const startTime = DateTime.fromISO(event.start);
	if (isAllDayEvent(event)) {
		return `All Day - ${startTime.toFormat("MMM d, yyyy")}`;
	}
	const endTime = isTimedEvent(event) ? DateTime.fromISO(event.end) : null;
	if (endTime && endTime > startTime) {
		const durationText = formatDurationHumanReadable(startTime, endTime);
		return `${startTime.toFormat("MMM d, yyyy - h:mm a")} (${durationText})`;
	}
	return startTime.toFormat("MMM d, yyyy - h:mm a");
}

/**
 * Formats a date/datetime for HTML datetime-local input fields.
 * Includes seconds so stopwatch saves preserve full precision.
 * NOTE: This version accepts string | Date (unlike the shared version which is string-only).
 */
export function formatDateTimeForInput(dateInput: string | Date): string {
	const dateStr = typeof dateInput === "string" ? stripZ(dateInput) : dateInput;
	const date = intoDate(dateStr);
	if (!date) throw new Error("Invalid date input");

	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	const seconds = String(date.getSeconds()).padStart(2, "0");
	return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Formats a date for HTML date input fields.
 * Strips Z suffix to treat as local time and returns YYYY-MM-DD format.
 */
export function formatDateOnly(dateInput: string | Date): string {
	const dateStr = typeof dateInput === "string" ? stripZ(dateInput) : dateInput;
	const date = intoDate(dateStr);
	if (!date) throw new Error("Invalid date input");

	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function formatDateTimeDisplay(dateInput: string | Date): string {
	const dateStr = typeof dateInput === "string" ? stripZ(dateInput) : dateInput;
	const date = intoDate(dateStr);
	if (!date) return typeof dateInput === "string" ? dateInput : "";
	return date.toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function formatDateOnlyDisplay(dateInput: string | Date): string {
	const dateStr = typeof dateInput === "string" ? stripZ(dateInput) : dateInput;
	const date = intoDate(dateStr);
	if (!date) return typeof dateInput === "string" ? dateInput : "";
	return date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function formatEventDateSuffix(start: Date, end: Date | null, allDay: boolean, locale: string): string {
	if (allDay) {
		const dateStr = start.toLocaleDateString(locale, {
			weekday: "short",
			month: "short",
			day: "numeric",
			year: "numeric",
		});
		return ` - ${dateStr}`;
	}

	const startStr = start.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
	if (end) {
		const endStr = end.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
		const duration = calculateDuration(start, end);
		return ` - ${startStr} - ${endStr} (${duration})`;
	}
	return ` - ${startStr}`;
}

export function buildEventTooltip(
	event: CalendarEvent | CalendarEventData,
	settings: Pick<SingleCalendarConfig, "frontmatterDisplayProperties" | "frontmatterDisplayPropertiesAllDay" | "locale">
): string {
	const title = event.title;
	const meta = "meta" in event ? event.meta : (event.extendedProps.frontmatterDisplayData ?? {});
	const start = "ref" in event ? new Date(event.start) : event.start;
	const end = "ref" in event ? (event.type === "timed" && event.end ? new Date(event.end) : null) : event.end;
	const allDay = "ref" in event ? event.type === "allDay" : event.allDay;

	if (!start) return cleanupTitle(title);

	const tooltipParts: string[] = [cleanupTitle(title) + formatEventDateSuffix(start, end, allDay, settings.locale)];
	const displayProps = allDay ? settings.frontmatterDisplayPropertiesAllDay : settings.frontmatterDisplayProperties;
	for (const [prop, value] of getDisplayProperties(meta, displayProps)) {
		tooltipParts.push(`${prop}: ${extractPropertyText(value)}`);
	}
	return tooltipParts.join("\n");
}

export function categorizeProperties(
	frontmatter: Frontmatter,
	settings: SingleCalendarConfig,
	allDay?: boolean
): {
	displayProperties: [string, unknown][];
	otherProperties: [string, unknown][];
} {
	const internalProperties = getInternalProperties(settings);
	const displayPropertiesList = allDay
		? settings.frontmatterDisplayPropertiesAllDay
		: settings.frontmatterDisplayProperties;
	const displayPropertyKeys = new Set(displayPropertiesList);

	const displayProperties: [string, unknown][] = [];
	const otherProperties: [string, unknown][] = [];

	for (const [key, value] of Object.entries(frontmatter)) {
		if (internalProperties.has(key) || !isNotEmpty(value)) continue;
		if (settings.skipUnderscoreProperties && key.startsWith("_")) continue;

		if (displayPropertyKeys.has(key)) {
			displayProperties.push([key, value]);
		} else {
			otherProperties.push([key, value]);
		}
	}

	return { displayProperties, otherProperties };
}
