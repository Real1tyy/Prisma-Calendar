/**
 * Serializes a frontmatter value to a string representation for display in input fields.
 * Converts arrays, objects, booleans, and numbers to their string representations.
 */
export function serializeFrontmatterValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (typeof value === "string") {
		return value;
	}

	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}

	if (Array.isArray(value) || typeof value === "object") {
		return JSON.stringify(value);
	}

	return String(value);
}

/**
 * Parses a string value back to its original frontmatter type.
 * Detects and converts to: arrays, objects, booleans, numbers, or keeps as string.
 */
export function parseFrontmatterValue(stringValue: string): unknown {
	// Empty string
	if (stringValue === "") {
		return "";
	}

	// Try to parse as JSON (arrays, objects, null)
	if (
		(stringValue.startsWith("[") && stringValue.endsWith("]")) ||
		(stringValue.startsWith("{") && stringValue.endsWith("}")) ||
		stringValue === "null"
	) {
		try {
			return JSON.parse(stringValue);
		} catch {
			// If JSON parse fails, return as string
			return stringValue;
		}
	}

	// Parse booleans
	if (stringValue === "true") {
		return true;
	}
	if (stringValue === "false") {
		return false;
	}

	// Parse numbers (including integers and floats)
	if (/^-?\d+(\.\d+)?$/.test(stringValue)) {
		const num = Number(stringValue);
		if (!Number.isNaN(num)) {
			return num;
		}
	}

	// Return as string if no other type matches
	return stringValue;
}

/**
 * Converts a record of string values back to their original frontmatter types.
 */
export function parseFrontmatterRecord(record: Record<string, string>): Record<string, unknown> {
	const parsed: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(record)) {
		parsed[key] = parseFrontmatterValue(value);
	}

	return parsed;
}
