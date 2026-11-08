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
 *
 * Sanitizing is lossy (every non-ASCII character becomes `_`, so `状态` and `备注` are both
 * `prop___`), and two keys sharing a name would make the evaluation scope hand one key's value
 * to the other. A later key that collides gets a `$n` suffix; `$` is a valid identifier
 * character that `sanitizePropertyName` never emits, so a suffixed name cannot clash with a
 * natural one.
 */
export function buildPropertyMapping(properties: string[]): Map<string, string> {
	const mapping = new Map<string, string>();
	const taken = new Set<string>();

	for (const prop of properties) {
		if (mapping.has(prop)) continue;
		const base = sanitizePropertyName(prop);
		let name = base;
		for (let n = 2; taken.has(name); n++) {
			name = `${base}$${n}`;
		}
		taken.add(name);
		mapping.set(prop, name);
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

// Quoted string literals, honouring backslash escapes.
const STRING_LITERAL_SOURCE = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/.source;

/**
 * Replaces property names in an expression with their sanitized versions.
 *
 * String literals are never rewritten: the mapping accumulates frontmatter keys from every
 * note an evaluator has seen, so a key equal to a rule's compared value (`Status === "Done"`
 * plus some note with a `Done` key) would otherwise corrupt the value and the rule would
 * silently stop matching.
 *
 * One left-to-right scan, keys tried before literals: a key containing a quote (`Bob's Date`)
 * is consumed whole instead of opening a literal, and a key sitting inside a literal is never
 * reached because the literal is consumed first. Longest keys lead the alternation so
 * `Start Date` wins over `Start`.
 */
export function sanitizeExpression(expression: string, propertyMapping: Map<string, string>): string {
	const replacements = new Map(
		Array.from(propertyMapping).filter(([original, sanitizedName]) => original !== sanitizedName)
	);
	if (replacements.size === 0) return expression;

	const keyAlternation = Array.from(replacements.keys())
		.sort((a, b) => b.length - a.length)
		.map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
		.join("|");
	// Lookarounds instead of `\b` so keys with special characters like "My-Property" still match
	const tokenRegex = new RegExp(`(?<!\\w)(${keyAlternation})(?!\\w)|${STRING_LITERAL_SOURCE}`, "g");

	return expression.replace(tokenRegex, (match, key: string | undefined) =>
		key === undefined ? match : (replacements.get(key) ?? match)
	);
}
