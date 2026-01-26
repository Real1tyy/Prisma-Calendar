import { DateTime } from "luxon";

export const formatDateTimeForInput = (dateString: string): string => {
	if (!dateString) return "";

	try {
		const date = new Date(dateString);
		// Format for datetime-local input (YYYY-MM-DDTHH:mm)
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");

		return `${year}-${month}-${day}T${hours}:${minutes}`;
	} catch {
		return "";
	}
};

export const formatDateForInput = (dateString: string): string => {
	if (!dateString) return "";

	try {
		const date = new Date(dateString);
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");

		return `${year}-${month}-${day}`;
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

	// 5. Try ISO date format (YYYY-MM-DD)
	dt = DateTime.fromISO(v, { setZone: true });
	if (dt.isValid) return dt;

	return undefined;
};
