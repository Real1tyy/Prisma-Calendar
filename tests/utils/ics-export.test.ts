import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedEvent } from "../../src/core/parser";
import {
	COMMON_TIMEZONES,
	createICSFromEvents,
	generateICSFilename,
	type ICSExportOptions,
} from "../../src/utils/ics-export";

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

function createOptions(overrides: Partial<ICSExportOptions> = {}): ICSExportOptions {
	return {
		calendarName: "Test Calendar",
		vaultName: "TestVault",
		timezone: "UTC",
		noteContents: new Map(),
		categoryProp: "Category",
		...overrides,
	};
}

describe("ICS Export", () => {
	describe("createICSFromEvents", () => {
		it("should return error when events array is empty", () => {
			const result = createICSFromEvents([], createOptions());

			expect(result.success).toBe(false);
			expect(result.error?.message).toBe("No events to export");
			expect(result.content).toBeUndefined();
		});

		it("should successfully export a single timed event", () => {
			const event = createMockEvent();
			const result = createICSFromEvents([event], createOptions());

			expect(result.success).toBe(true);
			expect(result.content).toBeDefined();
			expect(result.content).toContain("BEGIN:VCALENDAR");
			expect(result.content).toContain("END:VCALENDAR");
			expect(result.content).toContain("BEGIN:VEVENT");
			expect(result.content).toContain("END:VEVENT");
			expect(result.content).toContain("SUMMARY:Test Event");
		});

		it("should include product ID with calendar name", () => {
			const event = createMockEvent();
			const result = createICSFromEvents([event], createOptions({ calendarName: "My Custom Calendar" }));

			expect(result.success).toBe(true);
			expect(result.content).toContain("PRODID:-//My Custom Calendar//Prisma Calendar//EN");
		});

		it("should include calendar name header", () => {
			const event = createMockEvent();
			const result = createICSFromEvents([event], createOptions({ calendarName: "Work Calendar" }));

			expect(result.success).toBe(true);
			expect(result.content).toContain("X-WR-CALNAME:Work Calendar");
		});

		it("should export multiple events", () => {
			const events = [
				createMockEvent({ id: "event-1", title: "First Event" }),
				createMockEvent({ id: "event-2", title: "Second Event" }),
				createMockEvent({ id: "event-3", title: "Third Event" }),
			];
			const result = createICSFromEvents(events, createOptions());

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

			const result = createICSFromEvents([event], createOptions({ noteContents }));

			expect(result.success).toBe(true);
			expect(result.content).toContain("DESCRIPTION:");
		});

		it("should not include description when note content is not available", () => {
			const event = createMockEvent();
			const result = createICSFromEvents([event], createOptions());

			expect(result.success).toBe(true);
			expect(result.content).not.toContain("DESCRIPTION:");
		});

		it("should include categories when present in frontmatter", () => {
			const event = createMockEvent({
				meta: { Category: ["work", "meeting", "important"] },
			});
			const result = createICSFromEvents([event], createOptions());

			expect(result.success).toBe(true);
			expect(result.content).toContain("CATEGORIES:");
		});

		it("should not include categories when frontmatter value is empty", () => {
			const event = createMockEvent({ meta: {} });
			const result = createICSFromEvents([event], createOptions());

			expect(result.success).toBe(true);
			expect(result.content).not.toContain("CATEGORIES:");
		});

		it("should handle single category value as string", () => {
			const event = createMockEvent({
				meta: { Category: "work" },
			});
			const result = createICSFromEvents([event], createOptions());

			expect(result.success).toBe(true);
			expect(result.content).toContain("CATEGORIES:work");
		});

		describe("idempotency - UID from file path", () => {
			it("should generate UID from file path for idempotency", () => {
				const event = createMockEvent({ ref: { filePath: "calendar/my-event-20250115143000.md" } });
				const result = createICSFromEvents([event], createOptions());

				expect(result.success).toBe(true);
				expect(result.content).toContain("UID:calendar_my-event-20250115143000.md@prisma-calendar");
			});

			it("should sanitize special characters in UID", () => {
				const event = createMockEvent({ ref: { filePath: "calendar/Work & Life/event.md" } });
				const result = createICSFromEvents([event], createOptions());

				expect(result.success).toBe(true);
				expect(result.content).toContain("UID:calendar_Work___Life_event.md@prisma-calendar");
			});
		});

		describe("CREATED timestamp from Zettel ID", () => {
			it("should strip Zettel ID from title in SUMMARY", () => {
				const event = createMockEvent({
					title: "My Event-20250203140530",
				});
				const result = createICSFromEvents([event], createOptions());

				expect(result.success).toBe(true);
				expect(result.content).toContain("SUMMARY:My Event");
				expect(result.content).not.toContain("SUMMARY:My Event-20250203140530");
			});

			it("should use current time when no Zettel ID is present", () => {
				const event = createMockEvent({ title: "Event Without Zettel" });
				const result = createICSFromEvents([event], createOptions());

				expect(result.success).toBe(true);
				expect(result.content).toContain("CREATED:");
				expect(result.content).toContain("DTSTAMP:");
			});
		});

		describe("X-properties for Prisma metadata", () => {
			it("should include X-PRISMA-FILE with file path", () => {
				const event = createMockEvent({ ref: { filePath: "calendar/my-event.md" } });
				const result = createICSFromEvents([event], createOptions());

				expect(result.success).toBe(true);
				expect(result.content).toContain("X-PRISMA-FILE:calendar/my-event.md");
			});

			it("should include X-PRISMA-VAULT with vault name", () => {
				const event = createMockEvent();
				const result = createICSFromEvents([event], createOptions({ vaultName: "MyVault" }));

				expect(result.success).toBe(true);
				expect(result.content).toContain("X-PRISMA-VAULT:MyVault");
			});

			it("should include X-PRISMA-EVENT-ID with event id", () => {
				const event = createMockEvent({ id: "evt-12345" });
				const result = createICSFromEvents([event], createOptions());

				expect(result.success).toBe(true);
				expect(result.content).toContain("X-PRISMA-EVENT-ID:evt-12345");
			});

			it("should include Obsidian URI in URL field", () => {
				const event = createMockEvent({ ref: { filePath: "calendar/my event.md" } });
				const result = createICSFromEvents([event], createOptions({ vaultName: "Test Vault" }));

				expect(result.success).toBe(true);
				expect(result.content).toContain("URL:obsidian://open?vault=Test%20Vault&file=calendar%2Fmy%20event");
			});
		});

		describe("timed events", () => {
			it("should format timed event with UTC timestamps", () => {
				const event = createMockEvent({
					start: "2025-03-20T14:30:00Z",
					end: "2025-03-20T16:00:00Z",
					allDay: false,
				});
				const result = createICSFromEvents([event], createOptions());

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
				const result = createICSFromEvents([event], createOptions());

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
				const result = createICSFromEvents([event], createOptions());

				expect(result.success).toBe(true);
				expect(result.content).toContain("DTSTART;VALUE=DATE:20250320");
				expect(result.content).toContain("DTEND;VALUE=DATE:20250321");
			});

			it("should omit DTEND when end is not provided for all-day event", () => {
				const event = createMockEvent({
					start: "2025-03-20T00:00:00Z",
					end: undefined,
					allDay: true,
				});
				const result = createICSFromEvents([event], createOptions());

				expect(result.success).toBe(true);
				expect(result.content).toContain("DTSTART;VALUE=DATE:20250320");
				expect(result.content).not.toContain("DTEND:");
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

				const result = createICSFromEvents([timedEvent, allDayEvent], createOptions());

				expect(result.success).toBe(true);
				expect(result.content).toContain("SUMMARY:Timed Meeting");
				expect(result.content).toContain("SUMMARY:All Day Event");
				expect(result.content).toContain("DTSTART:20250320T100000Z");
				expect(result.content).toContain("DTSTART;VALUE=DATE:20250321");
			});
		});

		describe("timezone support", () => {
			it("should include timezone header when non-UTC timezone is specified", () => {
				const event = createMockEvent();
				const result = createICSFromEvents([event], createOptions({ timezone: "Europe/Prague" }));

				expect(result.success).toBe(true);
				expect(result.content).toContain("X-WR-TIMEZONE:Europe/Prague");
			});

			it("should not include timezone header for UTC", () => {
				const event = createMockEvent();
				const result = createICSFromEvents([event], createOptions({ timezone: "UTC" }));

				expect(result.success).toBe(true);
				expect(result.content).not.toContain("X-WR-TIMEZONE:");
			});
		});

		describe("VALARM notifications", () => {
			it("should include VALARM when minutesBefore is in frontmatter", () => {
				const event = createMockEvent({
					meta: { "Minutes Before": 15 },
				});
				const result = createICSFromEvents(
					[event],
					createOptions({
						notifications: {
							minutesBeforeProp: "Minutes Before",
							daysBeforeProp: "Days Before",
						},
					})
				);

				expect(result.success).toBe(true);
				expect(result.content).toContain("BEGIN:VALARM");
				expect(result.content).toContain("ACTION:DISPLAY");
				expect(result.content).toContain("END:VALARM");
			});

			it("should include VALARM with default minutes when frontmatter is not set", () => {
				const event = createMockEvent();
				const result = createICSFromEvents(
					[event],
					createOptions({
						notifications: {
							minutesBeforeProp: "Minutes Before",
							defaultMinutesBefore: 30,
							daysBeforeProp: "Days Before",
						},
					})
				);

				expect(result.success).toBe(true);
				expect(result.content).toContain("BEGIN:VALARM");
			});

			it("should not include VALARM when no notification configured", () => {
				const event = createMockEvent();
				const result = createICSFromEvents([event], createOptions());

				expect(result.success).toBe(true);
				expect(result.content).not.toContain("BEGIN:VALARM");
			});

			it("should use daysBeforeProp for all-day events", () => {
				const event = createMockEvent({
					allDay: true,
					start: "2025-03-20T00:00:00Z",
					meta: { "Days Before": 1 },
				});
				const result = createICSFromEvents(
					[event],
					createOptions({
						notifications: {
							minutesBeforeProp: "Minutes Before",
							daysBeforeProp: "Days Before",
						},
					})
				);

				expect(result.success).toBe(true);
				expect(result.content).toContain("BEGIN:VALARM");
			});

			it("should use defaultDaysBefore for all-day events without frontmatter", () => {
				const event = createMockEvent({
					allDay: true,
					start: "2025-03-20T00:00:00Z",
				});
				const result = createICSFromEvents(
					[event],
					createOptions({
						notifications: {
							minutesBeforeProp: "Minutes Before",
							daysBeforeProp: "Days Before",
							defaultDaysBefore: 1,
						},
					})
				);

				expect(result.success).toBe(true);
				expect(result.content).toContain("BEGIN:VALARM");
			});

			it("should prefer frontmatter over default", () => {
				const event = createMockEvent({
					meta: { "Minutes Before": 5 },
				});
				const result = createICSFromEvents(
					[event],
					createOptions({
						notifications: {
							minutesBeforeProp: "Minutes Before",
							defaultMinutesBefore: 30,
							daysBeforeProp: "Days Before",
						},
					})
				);

				expect(result.success).toBe(true);
				expect(result.content).toContain("BEGIN:VALARM");
			});

			describe("decimal rounding", () => {
				it("should round decimal minutes from frontmatter", () => {
					const event = createMockEvent({
						meta: { "Minutes Before": 15.5 },
					});
					const result = createICSFromEvents(
						[event],
						createOptions({
							notifications: {
								minutesBeforeProp: "Minutes Before",
								daysBeforeProp: "Days Before",
							},
						})
					);

					expect(result.success).toBe(true);
					expect(result.content).toContain("BEGIN:VALARM");
					expect(result.content).not.toMatch(/PT15\.5M/);
					expect(result.content).toContain("TRIGGER");
				});

				it("should round decimal default minutes", () => {
					const event = createMockEvent();
					const result = createICSFromEvents(
						[event],
						createOptions({
							notifications: {
								minutesBeforeProp: "Minutes Before",
								defaultMinutesBefore: 7.7,
								daysBeforeProp: "Days Before",
							},
						})
					);

					expect(result.success).toBe(true);
					expect(result.content).toContain("BEGIN:VALARM");
					expect(result.content).not.toMatch(/PT7\.7M/);
				});

				it("should round 0.25 hours (15 min) correctly", () => {
					const event = createMockEvent({
						meta: { "Minutes Before": 0.25 * 60 },
					});
					const result = createICSFromEvents(
						[event],
						createOptions({
							notifications: {
								minutesBeforeProp: "Minutes Before",
								daysBeforeProp: "Days Before",
							},
						})
					);

					expect(result.success).toBe(true);
					expect(result.content).toContain("BEGIN:VALARM");
				});

				it("should round decimal days for all-day events", () => {
					const event = createMockEvent({
						allDay: true,
						start: "2025-03-20T00:00:00Z",
						meta: { "Days Before": 1.5 },
					});
					const result = createICSFromEvents(
						[event],
						createOptions({
							notifications: {
								minutesBeforeProp: "Minutes Before",
								daysBeforeProp: "Days Before",
							},
						})
					);

					expect(result.success).toBe(true);
					expect(result.content).toContain("BEGIN:VALARM");
				});
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

	describe("COMMON_TIMEZONES", () => {
		it("should include UTC as first option", () => {
			expect(COMMON_TIMEZONES[0].id).toBe("UTC");
		});

		it("should include common timezones with UTC offsets", () => {
			const ids = COMMON_TIMEZONES.map((tz) => tz.id);
			expect(ids).toContain("Europe/Prague");
			expect(ids).toContain("America/New_York");
			expect(ids).toContain("Asia/Tokyo");
		});

		it("should have labels with UTC offset info", () => {
			const prague = COMMON_TIMEZONES.find((tz) => tz.id === "Europe/Prague");
			expect(prague?.label).toBe("Europe/Prague (UTC+1)");
		});
	});
});
