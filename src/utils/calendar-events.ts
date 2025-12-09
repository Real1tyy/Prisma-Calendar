import { generateZettelId, withFrontmatter } from "@real1ty-obsidian-plugins/utils";
import { nanoid } from "nanoid";
import type { App, TFile } from "obsidian";
import type { EventStore } from "../core/event-store";
import type { Frontmatter, SingleCalendarConfig } from "../types";

export const isAllDayEvent = (allDayValue: unknown): boolean => {
	return allDayValue === true || (typeof allDayValue === "string" && allDayValue.toLowerCase() === "true");
};

export const applyStartEndOffsets = (
	fm: Frontmatter,
	settings: SingleCalendarConfig,
	startOffset?: number,
	endOffset?: number
) => {
	const { startProp, endProp, dateProp, allDayProp } = settings;

	if (isAllDayEvent(fm[allDayProp])) {
		// ALL-DAY EVENT: Only shift the date property
		if (fm[dateProp]) {
			fm[dateProp] = shiftISO(fm[dateProp], startOffset);
		}
	} else {
		// TIMED EVENT: Shift start and end properties
		if (fm[startProp]) fm[startProp] = shiftISO(fm[startProp], startOffset);
		if (fm[endProp]) fm[endProp] = shiftISO(fm[endProp], endOffset);
	}
};

export const setEventBasics = (
	fm: Frontmatter,
	settings: SingleCalendarConfig,
	data: {
		title?: string;
		start: string;
		end?: string;
		allDay?: boolean;
		zettelId?: number;
	}
) => {
	const { titleProp, startProp, endProp, dateProp, allDayProp, zettelIdProp } = settings;

	if (titleProp && data.title) fm[titleProp] = data.title;

	if (data.allDay !== undefined) fm[allDayProp] = data.allDay;

	const dateOnly = data.start.split("T")[0];

	if (data.allDay) {
		fm[dateProp] = dateOnly;
		fm[startProp] = "";
		fm[endProp] = "";
	} else {
		// TIMED EVENT: Set startProp/endProp, keep dateProp as empty string
		fm[startProp] = data.start;
		if (data.end) fm[endProp] = data.end;
		fm[dateProp] = "";
	}

	if (zettelIdProp && data.zettelId) fm[zettelIdProp] = data.zettelId;
};

export const generateUniqueRruleId = (): string => {
	return `${Date.now()}-${nanoid(5)}`;
};

/**
 * Converts an rRuleId into a deterministic 14-digit number for use as a zettel ID suffix.
 * This ensures physical instances have stable, predictable filenames based on (rRuleId, date).
 */
export const hashRRuleIdToZettelFormat = (rRuleId: string): string => {
	let hash = 0;
	for (let i = 0; i < rRuleId.length; i++) {
		const char = rRuleId.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}

	// Ensure positive number and pad to 14 digits
	const positiveHash = Math.abs(hash);
	// Take modulo to ensure it fits in 14 digits, then pad
	const normalized = positiveHash % 100000000000000; // Max 14-digit number
	return normalized.toString().padStart(14, "0");
};

/**
 * Extracts ZettelID from a filename or title.
 * Returns the ZettelID string if found, null otherwise.
 */
export const extractZettelId = (text: string): string | null => {
	const match = text.match(/-(\d{14})$/);
	return match ? match[1] : null;
};

export const removeZettelId = (text: string): string => {
	return (
		text
			// Strip Zettel ID format with hyphen (14 digits)
			.replace(/-\d{14}$/, "")
			// Strip space-separated Zettel ID (14 digits)
			.replace(/\s+\d{14}$/, "")
			.trim()
	);
};

/**
 * Removes the instance date from recurring event titles.
 * Pattern: "Name YYYY-MM-DD" -> "Name"
 * This is used on mobile to save space.
 */
export const removeInstanceDate = (text: string): string => {
	return (
		text
			// Strip date format at the end (YYYY-MM-DD)
			.replace(/\s+\d{4}-\d{2}-\d{2}$/, "")
			.trim()
	);
};

/**
 * Rebuilds a physical recurring instance filename with a new date.
 * Format: "Title YYYY-MM-DD-ZETTELID" -> "Title NEW-DATE-ZETTELID"
 *
 * @param basename - Current filename without extension (e.g., "Meeting 2025-01-15-12345678901234")
 * @param newDate - New date string in YYYY-MM-DD format
 * @returns New basename or null if the format is not recognized
 */
export const rebuildPhysicalInstanceWithNewDate = (basename: string, newDate: string): string | null => {
	// Pattern: "Title YYYY-MM-DD-ZETTELID" where ZETTELID is 14 digits
	const match = basename.match(/^(.+)\s+(\d{4}-\d{2}-\d{2})-(\d{14})$/);
	if (!match) return null;

	const [, title, , zettelId] = match;
	return `${title} ${newDate}-${zettelId}`;
};

/**
 * Checks if a physical recurring event file should have its instance date updated on move.
 * Only events with ignoreRecurring = true should have their instance date updated.
 */
export const shouldUpdateInstanceDateOnMove = (
	frontmatter: Frontmatter | undefined,
	ignoreRecurringProp: string
): boolean => {
	if (!frontmatter) return false;
	return frontmatter[ignoreRecurringProp] === true;
};

/**
 * Checks if an event is a physical recurring event (has rruleId and instanceDate, but no rrule).
 */
export const isPhysicalRecurringEvent = (
	frontmatter: Frontmatter | undefined,
	rruleIdProp: string,
	rruleProp: string,
	instanceDateProp: string
): boolean => {
	if (!frontmatter) return false;
	return Boolean(frontmatter[rruleIdProp] && frontmatter[instanceDateProp] && !frontmatter[rruleProp]);
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
	return (
		text
			// Strip Zettel ID format with hyphen (14 digits)
			.replace(/-\d{14}$/, "")
			// Strip space-separated Zettel ID (14 digits)
			.replace(/\s+\d{14}$/, "")
			// Strip ISO date formats with dash separator " - YYYY-MM-DD"
			.replace(/\s+-\s+\d{4}-\d{2}-\d{2}.*$/, "")
			// Strip ISO date formats at the end " YYYY-MM-DD"
			.replace(/\s+\d{4}-\d{2}-\d{2}$/, "")
			// Strip kebab-case date suffix "-YYYY-MM-DD"
			.replace(/-\d{4}-\d{2}-\d{2}$/, "")
			// Strip day abbreviations (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
			.replace(/\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/i, "")
			// Strip full day names (Monday, Tuesday, etc.)
			.replace(/\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i, "")
			// Strip trailing timestamps (8+ digits)
			.replace(/\s+\d{8,}$/, "")
			.trim()
	);
};

/**
 * Ensures a file has a ZettelID embedded in both its filename and frontmatter.
 * If the file already has a ZettelID, returns it. If not, generates one and embeds it.
 * Returns the ZettelID and the potentially updated file path.
 */
export const ensureFileHasZettelId = async (
	app: App,
	file: TFile,
	zettelIdProp?: string
): Promise<{ zettelId: string; file: TFile }> => {
	const existingZettelId = extractZettelId(file.basename);

	if (existingZettelId) {
		// File already has ZettelID, just ensure it's in frontmatter
		if (zettelIdProp) {
			await withFrontmatter(app, file, (fm) => {
				if (!fm[zettelIdProp]) {
					fm[zettelIdProp] = existingZettelId;
				}
			});
		}
		return { zettelId: existingZettelId, file };
	}

	// File doesn't have ZettelID, we need to add it
	const baseNameWithoutZettel = file.basename;
	const directory = file.parent?.path || "";
	const { fullPath, zettelId } = generateUniqueEventPath(app, directory, baseNameWithoutZettel);

	await app.fileManager.renameFile(file, fullPath);

	// Update frontmatter with ZettelID
	if (zettelIdProp) {
		await withFrontmatter(app, file, (fm) => {
			fm[zettelIdProp] = zettelId;
		});
	}

	return { zettelId, file };
};

/**
 * Generates a unique ZettelID by checking if the resulting path already exists.
 * If it does, increments the ID until an unused one is found.
 */
export const generateUniqueZettelId = (app: App, basePath: string, baseNameWithoutZettel: string): string => {
	let zettelIdStr = String(generateZettelId());
	let attempts = 0;
	const maxAttempts = 1000;

	while (attempts < maxAttempts) {
		const testPath = `${basePath}${baseNameWithoutZettel}-${zettelIdStr}.md`;
		const existing = app.vault.getAbstractFileByPath(testPath);

		if (!existing) {
			return zettelIdStr;
		}

		// Increment the zettelId (it's a 14-digit number as a string)
		const numericId = Number.parseInt(zettelIdStr, 10);
		const incrementedId = numericId + 1;
		zettelIdStr = incrementedId.toString().padStart(14, "0");
		attempts++;
	}

	// Fallback: use timestamp with random suffix
	return `${String(generateZettelId())}${Math.floor(Math.random() * 1000)}`;
};

/**
 * Generates a unique file path with ZettelID for event files.
 * Returns both the filename and full path with a guaranteed unique ZettelID.
 */
export const generateUniqueEventPath = (
	app: App,
	directory: string,
	baseName: string
): { filename: string; fullPath: string; zettelId: string } => {
	const basePath = directory ? `${directory.replace(/\/+$/, "")}/` : "";
	const zettelId = generateUniqueZettelId(app, basePath, baseName);
	const filename = `${baseName}-${zettelId}`;
	const fullPath = `${basePath}${filename}.md`;

	return { filename, fullPath, zettelId };
};

// Safe ISO shift (stays ISO even if undefined)
export const shiftISO = (iso: unknown, offsetMs?: number) => {
	if (!iso || typeof iso !== "string" || !offsetMs) return iso;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	d.setTime(d.getTime() + offsetMs);
	return d.toISOString();
};

export interface AdjacentEvent {
	title: string;
	start: string;
	end?: string;
	allDay: boolean;
	filePath: string;
}

export const findAdjacentEvent = (
	eventStore: EventStore,
	currentStart: string | Date | null,
	currentFilePath: string | null | undefined,
	direction: "next" | "previous",
	skipValueIfSame: string
): AdjacentEvent | null => {
	const DAY_RANGE = 1;
	const currentStartTime = new Date(currentStart || "").getTime();
	const skipTimeISO = skipValueIfSame ? new Date(skipValueIfSame).toISOString() : undefined;

	const searchStart = new Date(currentStartTime);
	searchStart.setDate(searchStart.getDate() - DAY_RANGE);
	const searchEnd = new Date(currentStartTime);
	searchEnd.setDate(searchEnd.getDate() + DAY_RANGE);

	const allEvents = eventStore.getNonSkippedEvents({
		start: searchStart.toISOString(),
		end: searchEnd.toISOString(),
	});

	const currentIndex = allEvents.findIndex((e) => e.ref.filePath === currentFilePath);
	if (currentIndex === -1) return null;

	// Determine iteration range and step based on direction
	const startIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
	const endIndex = direction === "next" ? allEvents.length : -1;
	const step = direction === "next" ? 1 : -1;

	for (let i = startIndex; i !== endIndex; i += step) {
		const e = allEvents[i];
		const eventStartISO = new Date(e.start).toISOString();
		const eventEndISO = e.end ? new Date(e.end).toISOString() : null;

		if (e.allDay) continue;
		if (direction === "previous" && !e.end) continue;

		const timeToCheck = direction === "next" ? eventStartISO : eventEndISO;
		if (skipTimeISO && timeToCheck === skipTimeISO) continue;

		return {
			title: e.title,
			start: e.start,
			end: e.end,
			allDay: e.allDay,
			filePath: e.ref.filePath,
		};
	}

	return null;
};
