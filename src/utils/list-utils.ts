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

export function areSetsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
	if (a === b) return true;
	if (a.size !== b.size) return false;
	for (const value of a) {
		if (!b.has(value)) return false;
	}
	return true;
}
