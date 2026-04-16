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
 * Extracts bare identifiers from an expression that aren't JavaScript keywords or
 * string literals. These are the property names the expression references.
 */
export function extractExpressionIdentifiers(expression: string): string[] {
	const JS_RESERVED = new Set([
		"true",
		"false",
		"null",
		"undefined",
		"typeof",
		"instanceof",
		"in",
		"new",
		"this",
		"return",
		"if",
		"else",
		"var",
		"let",
		"const",
		"void",
		"delete",
		// Built-in globals that should not be treated as frontmatter properties
		"Array",
		"Object",
		"Math",
		"JSON",
		"String",
		"Number",
		"Boolean",
		"Date",
		"RegExp",
		"Map",
		"Set",
		"parseInt",
		"parseFloat",
		"isNaN",
		"isFinite",
		"NaN",
		"Infinity",
	]);

	// Strip string literals (both single and double quoted) to avoid matching identifiers inside strings
	const withoutStrings = expression.replace(/(["'])(?:(?!\1).)*\1/g, "");

	// Match bare identifiers (not preceded by a dot to avoid object property access like obj.prop)
	const identifierRegex = /(?<![.\w])([a-zA-Z_$][a-zA-Z0-9_$]*)(?!\s*:(?!:))/g;
	const identifiers = new Set<string>();
	let match;
	while ((match = identifierRegex.exec(withoutStrings)) !== null) {
		const id = match[1];
		if (!JS_RESERVED.has(id) && !id.startsWith("prop_")) {
			identifiers.add(id);
		}
	}

	return Array.from(identifiers);
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
