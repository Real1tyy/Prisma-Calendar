import { WALL_CLOCK_PARSE_OPTS } from "@real1ty/obsidian-plugins";
import { DateTime } from "luxon";

import { stripZ, toInternalISO } from "./iso";

/**
 * The exclusive end boundary of an all-day event. A missing, invalid or
 * non-advancing `end` resolves to the day after `start` — a single-day event.
 */
export function allDayEnd(start: string, end?: string | null): string {
	const day = DateTime.fromISO(stripZ(start), WALL_CLOCK_PARSE_OPTS).startOf("day");
	const candidate = end ? DateTime.fromISO(stripZ(end), WALL_CLOCK_PARSE_OPTS).startOf("day") : null;
	return toInternalISO(candidate?.isValid && candidate > day ? candidate : day.plus({ days: 1 }));
}

/**
 * The exclusive end of a multi-day span, or `undefined` for a single-day event.
 * Single-day events carry no end at all ([[decision-all-day-events-use-start-day-and-end-day]]).
 */
export function allDaySpanEnd(start: string, end?: string | null): string | undefined {
	if (!end) return undefined;
	const resolved = allDayEnd(start, end);
	return resolved === allDayEnd(start) ? undefined : resolved;
}

/** Spreads `{ end }` only when a span end exists, so a single-day event has no `end` key. */
export function optionalEnd(end: string | undefined): { end?: string } {
	return end ? { end } : {};
}

/** A form's inclusive last day, never before `startDay` (an empty or earlier value means the start day). */
export function clampLastDay(startDay: string, lastDay?: string | null): string {
	return lastDay && lastDay >= startDay ? lastDay : startDay;
}

/** Inclusive last day (`YYYY-MM-DD`) → stored exclusive end day: the day after. */
export function exclusiveEndDay(startDay: string, lastDay?: string | null): string {
	return allDayEnd(clampLastDay(startDay, lastDay)).slice(0, 10);
}

/** Stored exclusive end → the inclusive last day (`YYYY-MM-DD`) shown to the user. */
export function lastDayOfSpan(exclusiveEnd: string): string {
	return toInternalISO(
		DateTime.fromISO(stripZ(exclusiveEnd), WALL_CLOCK_PARSE_OPTS).startOf("day").minus({ days: 1 })
	).slice(0, 10);
}

/** `Date` twin of `lastDayOfSpan`, for display code that already holds `Date`s. */
export function lastAllDayDate(exclusiveEnd: Date): Date {
	const last = new Date(exclusiveEnd);
	last.setDate(last.getDate() - 1);
	return last;
}
