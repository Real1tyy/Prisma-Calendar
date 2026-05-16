/**
 * Convert a human-readable label to a kebab-case identifier. Used to derive
 * stable IDs from labels (e.g. `<Cell label="Top Items">` → `"top-items"`).
 *
 * - Inserts a `-` between adjacent lowercase / uppercase (`fooBar` → `foo-bar`).
 * - Collapses runs of whitespace and underscores to single `-`.
 * - Drops characters that aren't `[a-z0-9-]` after lowering.
 */
export function toKebabCase(input: string): string {
	return input
		.trim()
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.replace(/[\s_]+/g, "-")
		.replace(/[^a-zA-Z0-9-]/g, "")
		.toLowerCase();
}
