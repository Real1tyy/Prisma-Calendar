import { intoDate, toLocalISOString } from "@real1ty-obsidian-plugins";

/**
 * Safely converts a FullCalendar event date (Date object or ISO string) to a
 * local ISO string without timezone suffix. Returns empty string if the input
 * is null, undefined, or unparseable.
 */
export function toSafeLocalISO(value: string | Date | null | undefined): string {
	if (value == null) return "";
	const date = intoDate(value);
	if (!date) return "";
	return toLocalISOString(date);
}

/**
 * Converts a FullCalendar event date to a local ISO string or null.
 * Used for optional end dates where null means "no end".
 */
export function toSafeLocalISOOrNull(value: string | Date | null | undefined): string | null {
	if (value == null) return null;
	const date = intoDate(value);
	if (!date) return null;
	return toLocalISOString(date);
}
