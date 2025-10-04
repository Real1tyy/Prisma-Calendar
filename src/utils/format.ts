import type { DateTime } from "luxon";

/**
 * Formats a date/datetime for HTML datetime-local input fields.
 * Strips Z suffix to treat as local time and returns YYYY-MM-DDTHH:MM format.
 */
export function formatDateTimeForInput(dateInput: string | Date): string {
	// Strip Z suffix if present to treat as local time
	const dateStr = typeof dateInput === "string" ? dateInput.replace(/Z$/, "") : dateInput;
	const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;

	// Extract local time components (no UTC conversion)
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");

	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Formats a date for HTML date input fields.
 * Strips Z suffix to treat as local time and returns YYYY-MM-DD format.
 */
export function formatDateOnly(dateInput: string | Date): string {
	// Strip Z suffix if present to treat as local time
	const dateStr = typeof dateInput === "string" ? dateInput.replace(/Z$/, "") : dateInput;
	const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;

	// Use local time components
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * Converts datetime-local input value to ISO string with Z suffix (treating as local time).
 * Takes "2025-10-03T17:30" and returns "2025-10-03T17:30:00.000Z"
 */
export function inputValueToISOString(inputValue: string): string {
	// Append seconds and Z to maintain consistent format (Z is ignored, time is treated as local)
	return `${inputValue}:00.000Z`;
}

export function formatDurationHumanReadable(start: DateTime, end: DateTime): string {
	const durationMs = end.diff(start).toMillis();
	const hours = Math.floor(durationMs / (1000 * 60 * 60));
	const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

	if (hours === 0) {
		return `${minutes} minute${minutes === 1 ? "" : "s"}`;
	}
	if (minutes === 0) {
		return `${hours} hour${hours === 1 ? "" : "s"}`;
	}
	return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
}
