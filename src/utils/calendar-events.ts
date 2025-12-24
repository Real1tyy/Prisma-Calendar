import { generateZettelId, withFrontmatter } from "@real1ty-obsidian-plugins/utils";
import { nanoid } from "nanoid";
import { type App, TFile } from "obsidian";
import { INTERNAL_FRONTMATTER_PROPERTIES } from "../constants";
import type { EventStore } from "../core/event-store";
import type { Frontmatter, SingleCalendarConfig } from "../types";
import { parseIntoList } from "./list-utils";

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

export const parseZettelIdToDate = (zettelId: string): Date | null => {
	if (!/^\d{14}$/.test(zettelId)) {
		return null;
	}

	const year = Number.parseInt(zettelId.substring(0, 4), 10);
	const month = Number.parseInt(zettelId.substring(4, 6), 10) - 1;
	const day = Number.parseInt(zettelId.substring(6, 8), 10);
	const hour = Number.parseInt(zettelId.substring(8, 10), 10);
	const minute = Number.parseInt(zettelId.substring(10, 12), 10);
	const second = Number.parseInt(zettelId.substring(12, 14), 10);

	const date = new Date(year, month, day, hour, minute, second);

	if (Number.isNaN(date.getTime())) {
		return null;
	}

	return date;
};

export const isEventNewlyCreated = (zettelId: string | null | undefined): boolean => {
	if (!zettelId) {
		return false;
	}

	const creationDate = parseZettelIdToDate(zettelId);
	if (!creationDate) {
		return false;
	}

	const now = new Date();
	const oneMinuteAgo = new Date(now.getTime() - 60000);

	return creationDate > oneMinuteAgo;
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
 * Checks if an event is a source recurring event (has rrule property with a value).
 * A source recurring event is identified by having the RRule property set in frontmatter.
 */
export const isSourceRecurringEvent = (frontmatter: Frontmatter | undefined, rruleProp: string): boolean => {
	if (!frontmatter) return false;
	const rruleValue = frontmatter[rruleProp];
	return rruleValue !== undefined && rruleValue !== null && rruleValue !== "";
};

export const isEventDone = (app: App, filePath: string, statusProperty: string, doneValue: string): boolean => {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) {
		return false;
	}

	const metadata = app.metadataCache.getFileCache(file);
	const statusValue = metadata?.frontmatter?.[statusProperty] as string | undefined;
	return statusValue === doneValue;
};

/**
 * Returns a Set of core Prisma-managed internal properties.
 * These are the base properties that Prisma uses for calendar functionality.
 */
export const getPrismaInternalProps = (settings: SingleCalendarConfig): Set<string> => {
	return new Set(
		[
			settings.startProp,
			settings.endProp,
			settings.dateProp,
			settings.breakProp,
			settings.titleProp || "",
			settings.allDayProp,
			settings.rruleProp,
			settings.rruleSpecProp,
			settings.rruleIdProp,
			settings.sourceProp,
			settings.skipProp,
			settings.instanceDateProp,
			settings.zettelIdProp || "",
			settings.futureInstancesCountProp,
			settings.alreadyNotifiedProp,
			settings.caldavProp,
			settings.generatePastEventsProp,
			settings.ignoreRecurringProp,
		].filter((prop) => prop !== "")
	);
};

/**
 * Returns a Set of internal properties that should not be displayed in UI.
 * Includes calendar-specific property names and global internal properties.
 * Uses getPrismaInternalProps as the base and adds additional internal-only properties.
 */
export function getInternalProperties(settings: SingleCalendarConfig): Set<string> {
	const prismaInternalProps = getPrismaInternalProps(settings);
	const additionalInternalProps = [
		settings.statusProperty,
		settings.categoryProp,
		settings.minutesBeforeProp,
		settings.daysBeforeProp,
		...INTERNAL_FRONTMATTER_PROPERTIES,
	].filter((prop): prop is string => prop !== undefined && prop !== "");

	return new Set([...prismaInternalProps, ...additionalInternalProps]);
}

/**
 * Returns a Set of frontmatter properties that should be excluded when creating
 * physical recurring event instances from a source event.
 * This includes Prisma-managed properties plus additional properties that shouldn't
 * be copied to instances (like notification status and archived state).
 */
export const getRecurringInstanceExcludedProps = (settings: SingleCalendarConfig): Set<string> => {
	const prismaInternalProps = getPrismaInternalProps(settings);

	if (settings.excludedRecurringPropagatedProps) {
		const userExcludedProps = settings.excludedRecurringPropagatedProps
			.split(",")
			.map((prop) => prop.trim())
			.filter((prop) => prop !== "");
		return new Set([...prismaInternalProps, ...userExcludedProps]);
	}
	return prismaInternalProps;
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
 * Checks if a basename already has a Prisma ZettelID timestamp.
 * Only recognizes Prisma's native format: -YYYYMMDDHHmmss (14 digits)
 * Returns true if the basename ends with this pattern.
 */
export const hasTimestamp = (baseName: string): boolean => {
	// Only check for Prisma's native 14-digit ZettelID format
	return /-\d{14}$/.test(baseName);
};

/**
 * Generates a unique file path with ZettelID for event files.
 * If the basename already contains a Prisma ZettelID, uses it as-is without adding a new one.
 * Returns both the filename and full path with a guaranteed unique ZettelID.
 */
export const generateUniqueEventPath = (
	app: App,
	directory: string,
	baseName: string
): { filename: string; fullPath: string; zettelId: string } => {
	const basePath = directory ? `${directory.replace(/\/+$/, "")}/` : "";

	if (hasTimestamp(baseName)) {
		const existingZettelId = extractZettelId(baseName);
		const filename = baseName;
		const fullPath = `${basePath}${filename}.md`;
		if (!existingZettelId) {
			throw new Error(
				"Prisma ZettelID not found in basename, but hasTimestamp returned true, this should never happen. Please create an issue."
			);
		}
		const zettelId = existingZettelId;
		return { filename, fullPath, zettelId };
	}

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

export const findAdjacentEvent = (
	eventStore: EventStore,
	currentStart: string | Date | null,
	currentFilePath: string | null | undefined,
	direction: "next" | "previous"
) => {
	const searchTime = new Date(currentStart || "").toISOString();
	const excludeFilePath = currentFilePath || undefined;

	return direction === "next"
		? eventStore.findNextEventByStartTime(searchTime, excludeFilePath)
		: eventStore.findPreviousEventByEndTime(searchTime, excludeFilePath);
};

/**
 * Gets categories that are common across all selected events.
 * Returns an array of category names that exist in ALL events.
 */
export const getCommonCategories = (
	app: App,
	selectedEvents: { filePath: string }[],
	categoryProp: string
): string[] => {
	if (selectedEvents.length === 0 || !categoryProp) return [];

	const eventCategories: Set<string>[] = [];

	for (const event of selectedEvents) {
		const file = app.vault.getAbstractFileByPath(event.filePath);
		if (!file || !(file instanceof TFile)) continue;

		const cache = app.metadataCache.getFileCache(file);
		const categoryValue = cache?.frontmatter?.[categoryProp] as unknown;

		const categories = new Set(parseIntoList(categoryValue));
		eventCategories.push(categories);
	}

	const firstEventCategories = eventCategories[0];
	const commonCategories = Array.from(firstEventCategories).filter((category) =>
		eventCategories.every((eventCats) => eventCats.has(category))
	);

	return commonCategories;
};
export const assignCategoriesToFrontmatter = (fm: Frontmatter, categoryProp: string, categories: string[]): void => {
	if (categories.length === 0) {
		fm[categoryProp] = "";
	} else if (categories.length === 1) {
		fm[categoryProp] = categories[0];
	} else {
		fm[categoryProp] = categories;
	}
};
