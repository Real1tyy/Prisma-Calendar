export interface ObsidianLink {
	raw: string;
	path: string;
	alias: string;
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
 */
export function parseObsidianLink(linkString: string): ObsidianLink | null {
	if (!isObsidianLink(linkString)) return null;

	const trimmed = linkString.trim();
	const linkContent = trimmed.match(/^\[\[(.+?)\]\]$/)?.[1];
	if (!linkContent) return null;

	// Handle pipe syntax: [[path|display]]
	if (linkContent.includes("|")) {
		const parts = linkContent.split("|");
		const path = parts[0].trim();
		const alias = parts.slice(1).join("|").trim(); // Handle multiple pipes

		return {
			raw: trimmed,
			path,
			alias,
		};
	}

	// Simple format: [[path]]
	const path = linkContent.trim();
	return {
		raw: trimmed,
		path,
		alias: path,
	};
}

export function getObsidianLinkAlias(linkString: string): string {
	const parsed = parseObsidianLink(linkString);
	return parsed?.alias ?? linkString;
}

export function getObsidianLinkPath(linkString: string): string {
	const parsed = parseObsidianLink(linkString);
	return parsed?.path ?? linkString;
}
