import { generateZettelId } from "@real1ty-obsidian-plugins/utils";
import { nanoid } from "nanoid";
import type { App, TFile } from "obsidian";
import type { SingleCalendarConfig } from "../types";
import { withFrontmatter } from "./obsidian";

export const isAllDayEvent = (allDayValue: unknown): boolean => {
	return allDayValue === true || (typeof allDayValue === "string" && allDayValue.toLowerCase() === "true");
};

export const applyStartEndOffsets = (
	fm: Record<string, unknown>,
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
	fm: Record<string, unknown>,
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

	if (data.allDay) {
		// ALL-DAY EVENT: Use dateProp, clear startProp/endProp
		const dateOnly = data.start.split("T")[0];
		fm[dateProp] = dateOnly;
		delete fm[startProp];
		delete fm[endProp];
	} else {
		// TIMED EVENT: Use startProp/endProp, clear dateProp
		fm[startProp] = data.start;
		if (data.end) fm[endProp] = data.end;
		delete fm[dateProp];
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
