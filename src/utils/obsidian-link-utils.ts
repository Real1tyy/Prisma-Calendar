export interface ObsidianLink {
	/** The original string including brackets */
	raw: string;
	/** The link path (before pipe if present) */
	path: string;
	/** The display text (after pipe if present, otherwise same as path) */
	display: string;
	/** Whether this link uses pipe syntax */
	hasPipe: boolean;
}

/**
 * Checks if a value is an Obsidian internal link in the format [[...]]
 */
export function isObsidianLink(value: unknown): boolean {
	if (typeof value !== "string") return false;
	const trimmed = value.trim();
	return /^\[\[.+\]\]$/.test(trimmed);
}

/**
 * Parses an Obsidian internal link and extracts its components
 *
 * Supports both formats:
 * - Simple: [[Page Name]]
 * - With alias: [[Path/To/Page|Display Name]]
 *
 * @param linkString - The link string including brackets
 * @returns Parsed link object or null if invalid
 */
export function parseObsidianLink(linkString: string): ObsidianLink | null {
	const trimmed = linkString.trim();

	// Validate format
	const match = trimmed.match(/^\[\[(.+?)\]\]$/);
	if (!match) return null;

	const linkContent = match[1];

	// Handle pipe syntax: [[path|display]]
	if (linkContent.includes("|")) {
		const parts = linkContent.split("|");
		const path = parts[0].trim();
		const display = parts.slice(1).join("|").trim(); // Handle multiple pipes

		return {
			raw: trimmed,
			path,
			display,
			hasPipe: true,
		};
	}

	// Simple format: [[path]]
	const path = linkContent.trim();
	return {
		raw: trimmed,
		path,
		display: path,
		hasPipe: false,
	};
}

/**
 * Extracts the display text from an Obsidian link
 * - For [[path|display]], returns "display"
 * - For [[path]], returns "path"
 * - For invalid links, returns the original string
 */
export function getObsidianLinkDisplay(linkString: string): string {
	const parsed = parseObsidianLink(linkString);
	return parsed?.display ?? linkString;
}

/**
 * Extracts the link path from an Obsidian link
 * - For [[path|display]], returns "path"
 * - For [[path]], returns "path"
 * - For invalid links, returns the original string
 */
export function getObsidianLinkPath(linkString: string): string {
	const parsed = parseObsidianLink(linkString);
	return parsed?.path ?? linkString;
}

/**
 * Checks if a string is a file path (not an Obsidian link)
 *
 * Heuristics:
 * - Has .md extension
 * - Contains path separators (/ or \) without spaces
 * - Doesn't start with http
 */
export function isFilePath(value: unknown): boolean {
	if (typeof value !== "string") return false;

	// Not a file path if it's an Obsidian link
	if (isObsidianLink(value)) return false;

	const str = value.trim();

	// Check for markdown extension
	if (str.endsWith(".md")) return true;

	// Check for path separators
	const hasPathSeparator = str.includes("/") || str.includes("\\");
	if (hasPathSeparator && !str.includes(" ") && !str.startsWith("http")) {
		return true;
	}

	return false;
}
