import { toLocalISOString } from "@real1ty-obsidian-plugins";

import type { CalendarEvent, SingleCalendarConfig } from "../types";
import { isTimedEvent } from "../types/calendar";

interface EventLookup {
	getEventByPath(path: string): CalendarEvent | null;
	findNextEventByStartTime(searchTime: string, excludeFilePath?: string): CalendarEvent | null;
	findPreviousEventByEndTime(searchTime: string, excludeFilePath?: string): CalendarEvent | null;
}

export interface SourceEventInfo {
	title: string;
	start: string;
	end?: string;
	allDay: boolean;
	extendedProps: {
		filePath: string;
		frontmatterDisplayData?: Record<string, unknown>;
	};
}

export function getSourceEventInfoFromVirtual(
	event: { extendedProps?: { virtualKind?: string; filePath?: string } },
	eventStore: EventLookup
): SourceEventInfo | null {
	const sourceFilePath = event.extendedProps?.filePath;
	if (!sourceFilePath || typeof sourceFilePath !== "string") {
		return null;
	}

	const sourceEvent = eventStore.getEventByPath(sourceFilePath);
	if (!sourceEvent) {
		return null;
	}

	const result: SourceEventInfo = {
		title: sourceEvent.title,
		start: sourceEvent.start,
		allDay: sourceEvent.allDay,
		extendedProps: {
			filePath: sourceEvent.ref.filePath,
		},
	};

	if (isTimedEvent(sourceEvent)) {
		result.end = sourceEvent.end;
	}

	if (sourceEvent.meta) {
		result.extendedProps.frontmatterDisplayData = sourceEvent.meta;
	}

	return result;
}

export const findAdjacentEvent = (
	eventStore: EventLookup,
	currentStart: string | Date | null,
	currentFilePath: string | null | undefined,
	direction: "next" | "previous"
) => {
	const searchTime = currentStart instanceof Date ? toLocalISOString(currentStart) : currentStart || "";
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
	availableCategories: string[],
	isProEnabled = false
): string[] => {
	const normalizedEventName = normalizeEventNameForComparison(eventName);
	const categoriesToAssign = new Set<string>();
	const normalizeForComparison = (name: string): string => name.toLowerCase().trim();

	// Custom category assignment presets take precedence (Pro only).
	// When any preset matches, skip the name/substring category matching below.
	if (isProEnabled && settings.categoryAssignmentPresets && settings.categoryAssignmentPresets.length > 0) {
		const useSubstring = settings.autoAssignCategoryByIncludes;
		let presetMatched = false;
		for (const preset of settings.categoryAssignmentPresets) {
			const presetEventNames = preset.eventName
				.split(",")
				.map((name) => normalizeForComparison(name.trim()))
				.filter((name) => name.length > 0);

			const matches = useSubstring
				? presetEventNames.some((name) => normalizedEventName.includes(name))
				: presetEventNames.includes(normalizedEventName);

			if (matches) {
				presetMatched = true;
				for (const category of preset.categories) {
					categoriesToAssign.add(category);
				}
			}
		}
		if (presetMatched) {
			return Array.from(categoriesToAssign);
		}
	}

	if (settings.autoAssignCategoryByName) {
		for (const category of availableCategories) {
			if (normalizedEventName === normalizeForComparison(category)) {
				categoriesToAssign.add(category);
			}
		}
	}

	if (settings.autoAssignCategoryByIncludes) {
		for (const category of availableCategories) {
			if (normalizedEventName.includes(normalizeForComparison(category))) {
				categoriesToAssign.add(category);
			}
		}
	}

	return Array.from(categoriesToAssign);
};
