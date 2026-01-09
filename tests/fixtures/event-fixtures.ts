import type { CalendarEvent } from "../../src/types/calendar";

export function createMockAllDayEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
	return {
		id: "test-1",
		ref: { filePath: "test.md" },
		title: "Test Event",
		start: "2024-03-15T00:00:00.000Z",
		isVirtual: false,
		skipped: false,
		meta: {},
		...overrides,
		type: "allDay" as const,
		allDay: true as const,
	} as CalendarEvent;
}

export function createMockTimedEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
	const start = (overrides.start as string) ?? "2024-03-15T09:00:00.000Z";
	const end = (overrides as any).end !== undefined ? ((overrides as any).end as string) : start;

	return {
		id: "test-1",
		ref: { filePath: "test.md" },
		title: "Test Event",
		start,
		end,
		isVirtual: false,
		skipped: false,
		meta: {},
		...overrides,
		type: "timed" as const,
		allDay: false as const,
	} as CalendarEvent;
}
