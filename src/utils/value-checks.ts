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
