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

/**
 * Extracts property names from color rule expressions.
 * Identifies properties that are used with .includes() and need array defaults.
 */
function extractPropertiesFromExpressions(expressions: string[]): { arrayProperties: Set<string> } {
	const arrayProperties = new Set<string>();

	for (const expression of expressions) {
		// Match patterns like "Property.includes(" or "Property?.includes("
		// This catches the specific case that causes errors: Category.includes('X')
		const includesPattern = /\b([A-Za-z_][A-Za-z0-9_]*)\??\.includes\(/g;
		let match: RegExpExecArray | null = null;
		// biome-ignore lint/suspicious/noAssignInExpressions: Required for regex.exec() iteration pattern
		while ((match = includesPattern.exec(expression)) !== null) {
			const propName = match[1];
			// Skip JavaScript built-in methods
			if (propName !== "Array" && propName !== "String") {
				arrayProperties.add(propName);
			}
		}
	}

	return { arrayProperties };
}

/**
 * Normalizes frontmatter for color rule evaluation by ensuring properties used with .includes() exist.
 * Properties used with .includes() default to empty arrays to prevent "Cannot read properties of undefined" errors.
 * This fixes the issue where expressions like "Category.includes('X')" fail when Category is undefined.
 */
export function normalizeFrontmatterForColorEvaluation(
	frontmatter: Record<string, unknown>,
	colorRules: Array<{ expression: string; enabled: boolean }>
): Record<string, unknown> {
	const enabledExpressions = colorRules.filter((rule) => rule.enabled).map((rule) => rule.expression);
	if (enabledExpressions.length === 0) {
		return frontmatter;
	}

	const { arrayProperties } = extractPropertiesFromExpressions(enabledExpressions);

	// If no properties use .includes(), no normalization needed
	if (arrayProperties.size === 0) {
		return frontmatter;
	}

	const normalized = { ...frontmatter };

	// Ensure properties used with .includes() default to empty array
	// This prevents "Cannot read properties of undefined (reading 'includes')" errors
	// Also handle null/undefined values by converting them to empty arrays
	for (const propName of arrayProperties) {
		const value = normalized[propName];
		// If property doesn't exist, is null, or is undefined, default to empty array
		// This ensures .includes() calls don't throw errors
		if (!(propName in normalized) || value === null || value === undefined) {
			normalized[propName] = [];
		}
	}

	return normalized;
}
