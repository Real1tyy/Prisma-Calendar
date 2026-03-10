import type { CalendarEvent, SingleCalendarConfig } from "../types";
import { isTimedEvent } from "../types/calendar";

interface EventLookup {
	getEventByPath(path: string): CalendarEvent | null;
	findNextEventByStartTime(searchTime: string, excludeFilePath?: string): CalendarEvent | null;
	findPreviousEventByEndTime(searchTime: string, excludeFilePath?: string): CalendarEvent | null;
}

/**
 * Extracts source event information from a virtual event.
 * Returns null if the event is not virtual, has no source file path, or the source event is not found.
 */
export function getSourceEventInfoFromVirtual(
	event: { extendedProps?: { isVirtual?: boolean; filePath?: string } },
	eventStore: EventLookup
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
	eventStore: EventLookup,
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
	availableCategories: string[],
	isProEnabled = false
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

	// Rule 2: Apply custom category assignment presets (Pro only)
	if (isProEnabled && settings.categoryAssignmentPresets && settings.categoryAssignmentPresets.length > 0) {
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
