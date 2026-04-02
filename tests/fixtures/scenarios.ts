import type { CalendarEvent } from "../../src/types/calendar";
import { createDefaultMetadata, createMockAllDayEvent, createMockTimedEvent } from "./event-fixtures";

/** Semantic scenario helpers for common test data patterns. */
export const SCENARIO = {
	/** A completed (non-skipped) timed event. */
	completedEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
		return createMockTimedEvent({
			title: "Completed Task",
			metadata: createDefaultMetadata({ status: "done" }),
			...overrides,
		});
	},

	/** A skipped event. */
	skippedEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
		return createMockTimedEvent({
			title: "Skipped Event",
			skipped: true,
			metadata: createDefaultMetadata({ skip: true }),
			...overrides,
		});
	},

	/** An event with all metadata fields populated. */
	fullyDecoratedEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
		return createMockTimedEvent({
			title: "Decorated Event",
			metadata: createDefaultMetadata({
				location: "Conference Room A",
				participants: ["Alice", "Bob"],
				categories: ["work", "meeting"],
				icon: "calendar",
				status: "confirmed",
				minutesBefore: 15,
			}),
			...overrides,
		});
	},

	/** A timed event with a reminder set. */
	eventWithReminder(minutes: number, overrides: Partial<CalendarEvent> = {}): CalendarEvent {
		return createMockTimedEvent({
			title: "Event with Reminder",
			metadata: createDefaultMetadata({ minutesBefore: minutes }),
			...overrides,
		});
	},

	/** A source recurring event (has rruleType set). */
	recurringSourceEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
		return createMockTimedEvent({
			title: "Recurring Event",
			metadata: createDefaultMetadata({
				rruleType: "weekly",
				rruleId: "rrule-test-1",
			}),
			...overrides,
		});
	},

	/** A virtual recurring instance. */
	virtualRecurringInstance(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
		return createMockTimedEvent({
			title: "Recurring Instance",
			virtualKind: "recurring",
			metadata: createDefaultMetadata({
				rruleType: "weekly",
				rruleId: "rrule-test-1",
				instanceDate: "2024-03-22T09:00:00",
			}),
			...overrides,
		});
	},

	/** An all-day holiday event. */
	allDayHoliday(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
		return createMockAllDayEvent({
			title: "Holiday",
			start: "2024-12-25T00:00:00",
			...overrides,
		});
	},
} as const;
