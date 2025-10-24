/**
 * Sanitizes a property name for use as a JavaScript function parameter
 * by replacing spaces and special characters with underscores.
 */
export function sanitizePropertyName(name: string): string {
	return name.replace(/[^a-zA-Z0-9_]/g, "_");
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
 * Only replaces whole word boundaries to avoid partial matches.
 */
export function sanitizeExpression(expression: string, propertyMapping: Map<string, string>): string {
	let sanitized = expression;

	for (const [original, sanitizedName] of propertyMapping) {
		if (original !== sanitizedName) {
			const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const regex = new RegExp(`\\b${escaped}\\b`, "g");
			sanitized = sanitized.replace(regex, sanitizedName);
		}
	}

	return sanitized;
}
