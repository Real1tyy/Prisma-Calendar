import { DateTime } from "luxon";

// ─── Value Conversion ────────────────────────────────────────

export function toSafeString(value: unknown): string | null {
	if (value == null) return null;
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return null;
}

export function intoDate(input: unknown): Date | null {
	if (input === null || input === undefined) return null;
	const date = typeof input === "string" ? new Date(input) : input instanceof Date ? input : null;
	if (date === null || Number.isNaN(date.getTime())) return null;
	return date;
}

// ─── Date Formatting for Inputs ──────────────────────────────

interface DateParts {
	year: number;
	month: string;
	day: string;
	hours: string;
	minutes: string;
	seconds: string;
	ms: string;
}

function formatDateParts(date: Date): DateParts {
	return {
		year: date.getFullYear(),
		month: String(date.getMonth() + 1).padStart(2, "0"),
		day: String(date.getDate()).padStart(2, "0"),
		hours: String(date.getHours()).padStart(2, "0"),
		minutes: String(date.getMinutes()).padStart(2, "0"),
		seconds: String(date.getSeconds()).padStart(2, "0"),
		ms: String(date.getMilliseconds()).padStart(3, "0"),
	};
}

export const formatDateTimeForInput = (dateString: string): string => {
	if (!dateString) return "";

	try {
		const p = formatDateParts(new Date(dateString));
		return `${p.year}-${p.month}-${p.day}T${p.hours}:${p.minutes}`;
	} catch {
		return "";
	}
};

export const formatDateForInput = (dateString: string): string => {
	if (!dateString) return "";

	try {
		const p = formatDateParts(new Date(dateString));
		return `${p.year}-${p.month}-${p.day}`;
	} catch {
		return "";
	}
};

/**
 * Converts input value to ISO string, handling edge cases where
 * browser datetime-local inputs behave differently across platforms.
 * Returns null for invalid dates to prevent silent failures.
 */
export const inputValueToISOString = (inputValue: string): string | null => {
	try {
		return new Date(inputValue).toISOString();
	} catch {
		return null;
	}
};

export const formatDuration = (minutes: number): string => {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
};

/**
 * Parse time string from datetime value - returns DateTime object
 * Rejects plain HH:mm format, requires full datetime
 */
export const parseTimeString = (value: string | null): DateTime | undefined => {
	if (value === null) return undefined;

	const v = value.trim();

	// Reject plain HH:mm format - require full datetime
	if (/^\d{2}:\d{2}$/.test(v)) {
		return undefined; // Reject plain time format
	}

	// Try ISO format first (most common) - EXACT same logic as recurring events
	let dt = DateTime.fromISO(v, { setZone: true }); // ISO: with/without seconds, Z/offset, T
	if (!dt.isValid) dt = DateTime.fromSQL(v, { setZone: true }); // "YYYY-MM-DD HH:mm[:ss]" etc.
	if (!dt.isValid) dt = DateTime.fromFormat(v, "yyyy-MM-dd HH:mm", { setZone: true });

	return dt.isValid ? dt : undefined;
};

/**
 * Parse and validate datetime strings for event parsing
 * Supports multiple formats including date-only and datetime formats
 */
export const parseDateTimeString = (value: string | null): DateTime | undefined => {
	if (value === null) return undefined;

	const v = value.trim();
	if (!v) return undefined;

	// Try multiple datetime formats in order of preference
	let dt: DateTime;

	// 1. Try ISO format first (most common)
	dt = DateTime.fromISO(v, { setZone: true });
	if (dt.isValid) return dt;

	// 2. Try SQL format (YYYY-MM-DD HH:mm:ss)
	dt = DateTime.fromSQL(v, { setZone: true });
	if (dt.isValid) return dt;

	// 3. Try common format with space (YYYY-MM-DD HH:mm)
	dt = DateTime.fromFormat(v, "yyyy-MM-dd HH:mm", { setZone: true });
	if (dt.isValid) return dt;

	// 4. Try date-only format (YYYY-MM-DD) - treat as start of day
	dt = DateTime.fromFormat(v, "yyyy-MM-dd", { setZone: true });
	if (dt.isValid) return dt;

	return undefined;
};

// ─── ISO String Manipulation ─────────────────────────────────

export function ensureISOSuffix(datetime: string): string {
	if (!datetime.includes("T")) return datetime;
	if (datetime.endsWith(".000Z")) return datetime;
	const stripped = datetime.endsWith("Z") ? datetime.slice(0, -1) : datetime;
	const timePart = stripped.split("T")[1];
	const parts = timePart.split(":");
	if (parts.length === 2) return `${stripped}:00.000Z`;
	const base = stripped.includes(".") ? stripped.split(".")[0] : stripped;
	return `${base}.000Z`;
}

export function toLocalISOString(date: Date): string {
	const p = formatDateParts(date);
	return `${p.year}-${p.month}-${p.day}T${p.hours}:${p.minutes}:${p.seconds}.${p.ms}Z`;
}

export function getISODatePart(iso: string): string {
	const idx = iso.indexOf("T");
	return idx === -1 ? iso : iso.slice(0, idx);
}

export function getISOTimePart(iso: string): string {
	const idx = iso.indexOf("T");
	return idx === -1 ? "" : iso.slice(idx);
}

export function replaceISOTime(iso: string, newTimePart: string): string {
	return `${getISODatePart(iso)}${newTimePart}`;
}

export function parseTimeToMins(isoStr: string): number {
	const timePart = isoStr.slice(11, 16);
	const [hours, minutes] = timePart.split(":").map(Number);
	return hours * 60 + minutes;
}

export function minsToTimeStr(mins: number): string {
	const h = Math.floor(mins / 60)
		.toString()
		.padStart(2, "0");
	const m = (mins % 60).toString().padStart(2, "0");
	return `${h}:${m}`;
}

// ─── Duration Calculation ────────────────────────────────────

export function calculateDuration(start: Date, end: Date): string {
	const durationMs = end.getTime() - start.getTime();
	const hours = Math.floor(durationMs / (1000 * 60 * 60));
	const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
	if (hours === 0) return `${minutes}m`;
	if (minutes === 0) return `${hours}h`;
	return `${hours}h ${minutes}m`;
}

export function calculateDurationMinutes(start: string | Date, end: string | Date): number {
	const startDate = intoDate(start);
	const endDate = intoDate(end);
	if (!startDate || !endDate) return 0;
	return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
}

export function formatDurationHumanReadable(start: DateTime, end: DateTime): string {
	const durationMs = end.diff(start).toMillis();
	const hours = Math.floor(durationMs / (1000 * 60 * 60));
	const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
	if (hours === 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
	if (minutes === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
	return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

// ─── Date Arithmetic ─────────────────────────────────────────

export function roundToNearestHour(date: Date): Date {
	const rounded = new Date(date);
	if (rounded.getMinutes() >= 30) rounded.setHours(rounded.getHours() + 1);
	rounded.setMinutes(0);
	rounded.setSeconds(0);
	rounded.setMilliseconds(0);
	return rounded;
}

export function calculateEndTime(startTime: string, durationMinutes: number): string {
	const timePart = startTime.split(".")[0];
	const [hours, minutes] = timePart.split(":").map(Number);
	const endMinutes = minutes + durationMinutes;
	const endHours = hours + Math.floor(endMinutes / 60);
	const finalMinutes = endMinutes % 60;
	return `${String(endHours).padStart(2, "0")}:${String(finalMinutes).padStart(2, "0")}:00.000Z`;
}

export function applySourceTimeToInstanceDate(instanceDate: DateTime, sourceDateTime: DateTime): DateTime {
	return instanceDate.set({
		hour: sourceDateTime.hour,
		minute: sourceDateTime.minute,
		second: sourceDateTime.second,
		millisecond: sourceDateTime.millisecond,
	});
}

// ─── Time Formatting ─────────────────────────────────────────

export function formatMsToHHMMSS(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function formatMsToMMSS(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function parseAsLocalDate(dateString: string): Date | null {
	try {
		const localDateString = String(dateString)
			.trim()
			.replace(/([+-]\d{2}:?\d{2}|Z)$/i, "");
		const date = new Date(localDateString);
		if (Number.isNaN(date.getTime())) return null;
		return date;
	} catch {
		return null;
	}
}

// ─── Text Utilities ──────────────────────────────────────────

export function getNotePreviewLines(content: string, lineCount: number): string {
	const lines: string[] = [];
	for (const line of content.split("\n")) {
		if (lines.length >= lineCount) break;
		const trimmed = line.trim();
		if (trimmed) lines.push(trimmed);
	}
	return lines.join("\n");
}

// ─── Async DOM Utilities ─────────────────────────────────────

export function afterRender(): Promise<void> {
	return new Promise<void>((resolve) => {
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
	});
}
