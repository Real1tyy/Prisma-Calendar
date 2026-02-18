import {
	type FrontmatterDiff,
	extractDisplayName,
	generateZettelId,
	serializeFrontmatterValue,
	withFrontmatter,
} from "@real1ty-obsidian-plugins";
import FuzzySet from "fuzzyset.js";
import { nanoid } from "nanoid";
import { type App, TFile } from "obsidian";
import { INTERNAL_FRONTMATTER_PROPERTIES } from "../constants";
import type { EventStore } from "../core/event-store";
import type { CalendarEvent, Frontmatter, SingleCalendarConfig } from "../types";
import { isTimedEvent } from "../types/calendar";
import { parseIntoList } from "@real1ty-obsidian-plugins";
import { getFileAndFrontmatter, getFileByPathOrThrow } from "./obsidian";

export const isAllDayEvent = (allDayValue: unknown): boolean => {
	return allDayValue === true || (typeof allDayValue === "string" && allDayValue.toLowerCase() === "true");
};

/**
 * Extracts source event information from a virtual event.
 * Returns null if the event is not virtual, has no source file path, or the source event is not found.
 */
export function getSourceEventInfoFromVirtual(
	event: { extendedProps?: { isVirtual?: boolean; filePath?: string } },
	eventStore: EventStore
): {
	title: string;
	start: string;
	end?: string;
	allDay: boolean;
	extendedProps: {
		filePath: string;
		frontmatterDisplayData?: Record<string, unknown>;
	};
} | null {
	const sourceFilePath = event.extendedProps?.filePath;
	if (!sourceFilePath || typeof sourceFilePath !== "string") {
		return null;
	}

	const sourceEvent = eventStore.getEventByPath(sourceFilePath);
	if (!sourceEvent) {
		return null;
	}

	return {
		title: sourceEvent.title,
		start: sourceEvent.start,
		end: isTimedEvent(sourceEvent) ? sourceEvent.end : undefined,
		allDay: sourceEvent.allDay,
		extendedProps: {
			filePath: sourceEvent.ref.filePath,
			frontmatterDisplayData: sourceEvent.meta,
		},
	};
}

/**
 * Strips the milliseconds and Z suffix from an ISO datetime string.
 * Converts "2024-01-15T09:00:00.000Z" to "2024-01-15T09:00:00"
 * This creates cleaner, more sortable datetime values for external tools.
 */
export const stripISOSuffix = (iso: string): string => {
	return iso.replace(/\.000Z$/, "").replace(/Z$/, "");
};

const normalizesTimedEvents = (mode: string): boolean =>
	["startDate", "endDate", "allStartDate", "allEndDate"].includes(mode);

const normalizesAllDayEvents = (mode: string): boolean => ["allDayOnly", "allStartDate", "allEndDate"].includes(mode);

/**
 * Computes the normalized sort date value for an event.
 * Returns the target property name and the expected value, or undefined if sorting doesn't apply.
 */
export const computeSortDateValue = (
	settings: SingleCalendarConfig,
	start: string,
	end?: string,
	allDay?: boolean
): { targetProp: string; value: string } | undefined => {
	const mode = settings.sortingStrategy;
	if (mode === "none") return undefined;

	const targetProp = settings.sortDateProp;
	if (!targetProp) return undefined;

	if (allDay) {
		if (!normalizesAllDayEvents(mode)) return undefined;
		const dateOnly = start.split("T")[0];
		return { targetProp, value: `${dateOnly}T00:00:00` };
	}

	if (!normalizesTimedEvents(mode)) return undefined;

	const value = mode === "startDate" || mode === "allStartDate" ? stripISOSuffix(start) : stripISOSuffix(end || start);
	return { targetProp, value };
};

/**
 * Applies sort date normalization to a file on disk if the value differs from expected.
 * Skips the write when the file already has the correct value.
 */
export const applyDateNormalizationToFile = async (
	app: App,
	filePath: string,
	frontmatter: Frontmatter,
	settings: SingleCalendarConfig,
	start: string,
	end?: string,
	allDay?: boolean
): Promise<void> => {
	const result = computeSortDateValue(settings, start, end, allDay);
	if (!result) return;

	const { targetProp, value } = result;
	if ((frontmatter[targetProp] as string | undefined) === value) return;

	try {
		const file = getFileByPathOrThrow(app, filePath);
		await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
			fm[targetProp] = value;
		});
	} catch (error) {
		console.error(`Error writing sort date to file ${filePath}:`, error);
	}
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
		// TIMED EVENT: Set startProp/endProp
		fm[startProp] = data.start;
		if (data.end) fm[endProp] = data.end;
		fm[dateProp] = "";
	}

	const sortResult = computeSortDateValue(settings, data.start, data.end, data.allDay);
	if (sortResult) fm[sortResult.targetProp] = sortResult.value;

	if (zettelIdProp && data.zettelId) fm[zettelIdProp] = data.zettelId;
};

export const setUntrackedEventBasics = (fm: Frontmatter, settings: SingleCalendarConfig): void => {
	fm[settings.startProp] = "";
	fm[settings.endProp] = "";
	fm[settings.dateProp] = "";
	fm[settings.allDayProp] = "";
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
 * Handles plugin-generated filename patterns:
 * - Regular:            "Title-ZETTELID"              (e.g., Meeting-20250203140530)
 * - Recurring instance: "Title YYYY-MM-DD-ZETTELID"   (e.g., Meeting 2025-02-03-00001125853328)
 * Also supports legacy formats for backwards compatibility:
 * - Space-dash-space:   "Title - ZETTELID"            (e.g., Updated Meeting - 20250203140530)
 * - Space-separated:    "Title ZETTELID"              (e.g., Workout 20250203140530)
 * Returns the ZettelID string if found, null otherwise.
 */
export const extractZettelId = (text: string): string | null => {
	const match = text.match(/[-\s](\d{14})$/);
	return match ? match[1] : null;
};

const parseZettelIdToDate = (zettelId: string): Date | null => {
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
 * Cleans up event title by removing both ZettelID and recurring instance date.
 * Useful for displaying clean titles in tooltips and UI.
 */
export const cleanupTitle = (text: string): string => {
	return removeInstanceDate(removeZettelId(text));
};

/**
 * Gets the event name from the calendar title property, title property, or the filename.
 * Priority: calendarTitleProp (auto-computed wiki link) > titleProp (manual) > filename derived from filePath.
 */
export const getEventName = (
	titleProp: string | undefined,
	frontmatter: Record<string, unknown>,
	filePath: string | null | undefined,
	calendarTitleProp?: string | undefined
): string | undefined => {
	if (calendarTitleProp && frontmatter[calendarTitleProp]) {
		return extractDisplayName(String(frontmatter[calendarTitleProp]));
	}

	if (titleProp && frontmatter[titleProp]) {
		return frontmatter[titleProp] as string;
	}

	if (filePath) {
		const basename = filePath.split("/").pop()?.replace(/\.md$/, "") ?? "";
		return basename ? cleanupTitle(basename) : undefined;
	}

	return undefined;
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

export const isEventDone = (app: App, filePath: string, statusProperty: string, doneValue: string): boolean => {
	try {
		const { frontmatter } = getFileAndFrontmatter(app, filePath);
		const statusValue = frontmatter[statusProperty] as string | undefined;
		return statusValue === doneValue;
	} catch {
		return false;
	}
};

/**
 * Parses a custom done property DSL expression.
 * Format: "propertyName value" (e.g., "archived true", "status completed", "priority 1")
 * Values are auto-parsed: "true"/"false" → boolean, numeric strings → number, rest → string.
 */
export const parseCustomDoneProperty = (expression: string): { key: string; value: unknown } | null => {
	const trimmed = expression.trim();
	if (!trimmed) return null;

	const spaceIndex = trimmed.indexOf(" ");
	if (spaceIndex === -1) return null;

	const key = trimmed.substring(0, spaceIndex).trim();
	const rawValue = trimmed.substring(spaceIndex + 1).trim();

	if (!key || !rawValue) return null;

	if (rawValue === "true") return { key, value: true };
	if (rawValue === "false") return { key, value: false };

	const num = Number(rawValue);
	if (!Number.isNaN(num)) return { key, value: num };

	return { key, value: rawValue };
};

/**
 * Returns a Set of core Prisma-managed internal properties.
 * These are the base properties that Prisma uses for calendar functionality.
 */
const getPrismaInternalProps = (settings: SingleCalendarConfig): Set<string> => {
	return new Set(
		[
			settings.startProp,
			settings.endProp,
			settings.dateProp,
			settings.breakProp,
			settings.titleProp || "",
			settings.calendarTitleProp,
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
			settings.icsSubscriptionProp,
			settings.generatePastEventsProp,
			settings.ignoreRecurringProp,
			settings.locationProp,
			settings.participantsProp,
			settings.iconProp,
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
 * Filters a frontmatter diff to remove excluded properties based on settings.
 * Returns a new diff with only non-excluded properties.
 */
export const filterExcludedPropsFromDiff = (
	diff: FrontmatterDiff,
	settings: SingleCalendarConfig,
	customExcludedProps?: Set<string>
): FrontmatterDiff => {
	const excludedProps = customExcludedProps ?? getRecurringInstanceExcludedProps(settings);

	const filteredAdded = diff.added.filter((change) => !excludedProps.has(change.key));
	const filteredModified = diff.modified.filter((change) => !excludedProps.has(change.key));
	const filteredDeleted = diff.deleted.filter((change) => !excludedProps.has(change.key));

	const hasChanges = filteredAdded.length > 0 || filteredModified.length > 0 || filteredDeleted.length > 0;

	return {
		...diff,
		added: filteredAdded,
		modified: filteredModified,
		deleted: filteredDeleted,
		hasChanges,
	};
};

/**
 * Applies frontmatter changes from a diff to a physical recurring event instance file,
 * filtering out excluded properties based on settings.
 */
export const applyFrontmatterChangesToInstance = async (
	app: App,
	filePath: string,
	sourceFrontmatter: Frontmatter,
	diff: FrontmatterDiff,
	excludedProps: Set<string>
): Promise<void> => {
	try {
		const file = getFileByPathOrThrow(app, filePath);

		await withFrontmatter(app, file, (fm) => {
			for (const change of diff.added) {
				if (!excludedProps.has(change.key)) {
					fm[change.key] = sourceFrontmatter[change.key];
				}
			}

			for (const change of diff.modified) {
				if (!excludedProps.has(change.key)) {
					fm[change.key] = sourceFrontmatter[change.key];
				}
			}

			for (const change of diff.deleted) {
				if (!excludedProps.has(change.key)) {
					delete fm[change.key];
				}
			}
		});
	} catch (error) {
		console.error(`Error applying frontmatter changes to instance ${filePath}:`, error);
	}
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
 * Handles plugin-generated patterns:
 * - Regular:            "Title-ZETTELID"              (e.g., Meeting-20250203140530)
 * - Recurring instance: "Title YYYY-MM-DD-ZETTELID"   (e.g., Meeting 2025-02-03-00001125853328)
 * Also supports legacy formats (CalDAV ` - ` separator, space-separated) for backwards compatibility.
 */
export const hasTimestamp = (baseName: string): boolean => {
	return /[-\s]\d{14}$/.test(baseName);
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
		if (!existingZettelId) {
			throw new Error(
				"Prisma ZettelID not found in basename, but hasTimestamp returned true, this should never happen. Please create an issue."
			);
		}
		const fullPath = `${basePath}${baseName}.md`;
		// If no file exists at this path, use it as-is
		if (!app.vault.getAbstractFileByPath(fullPath)) {
			return { filename: baseName, fullPath, zettelId: existingZettelId };
		}
		// Collision: strip the existing timestamp and generate a new unique one
		const strippedName = removeZettelId(baseName);
		const zettelId = generateUniqueZettelId(app, basePath, strippedName);
		const filename = `${strippedName}-${zettelId}`;
		return { filename, fullPath: `${basePath}${filename}.md`, zettelId };
	}

	const zettelId = generateUniqueZettelId(app, basePath, baseName);
	const filename = `${baseName}-${zettelId}`;
	const fullPath = `${basePath}${filename}.md`;

	return { filename, fullPath, zettelId };
};

// Safe ISO shift (stays ISO even if undefined)
const shiftISO = (iso: unknown, offsetMs?: number) => {
	if (!iso || typeof iso !== "string" || !offsetMs) return iso;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	d.setTime(d.getTime() + offsetMs);
	if (!iso.includes("T")) {
		return d.toISOString().split("T")[0];
	}
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
export const getCommonCategories = (app: App, selectedEvents: CalendarEvent[], categoryProp: string): string[] => {
	if (selectedEvents.length === 0 || !categoryProp) return [];

	const eventCategories: Set<string>[] = [];

	for (const event of selectedEvents) {
		const file = app.vault.getAbstractFileByPath(event.ref.filePath);
		if (!file || !(file instanceof TFile)) continue;

		const cache = app.metadataCache.getFileCache(file);
		const categoryValue = cache?.frontmatter?.[categoryProp] as unknown;

		const categories = new Set<string>(parseIntoList(categoryValue));
		eventCategories.push(categories);
	}

	const firstEventCategories = eventCategories[0];
	const commonCategories = Array.from(firstEventCategories).filter((category) =>
		eventCategories.every((eventCats) => eventCats.has(category))
	);

	return commonCategories;
};

/**
 * Gets frontmatter properties that are common across all selected events with the same value.
 * Excludes internal Prisma properties.
 * Returns a Map of property key to value for properties that have the same value in ALL events.
 */
export const getCommonFrontmatterProperties = (
	app: App,
	selectedEvents: CalendarEvent[],
	settings: SingleCalendarConfig,
	excludedProps?: Set<string>
): Map<string, string> => {
	if (selectedEvents.length === 0) return new Map();

	const internalProperties = excludedProps ?? getInternalProperties(settings);

	const allEventProperties = selectedEvents
		.map((event) => {
			try {
				const { frontmatter } = getFileAndFrontmatter(app, event.ref.filePath);
				return frontmatter;
			} catch {
				return null;
			}
		})
		.filter((fm): fm is Frontmatter => fm !== null && fm !== undefined);

	if (allEventProperties.length === 0) return new Map();

	const firstEventProperties = allEventProperties[0];

	return Object.entries(firstEventProperties).reduce((commonProps, [key, value]) => {
		if (internalProperties.has(key)) return commonProps;

		if (settings.skipUnderscoreProperties && key.startsWith("_")) {
			return commonProps;
		}

		const stringValue = serializeFrontmatterValue(value);

		const allMatch = allEventProperties.every((eventFm) => {
			const eventValue = serializeFrontmatterValue(eventFm[key]);
			return eventValue === stringValue;
		});

		if (allMatch && stringValue.trim() !== "") {
			commonProps.set(key, stringValue);
		}

		return commonProps;
	}, new Map<string, string>());
};

/**
 * Returns a smaller exclusion set for batch frontmatter operations.
 * Only excludes core scheduling properties and Obsidian internals,
 * allowing user-facing properties like location, participants, and icon to be shown.
 */
export const getBatchFrontmatterExcludedProps = (settings: SingleCalendarConfig): Set<string> => {
	return new Set(
		[
			settings.startProp,
			settings.endProp,
			settings.dateProp,
			settings.sortDateProp,
			settings.allDayProp,
			settings.categoryProp,
			settings.calendarTitleProp,
			"position",
		].filter((prop): prop is string => prop !== undefined && prop !== "")
	);
};

/**
 * Gets ALL unique frontmatter properties across any selected event (union).
 * Uses the smaller batch exclusion set so user-facing properties like location,
 * participants, and icon are included.
 * For properties with different values across events, uses an empty string.
 */
export const getAllFrontmatterProperties = (
	app: App,
	selectedEvents: CalendarEvent[],
	settings: SingleCalendarConfig
): Map<string, string> => {
	if (selectedEvents.length === 0) return new Map();

	const excludedProps = getBatchFrontmatterExcludedProps(settings);

	const allEventFrontmatters = selectedEvents
		.map((event) => {
			try {
				const { frontmatter } = getFileAndFrontmatter(app, event.ref.filePath);
				return frontmatter;
			} catch {
				return null;
			}
		})
		.filter((fm): fm is Frontmatter => fm !== null && fm !== undefined);

	if (allEventFrontmatters.length === 0) return new Map();

	const result = new Map<string, string>();

	// Collect all unique keys across all events
	const allKeys = new Set<string>();
	for (const fm of allEventFrontmatters) {
		for (const key of Object.keys(fm)) {
			if (!excludedProps.has(key)) {
				if (settings.skipUnderscoreProperties && key.startsWith("_")) continue;
				allKeys.add(key);
			}
		}
	}

	for (const key of allKeys) {
		// Check if all events that have this key share the same value
		const values: string[] = [];
		for (const fm of allEventFrontmatters) {
			if (key in fm) {
				values.push(serializeFrontmatterValue(fm[key]));
			}
		}

		if (values.length === 0) continue;

		const allSame = values.every((v) => v === values[0]);
		result.set(key, allSame && values[0].trim() !== "" ? values[0] : "");
	}

	return result;
};

export const assignListToFrontmatter = (fm: Frontmatter, prop: string, items: string[]): void => {
	if (items.length === 0) {
		fm[prop] = "";
	} else if (items.length === 1) {
		fm[prop] = items[0];
	} else {
		fm[prop] = items;
	}
};

/**
 * Normalizes an event name for comparison by removing ZettelID, instance dates, and converting to lowercase.
 * Used for category auto-assignment matching.
 *
 * Strips:
 * - Instance date with ZettelID: "Event 2025-01-15-20250103123456" → "Event"
 * - ZettelID with hyphen format: "Event-20250103123456" → "Event"
 * - ZettelID with space format: "Event 20250103123456" → "Event"
 */
export const normalizeEventNameForComparison = (eventName: string): string => {
	return (
		eventName
			// Strip instance date format (YYYY-MM-DD-ZettelID) - must be done BEFORE removeZettelId
			.replace(/\s+\d{4}-\d{2}-\d{2}-\d{14}$/, "")
			.replace(/-\d{14}$/, "")
			.replace(/\s+\d{14}$/, "")
			.toLowerCase()
			.trim()
	);
};

/**
 * Removes properties from frontmatter that should not be cloned/duplicated.
 * These include recurring event metadata and notification status that are specific
 * to the original event and should not carry over to clones.
 */
export const removeNonCloneableProperties = (frontmatter: Frontmatter, settings: SingleCalendarConfig): void => {
	delete frontmatter[settings.rruleIdProp];
	delete frontmatter[settings.instanceDateProp];
	delete frontmatter[settings.sourceProp];
	delete frontmatter[settings.alreadyNotifiedProp];
};

/**
 * Auto-assigns categories to an event based on its name.
 * Applies both name-matching rules (when event name matches category name)
 * and custom category assignment presets.
 *
 * Called once when the event creation modal opens, before any user interaction.
 *
 * @param eventName - The event name (may contain ZettelID)
 * @param settings - Calendar settings with auto-assignment configuration
 * @param availableCategories - List of all available categories
 * @returns List of auto-assigned categories (deduplicated)
 */
export const autoAssignCategories = (
	eventName: string,
	settings: SingleCalendarConfig,
	availableCategories: string[]
): string[] => {
	const normalizedEventName = normalizeEventNameForComparison(eventName);
	const categoriesToAssign = new Set<string>();
	const normalizeForComparison = (name: string): string => name.toLowerCase().trim();

	// Rule 1: Auto-assign when event name matches category name (case-insensitive)
	if (settings.autoAssignCategoryByName) {
		for (const category of availableCategories) {
			if (normalizedEventName === normalizeForComparison(category)) {
				categoriesToAssign.add(category);
			}
		}
	}

	// Rule 2: Apply custom category assignment presets (supports comma-separated event names)
	if (settings.categoryAssignmentPresets && settings.categoryAssignmentPresets.length > 0) {
		for (const preset of settings.categoryAssignmentPresets) {
			const presetEventNames = preset.eventName
				.split(",")
				.map((name) => normalizeForComparison(name.trim()))
				.filter((name) => name.length > 0);

			if (presetEventNames.includes(normalizedEventName)) {
				for (const category of preset.categories) {
					categoriesToAssign.add(category);
				}
			}
		}
	}

	return Array.from(categoriesToAssign);
};

export interface FuzzyNameMatch {
	suggestion: string;
	score: number;
}

/**
 * Finds fuzzy matches for an event name against known category names, preset event names,
 * and existing name-series keys. Used for typo detection in event titles.
 *
 * Returns up to `maxResults` suggestions where:
 * - The match score is >= 0.7 (close enough to be a likely typo)
 * - The match score is < 1.0 (not an exact match, which is already handled)
 *
 * @param eventName - The event name to check for typos
 * @param settings - Calendar settings with category assignment presets
 * @param availableCategories - List of all available categories
 * @param existingNameKeys - Known name keys from the name-series tracker (lowercase)
 * @param maxResults - Maximum number of suggestions to return (default: 3)
 * @returns An array of suggestions sorted by score (best first), or null if no matches
 */
export const findFuzzyNameMatch = (
	eventName: string,
	settings: SingleCalendarConfig,
	availableCategories: string[],
	existingNameKeys: string[],
	maxResults = 3
): FuzzyNameMatch[] | null => {
	const normalizedInput = normalizeEventNameForComparison(eventName);
	if (!normalizedInput) return null;

	// Build a combined set of known names (using original casing where possible)
	const knownNames = new Map<string, string>(); // lowercase -> original casing

	for (const category of availableCategories) {
		knownNames.set(category.toLowerCase().trim(), category);
	}

	if (settings.categoryAssignmentPresets) {
		for (const preset of settings.categoryAssignmentPresets) {
			const names = preset.eventName
				.split(",")
				.map((n) => n.trim())
				.filter((n) => n.length > 0);
			for (const name of names) {
				knownNames.set(name.toLowerCase(), name);
			}
		}
	}

	for (const nameKey of existingNameKeys) {
		if (!knownNames.has(nameKey)) {
			knownNames.set(nameKey, nameKey);
		}
	}

	const allKeys = Array.from(knownNames.keys());
	if (allKeys.length === 0) return null;

	const fuzzySet = FuzzySet(allKeys);
	const results = fuzzySet.get(normalizedInput);

	if (!results || results.length === 0) return null;

	const matches: FuzzyNameMatch[] = [];
	for (const [score, match] of results) {
		if (score >= 0.7 && score < 1.0) {
			const originalCasing = knownNames.get(match) ?? match;
			matches.push({ suggestion: originalCasing, score });
		}
		if (matches.length >= maxResults) break;
	}

	return matches.length > 0 ? matches : null;
};
