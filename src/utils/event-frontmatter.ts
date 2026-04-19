import {
	type FrontmatterDiff,
	parseIntoList,
	serializeFrontmatterValue,
	withFrontmatter,
} from "@real1ty-obsidian-plugins";
import { type App, TFile } from "obsidian";

import type { CalendarEvent, Frontmatter, SingleCalendarConfig } from "../types";
import { computeSortDateValue } from "./frontmatter/basics";
import { getBatchFrontmatterExcludedProps } from "./frontmatter/props";
import { getFileAndFrontmatter, getFileByPathOrThrow } from "./obsidian";

// ─── Side-effectful vault operations ────────────────────────────────

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

	if (!result) {
		if (!settings.sortDateProp || !(settings.sortDateProp in frontmatter)) return;
		try {
			const file = getFileByPathOrThrow(app, filePath);
			await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
				delete fm[settings.sortDateProp];
			});
		} catch (error) {
			console.error(`[CalendarEvents] Error clearing sort date on file ${filePath}:`, error);
		}
		return;
	}

	const { targetProp, value } = result;
	if (String(frontmatter[targetProp] ?? "") === value) return;

	try {
		const file = getFileByPathOrThrow(app, filePath);
		await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
			fm[targetProp] = value;
		});
	} catch (error) {
		console.error(`[CalendarEvents] Error writing sort date to file ${filePath}:`, error);
	}
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

	if (eventCategories.length === 0) return [];

	const firstEventCategories = eventCategories[0];
	const commonCategories = Array.from(firstEventCategories).filter((category) =>
		eventCategories.every((eventCats) => eventCats.has(category))
	);

	return commonCategories;
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
