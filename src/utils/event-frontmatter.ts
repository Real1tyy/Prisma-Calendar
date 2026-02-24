import {
	type FrontmatterDiff,
	serializeFrontmatterValue,
	withFrontmatter,
	parseIntoList,
} from "@real1ty-obsidian-plugins";
import { type App, TFile } from "obsidian";
import { INTERNAL_FRONTMATTER_PROPERTIES } from "../constants";
import type { CalendarEvent, Frontmatter, SingleCalendarConfig } from "../types";
import { isTimedEvent } from "../types/calendar";
import { getFileAndFrontmatter, getFileByPathOrThrow } from "./obsidian";

export const isAllDayEvent = (allDayValue: unknown): boolean => {
	return allDayValue === true || (typeof allDayValue === "string" && allDayValue.toLowerCase() === "true");
};

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
		console.error(`[CalendarEvents] Error writing sort date to file ${filePath}:`, error);
	}
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
		console.error(`[CalendarEvents] Error applying frontmatter changes to instance ${filePath}:`, error);
	}
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
