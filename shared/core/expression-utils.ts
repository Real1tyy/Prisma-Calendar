/**
 * Sanitizes a property name for use as a JavaScript function parameter
 * by replacing spaces and special characters with underscores.
 * Adds a prefix to avoid conflicts with JavaScript reserved words.
 */
export function sanitizePropertyName(name: string): string {
	const sanitized = name.replace(/[^a-zA-Z0-9_]/g, "_");
	return `prop_${sanitized}`;
}

/**
 * Builds a mapping of original property names to sanitized versions
 * suitable for use as JavaScript function parameters.
 */
export function buildPropertyMapping(properties: string[]): Map<string, string> {
	const mapping = new Map<string, string>();

	for (const prop of properties) {
		mapping.set(prop, sanitizePropertyName(prop));
	}

	return mapping;
}

/**
 * Replaces property names in an expression with their sanitized versions.
 * Sorts by length descending to replace longer property names first and avoid partial matches.
 */
export function sanitizeExpression(expression: string, propertyMapping: Map<string, string>): string {
	let sanitized = expression;

	// Sort by length descending to replace longer property names first
	const sortedEntries = Array.from(propertyMapping.entries()).sort(([a], [b]) => b.length - a.length);

	for (const [original, sanitizedName] of sortedEntries) {
		if (original !== sanitizedName) {
			const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

			// Use a regex that matches the property name not preceded or followed by word characters
			// This allows matching properties with special characters like "My-Property"
			const regex = new RegExp(`(?<!\\w)${escaped}(?!\\w)`, "g");

			sanitized = sanitized.replace(regex, sanitizedName);
		}
	}

	return sanitized;
}
