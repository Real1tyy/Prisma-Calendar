import { extractDisplayName } from "@real1ty-obsidian-plugins";

import { removeZettelId } from "./zettel-id";

/**
 * Removes the instance date from recurring event titles.
 * Pattern: "Name YYYY-MM-DD" -> "Name"
 * This is used on mobile to save space.
 */
export const removeInstanceDate = (text: string): string => {
	return text.replace(/\s+\d{4}-\d{2}-\d{2}$/, "").trim();
};

/**
 * Cleans up event title by removing both ZettelID and recurring instance date.
 * Useful for displaying clean titles in tooltips and UI.
 */
export const cleanupTitle = (text: string): string => {
	return removeInstanceDate(removeZettelId(text));
};

/**
 * Extracts a display name from a file path or wiki link and cleans it up
 * by removing ZettelID and recurring instance date suffixes.
 */
export const extractCleanDisplayName = (pathOrLink: string): string => {
	return cleanupTitle(extractDisplayName(pathOrLink));
};

/**
 * Gets the event name from the title property, calendar title property, or the filename.
 * Priority: titleProp (manual) > calendarTitleProp (auto-computed wiki link) > filename derived from filePath.
 */
export const getEventName = (
	titleProp: string | undefined,
	frontmatter: Record<string, unknown>,
	filePath: string | null | undefined,
	calendarTitleProp?: string
): string | undefined => {
	if (titleProp && frontmatter[titleProp]) {
		return frontmatter[titleProp] as string;
	}

	if (calendarTitleProp && frontmatter[calendarTitleProp]) {
		return extractDisplayName(String(frontmatter[calendarTitleProp]));
	}

	if (filePath) {
		const basename = filePath.split("/").pop()?.replace(/\.md$/, "") ?? "";
		return basename ? cleanupTitle(basename) : undefined;
	}

	return undefined;
};

/**
 * Extracts the core name from a note title by removing timestamps, dates, and day suffixes.
 * This groups related events together by their base name for aggregation and display.
 *
 * Handles multiple formats:
 * - Zettel ID format (14 digits): "Event-20250203140530" -> "Event"
 * - Space-separated timestamps: "Event 20250203140530" -> "Event"
 * - ISO date formats: "Event - 2025-02-03" -> "Event"
 * - ISO date suffix: "Go To The Gym 2025-10-29" -> "Go To The Gym"
 * - Kebab-case date suffix: "mid-sprint-sync-2025-10-28" -> "mid-sprint-sync"
 * - Day names: "Thai Box Tue" -> "Thai Box", "Meeting Monday" -> "Meeting"
 * - Trailing timestamps: "Event 123456789" -> "Event"
 */
export const extractNotesCoreName = (text: string): string => {
	return text
		.replace(/-\d{14}$/, "")
		.replace(/\s+\d{14}$/, "")
		.replace(/\s+-\s+\d{4}-\d{2}-\d{2}.*$/, "")
		.replace(/\s+\d{4}-\d{2}-\d{2}$/, "")
		.replace(/-\d{4}-\d{2}-\d{2}$/, "")
		.replace(/\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/i, "")
		.replace(/\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i, "")
		.replace(/\s+\d{8,}$/, "")
		.trim();
};
