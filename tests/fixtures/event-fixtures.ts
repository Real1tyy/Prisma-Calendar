import type { CalendarEvent } from "../../src/types/calendar";
import { eventDefaults } from "../../src/types/calendar";
import type { EventMetadata } from "../../src/types/event";

function defaultMetadata(partial: Partial<EventMetadata> = {}): EventMetadata {
	return {
		skip: false,
		location: undefined,
		participants: undefined,
		categories: undefined,
		breakMinutes: undefined,
		icon: undefined,
		status: undefined,
		minutesBefore: undefined,
		daysBefore: undefined,
		alreadyNotified: false,
		rruleType: undefined,
		rruleSpec: undefined,
		rruleId: undefined,
		instanceDate: undefined,
		source: undefined,
		futureInstancesCount: undefined,
		generatePastEvents: false,
		caldav: undefined,
		icsSubscription: undefined,
		...partial,
	};
}

/**
 * Single fixture for calendar event creation. Pass partial overrides (e.g. metadata: { breakMinutes: 30 }).
 * Metadata is merged with defaults internally.
 */
export function createMockAllDayEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
	return {
		...eventDefaults(),
		id: "test-1",
		ref: { filePath: "test.md" },
		title: "Test Event",
		start: "2024-03-15T00:00:00",
		metadata: defaultMetadata(overrides.metadata),
		...overrides,
		type: "allDay" as const,
		allDay: true as const,
	} as CalendarEvent;
}

/**
 * Single fixture for timed event creation. Pass partial overrides (e.g. metadata: { breakMinutes: 30 }).
 * Metadata is merged with defaults internally.
 */
export function createMockTimedEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
	const start = (overrides.start as string) ?? "2024-03-15T09:00:00";
	const end = (overrides as { end?: string }).end !== undefined ? (overrides as { end: string }).end : start;

	return {
		...eventDefaults(),
		id: "test-1",
		ref: { filePath: "test.md" },
		title: "Test Event",
		start,
		end,
		metadata: defaultMetadata(overrides.metadata),
		...overrides,
		type: "timed" as const,
		allDay: false as const,
	} as CalendarEvent;
}

/** For building RawEventSource / other non-CalendarEvent objects that need full EventMetadata. */
export function createDefaultMetadata(overrides: Partial<EventMetadata> = {}): EventMetadata {
	return defaultMetadata(overrides);
}
