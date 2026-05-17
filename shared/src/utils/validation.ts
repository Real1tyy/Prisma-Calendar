/**
 * Checks if a value is not empty.
 * Returns false for: undefined, null, empty string, or empty arrays.
 * Returns true for all other values.
 */
export function isNotEmpty(value: unknown): boolean {
	if (value === undefined || value === null || value === "") {
		return false;
	}
	if (Array.isArray(value) && value.length === 0) {
		return false;
	}
	return true;
}

/**
 * Parses a value to a positive integer.
 * Handles both number and string types from frontmatter.
 * Returns the parsed integer if valid and positive, otherwise returns the fallback value.
 */
export function parsePositiveInt(value: unknown, fallback: number): number {
	if (value === undefined || value === null) {
		return fallback;
	}
	const parsed = typeof value === "number" ? Math.floor(value) : Number.parseInt(String(value), 10);
	return !Number.isNaN(parsed) && parsed > 0 ? parsed : fallback;
}
