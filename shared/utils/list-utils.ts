/**
 * Converts a value that could be a string, array, or other type into an array of strings.
 * Handles comma-separated strings, arrays, and other edge cases.
 *
 * @param value - The value to convert (string, array, number, or unknown)
 * @param options - Configuration options
 * @returns Array of trimmed, non-empty strings
 */
export function parseIntoList(
	value: unknown,
	options: { splitCommas?: boolean; defaultValue?: string[] } = {}
): string[] {
	const { splitCommas = true, defaultValue = [] } = options;

	if (value === undefined || value === null) {
		return defaultValue;
	}

	if (Array.isArray(value)) {
		const result: string[] = [];
		for (const item of value) {
			if (typeof item === "string") {
				if (splitCommas) {
					const parts = item
						.split(",")
						.map((s) => s.trim())
						.filter((s) => s.length > 0);
					result.push(...parts);
				} else {
					const trimmed = item.trim();
					if (trimmed.length > 0) {
						result.push(trimmed);
					}
				}
			} else if (typeof item === "number") {
				result.push(item.toString());
			}
		}
		return result.length > 0 ? result : defaultValue;
	}

	if (typeof value === "string") {
		if (splitCommas) {
			const parts = value
				.split(",")
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
			return parts.length > 0 ? parts : defaultValue;
		}
		const trimmed = value.trim();
		return trimmed.length > 0 ? [trimmed] : defaultValue;
	}

	if (typeof value === "number") {
		return [value.toString()];
	}

	return defaultValue;
}

/**
 * Converts an array back to the original format (array or comma-separated string).
 * Returns undefined for empty arrays when original was a string.
 *
 * @param categories - Array of category strings
 * @param originalValue - The original value to determine output format
 * @returns Array, string, or undefined based on original format
 */
export function formatListLikeOriginal(categories: string[], originalValue: unknown): unknown {
	// If empty array
	if (categories.length === 0) {
		// If original was a string, return undefined (to delete the property)
		if (typeof originalValue === "string") {
			return undefined;
		}
		// If original was an array, return empty array
		if (Array.isArray(originalValue)) {
			return [];
		}
		return undefined;
	}

	// If original was an array, return array
	if (Array.isArray(originalValue)) {
		return categories;
	}

	// If original was a string, return comma-separated string
	if (typeof originalValue === "string") {
		return categories.join(", ");
	}

	// Default to array for unknown types
	return categories;
}

/**
 * Parses category values into an array of strings.
 * Returns ["No Category"] for empty/undefined values.
 */
export function parseCategories(categoryValue: unknown): string[] {
	return parseIntoList(categoryValue, { defaultValue: ["No Category"] });
}

export function areSetsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
	if (a === b) return true;
	if (a.size !== b.size) return false;
	for (const value of a) {
		if (!b.has(value)) return false;
	}
	return true;
}

/**
 * Merges two pre-sorted arrays into a single sorted array in O(a.length + b.length).
 * Both inputs must already be sorted according to the provided comparator.
 *
 * @param a - First sorted array
 * @param b - Second sorted array
 * @param compare - Comparator function: returns negative if a < b, 0 if equal, positive if a > b
 */
export function mergeSorted<T>(a: T[], b: T[], compare: (a: T, b: T) => number): T[] {
	if (b.length === 0) return a;
	if (a.length === 0) return b;

	const result: T[] = new Array(a.length + b.length);
	let i = 0;
	let j = 0;
	let k = 0;

	while (i < a.length && j < b.length) {
		if (compare(a[i], b[j]) <= 0) {
			result[k++] = a[i++];
		} else {
			result[k++] = b[j++];
		}
	}
	while (i < a.length) result[k++] = a[i++];
	while (j < b.length) result[k++] = b[j++];

	return result;
}
