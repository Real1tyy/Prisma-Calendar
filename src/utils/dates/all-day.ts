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
