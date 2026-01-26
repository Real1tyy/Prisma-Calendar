import { normalizePath } from "obsidian";

import { formatWikiLink, parsePropertyLinks } from "./link-parser";

/**
 * Adds a link to a property, avoiding duplicates using normalized path comparison.
 * Prevents cycles and duplicate relationships by comparing normalized paths.
 *
 * **Important**: linkPath should be WITHOUT .md extension (wikilink format).
 *
 * @param currentValue - The current property value (can be string, string[], or undefined)
 * @param linkPath - The file path to add (without .md extension, e.g., "folder/file")
 * @returns New array with link added, or same array if link already exists
 *
 * @example
 * ```ts
 * addLinkToProperty(undefined, "MyNote") // ["[[MyNote]]"]
 * addLinkToProperty("[[Note1]]", "Note2") // ["[[Note1]]", "[[Note2]]"]
 * addLinkToProperty(["[[Note1]]"], "Note2") // ["[[Note1]]", "[[Note2]]"]
 * addLinkToProperty(["[[Note1]]"], "Note1") // ["[[Note1]]"] (no change - duplicate prevented)
 * addLinkToProperty(["[[Folder/Note]]"], "folder/note") // ["[[Folder/Note]]", "[[folder/note|note]]"] (case-sensitive, different entry)
 * ```
 */
export function addLinkToProperty(currentValue: string | string[] | undefined, linkPath: string): string[] {
	// Handle undefined or null
	if (currentValue === undefined || currentValue === null) {
		return [formatWikiLink(linkPath)];
	}

	// Normalize to array
	const currentArray = Array.isArray(currentValue) ? currentValue : [currentValue];

	const existingPaths = parsePropertyLinks(currentArray);

	// Normalize paths for comparison to prevent duplicates with different casing or separators
	const normalizedLinkPath = normalizePath(linkPath);

	const normalizedExistingPaths = existingPaths.map((p) => normalizePath(p));

	// Only add if not already present (using normalized path comparison)
	if (!normalizedExistingPaths.includes(normalizedLinkPath)) {
		return [...currentArray, formatWikiLink(linkPath)];
	}

	return currentArray;
}

/**
 * Removes a link from a property using normalized path comparison.
 *
 * @param currentValue - The current property value (can be string, string[], or undefined)
 * @param linkPath - The file path to remove (without .md extension)
 * @returns New array with link removed (can be empty)
 *
 * @example
 * ```ts
 * removeLinkFromProperty(["[[Note1]]", "[[Note2]]"], "Note1") // ["[[Note2]]"]
 * removeLinkFromProperty(["[[Note1]]"], "Note1") // []
 * removeLinkFromProperty("[[Note1]]", "Note1") // []
 * removeLinkFromProperty(undefined, "Note1") // []
 * removeLinkFromProperty(["[[Folder/Note]]"], "Folder/Note") // [] (case-sensitive removal)
 * ```
 */
export function removeLinkFromProperty(currentValue: string | string[] | undefined, linkPath: string): string[] {
	if (currentValue === undefined || currentValue === null) {
		return [];
	}

	// Normalize to array
	const currentArray = Array.isArray(currentValue) ? currentValue : [currentValue];

	const normalizedLinkPath = normalizePath(linkPath);

	return currentArray.filter((item) => {
		const parsed = parsePropertyLinks([item])[0];

		if (!parsed) return true; // Keep invalid entries

		return normalizePath(parsed) !== normalizedLinkPath;
	});
}

/**
 * Checks if a link exists in a property using normalized path comparison.
 *
 * @param currentValue - The current property value (can be string, string[], or undefined)
 * @param linkPath - The file path to check (without .md extension)
 * @returns True if the link exists
 *
 * @example
 * ```ts
 * hasLinkInProperty(["[[Note1]]", "[[Note2]]"], "Note1") // true
 * hasLinkInProperty("[[Note1]]", "Note1") // true
 * hasLinkInProperty([], "Note1") // false
 * hasLinkInProperty(undefined, "Note1") // false
 * hasLinkInProperty(["[[Folder/Note]]"], "Folder/Note") // true (case-sensitive match)
 * ```
 */
export function hasLinkInProperty(currentValue: string | string[] | undefined, linkPath: string): boolean {
	const existingPaths = parsePropertyLinks(currentValue);

	const normalizedLinkPath = normalizePath(linkPath);

	return existingPaths.some((path) => normalizePath(path) === normalizedLinkPath);
}
