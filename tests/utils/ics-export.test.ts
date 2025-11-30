import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedEvent } from "../../src/core/parser";
import { createICSFromEvents, generateICSFilename } from "../../src/utils/ics-export";

function createMockEvent(overrides: Partial<ParsedEvent> = {}): ParsedEvent {
	return {
		id: "test-event-id",
		ref: { filePath: "calendar/test-event.md" },
		title: "Test Event",
		start: "2025-01-15T10:00:00Z",
		end: "2025-01-15T11:00:00Z",
		allDay: false,
		isVirtual: false,
		skipped: false,
		...overrides,
	};
}

describe("ICS Export", () => {
	describe("createICSFromEvents", () => {
		it("should return error when events array is empty", () => {
			const result = createICSFromEvents([], "Test Calendar", new Map());

			expect(result.success).toBe(false);
			expect(result.error?.message).toBe("No events to export");
			expect(result.content).toBeUndefined();
		});

		it("should successfully export a single timed event", () => {
			const event = createMockEvent();
			const result = createICSFromEvents([event], "Test Calendar", new Map());

			expect(result.success).toBe(true);
			expect(result.content).toBeDefined();
			expect(result.content).toContain("BEGIN:VCALENDAR");
			expect(result.content).toContain("END:VCALENDAR");
			expect(result.content).toContain("BEGIN:VEVENT");
			expect(result.content).toContain("END:VEVENT");
			expect(result.content).toContain("SUMMARY:Test Event");
		});

		it("should include event UID with plugin identifier", () => {
			const event = createMockEvent({ id: "unique-event-123" });
			const result = createICSFromEvents([event], "Test Calendar", new Map());

			expect(result.success).toBe(true);
			expect(result.content).toContain("UID:unique-event-123@prisma-calendar");
		});

		it("should include product ID with calendar name", () => {
			const event = createMockEvent();
			const result = createICSFromEvents([event], "My Custom Calendar", new Map());

			expect(result.success).toBe(true);
			expect(result.content).toContain("PRODID:-//My Custom Calendar//Prisma Calendar//EN");
		});

		it("should export multiple events", () => {
			const events = [
				createMockEvent({ id: "event-1", title: "First Event" }),
				createMockEvent({ id: "event-2", title: "Second Event" }),
				createMockEvent({ id: "event-3", title: "Third Event" }),
			];
			const result = createICSFromEvents(events, "Test Calendar", new Map());

			expect(result.success).toBe(true);
			expect(result.content).toContain("SUMMARY:First Event");
			expect(result.content).toContain("SUMMARY:Second Event");
			expect(result.content).toContain("SUMMARY:Third Event");
		});

		it("should include note content as description", () => {
			const event = createMockEvent({ ref: { filePath: "calendar/meeting.md" } });
			const noteContents = new Map([
				["calendar/meeting.md", "This is the meeting notes content.\nWith multiple lines."],
			]);

			const result = createICSFromEvents([event], "Test Calendar", noteContents);

			expect(result.success).toBe(true);
			expect(result.content).toContain("DESCRIPTION:");
		});

		it("should not include description when note content is not available", () => {
			const event = createMockEvent();
			const result = createICSFromEvents([event], "Test Calendar", new Map());

			expect(result.success).toBe(true);
			expect(result.content).not.toContain("DESCRIPTION:");
		});

		it("should include categories when tags are present", () => {
			const event = createMockEvent({
				meta: { tags: ["work", "meeting", "important"] },
			});
			const result = createICSFromEvents([event], "Test Calendar", new Map());

			expect(result.success).toBe(true);
			expect(result.content).toContain("CATEGORIES:");
		});

		it("should not include categories when tags are not present", () => {
			const event = createMockEvent({ meta: {} });
			const result = createICSFromEvents([event], "Test Calendar", new Map());

			expect(result.success).toBe(true);
			expect(result.content).not.toContain("CATEGORIES:");
		});

		describe("timed events", () => {
			it("should format timed event with UTC timestamps", () => {
				const event = createMockEvent({
					start: "2025-03-20T14:30:00Z",
					end: "2025-03-20T16:00:00Z",
					allDay: false,
				});
				const result = createICSFromEvents([event], "Test Calendar", new Map());

				expect(result.success).toBe(true);
				expect(result.content).toContain("DTSTART:20250320T143000Z");
				expect(result.content).toContain("DTEND:20250320T160000Z");
			});

			it("should omit DTEND when end is not provided", () => {
				const event = createMockEvent({
					start: "2025-03-20T14:30:00Z",
					end: undefined,
					allDay: false,
				});
				const result = createICSFromEvents([event], "Test Calendar", new Map());

				expect(result.success).toBe(true);
				expect(result.content).toContain("DTSTART:20250320T143000Z");
				expect(result.content).not.toContain("DTEND:");
			});
		});

		describe("all-day events", () => {
			it("should format all-day event with date-only values", () => {
				const event = createMockEvent({
					start: "2025-03-20T00:00:00Z",
					end: "2025-03-21T00:00:00Z",
					allDay: true,
				});
				const result = createICSFromEvents([event], "Test Calendar", new Map());

				expect(result.success).toBe(true);
				expect(result.content).toContain("DTSTART;VALUE=DATE:20250320");
				expect(result.content).toContain("DTEND;VALUE=DATE:20250321");
			});

			it("should use start date as end date when end is not provided for all-day event", () => {
				const event = createMockEvent({
					start: "2025-03-20T00:00:00Z",
					end: undefined,
					allDay: true,
				});
				const result = createICSFromEvents([event], "Test Calendar", new Map());

				expect(result.success).toBe(true);
				expect(result.content).toContain("DTSTART;VALUE=DATE:20250320");
				// ICS library omits DTEND when it equals DTSTART
			});
		});

		describe("mixed event types", () => {
			it("should handle mix of timed and all-day events", () => {
				const timedEvent = createMockEvent({
					id: "timed-1",
					title: "Timed Meeting",
					start: "2025-03-20T10:00:00Z",
					end: "2025-03-20T11:00:00Z",
					allDay: false,
				});
				const allDayEvent = createMockEvent({
					id: "allday-1",
					title: "All Day Event",
					start: "2025-03-21T00:00:00Z",
					end: "2025-03-22T00:00:00Z",
					allDay: true,
				});

				const result = createICSFromEvents([timedEvent, allDayEvent], "Test Calendar", new Map());

				expect(result.success).toBe(true);
				expect(result.content).toContain("SUMMARY:Timed Meeting");
				expect(result.content).toContain("SUMMARY:All Day Event");
				expect(result.content).toContain("DTSTART:20250320T100000Z");
				expect(result.content).toContain("DTSTART;VALUE=DATE:20250321");
			});
		});
	});

	describe("generateICSFilename", () => {
		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2025-01-15T14:30:45.123Z"));
		});

		it("should generate filename with sanitized calendar name", () => {
			const filename = generateICSFilename("My Calendar");
			expect(filename).toMatch(/^my-calendar-export-.*\.ics$/);
		});

		it("should replace special characters with hyphens", () => {
			const filename = generateICSFilename("Work & Personal");
			expect(filename).toMatch(/^work-personal-export-.*\.ics$/);
		});

		it("should handle calendar name with multiple spaces", () => {
			const filename = generateICSFilename("Calendar   Name   Test");
			expect(filename).toMatch(/^calendar-name-test-export-.*\.ics$/);
		});

		it("should include timestamp in filename", () => {
			const filename = generateICSFilename("Test");
			expect(filename).toBe("test-export-2025-01-15T14-30-45.ics");
		});

		it("should convert name to lowercase", () => {
			const filename = generateICSFilename("MY UPPERCASE CALENDAR");
			expect(filename).toMatch(/^my-uppercase-calendar-export-.*\.ics$/);
		});

		it("should handle empty string calendar name", () => {
			const filename = generateICSFilename("");
			expect(filename).toMatch(/^-export-.*\.ics$/);
		});

		afterEach(() => {
			vi.useRealTimers();
		});
	});
});
