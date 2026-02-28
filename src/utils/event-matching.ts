import FuzzySet from "fuzzyset.js";
import type { EventStore } from "../core/event-store";
import type { CalendarEvent, SingleCalendarConfig } from "../types";
import { isTimedEvent } from "../types/calendar";

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

/** Minimum number of events in a name series for it to be considered established */
const ESTABLISHED_NAME_SERIES_THRESHOLD = 5;

/**
 * Finds fuzzy matches for an event name against known category names, preset event names,
 * and existing name-series keys. Used for typo detection in event titles.
 *
 * Returns up to `maxResults` suggestions where:
 * - The match score is >= 0.7 (close enough to be a likely typo)
 * - The match score is < 1.0 (not an exact match, which is already handled)
 *
 * Skips fuzzy matching entirely when:
 * - The event name exactly matches a category, preset event name, or existing name key
 * - The event name belongs to an established name series (5+ events)
 *
 * @param eventName - The event name to check for typos
 * @param settings - Calendar settings with category assignment presets
 * @param availableCategories - List of all available categories
 * @param nameSeriesMap - Read-only view of the name-series tracker (lowercase name key -> file paths)
 * @param maxResults - Maximum number of suggestions to return (default: 3)
 * @returns An array of suggestions sorted by score (best first), or null if no matches
 */
export const findFuzzyNameMatch = (
	eventName: string,
	settings: SingleCalendarConfig,
	availableCategories: string[],
	nameSeriesMap: ReadonlyMap<string, ReadonlySet<string>>,
	maxResults = 3
): FuzzyNameMatch[] | null => {
	const normalizedInput = normalizeEventNameForComparison(eventName);
	if (!normalizedInput) return null;

	// Skip fuzzy matching if the event name belongs to an established name series
	const nameSeries = nameSeriesMap.get(normalizedInput);
	if (nameSeries && nameSeries.size >= ESTABLISHED_NAME_SERIES_THRESHOLD) return null;

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

	for (const nameKey of nameSeriesMap.keys()) {
		if (!knownNames.has(nameKey)) {
			knownNames.set(nameKey, nameKey);
		}
	}

	const allKeys = Array.from(knownNames.keys());
	if (allKeys.length === 0) return null;

	// Skip fuzzy matching if the event name exactly matches a known name
	if (allKeys.includes(normalizedInput)) return null;

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
