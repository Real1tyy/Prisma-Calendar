import { sanitizeFilenamePreserveSpaces } from "../file/file";

/**
 * Normalizes a directory path for consistent comparison.
 *
 * - Trims whitespace
 * - Removes leading and trailing slashes
 * - Converts empty/whitespace-only strings to empty string
 *
 * Examples:
 * - "tasks/" → "tasks"
 * - "/tasks" → "tasks"
 * - "/tasks/" → "tasks"
 * - "  tasks  " → "tasks"
 * - "" → ""
 * - "   " → ""
 * - "tasks/homework" → "tasks/homework"
 */
export const normalizeDirectoryPath = (directory: string): string => {
	return directory.trim().replace(/^\/+|\/+$/g, "");
};

/**
 * Extracts the date and suffix (everything after the date) from a physical instance filename.
 * Physical instance format: "[title] [date]-[ZETTELID]"
 *
 * @returns Object with dateStr and suffix, or null if no date found
 *
 * @example
 * extractDateAndSuffix("My Event 2025-01-15-ABC123") // { dateStr: "2025-01-15", suffix: "-ABC123" }
 * extractDateAndSuffix("Invalid filename") // null
 */
export const extractDateAndSuffix = (basename: string): { dateStr: string; suffix: string } | null => {
	const dateMatch = basename.match(/(\d{4}-\d{2}-\d{2})/);
	if (!dateMatch) {
		return null;
	}

	const dateStr = dateMatch[1];
	const dateIndex = basename.indexOf(dateStr);
	const suffix = basename.substring(dateIndex + dateStr.length);

	return { dateStr, suffix };
};

/**
 * Rebuilds a physical instance filename with a new title while preserving the date and zettel ID.
 * Physical instance format: "[title] [date]-[ZETTELID]"
 *
 * @param currentBasename - Current filename without extension
 * @param newTitle - New title (with or without zettel ID - will be stripped)
 * @returns New filename, or null if current filename format is invalid
 *
 * @example
 * rebuildPhysicalInstanceFilename("Old Title 2025-01-15-ABC123", "New Title-XYZ789")
 * // Returns: "New Title 2025-01-15-ABC123"
 */
export const rebuildPhysicalInstanceFilename = (currentBasename: string, newTitle: string): string | null => {
	const dateAndSuffix = extractDateAndSuffix(currentBasename);
	if (!dateAndSuffix) {
		return null;
	}

	const { dateStr, suffix } = dateAndSuffix;

	// Remove any zettel ID from the new title (just in case)
	const newTitleClean = newTitle.replace(/-[A-Z0-9]{6}$/, "");
	const newTitleSanitized = sanitizeFilenamePreserveSpaces(newTitleClean);

	return `${newTitleSanitized} ${dateStr}${suffix}`;
};
