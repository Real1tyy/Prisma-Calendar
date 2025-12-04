import { describe, expect, it } from "vitest";
import type { ParsedEvent } from "../../src/core/parser";
import { createICSFromEvents, type ICSExportOptions } from "../../src/utils/ics-export";
import { buildFrontmatterFromImportedEvent, type ImportedEvent, parseICSContent } from "../../src/utils/ics-import";

const SAMPLE_ICS_SINGLE_EVENT = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test-event-1@example.com
DTSTART:20250315T100000Z
DTEND:20250315T110000Z
SUMMARY:Test Meeting
DESCRIPTION:This is a test meeting description
END:VEVENT
END:VCALENDAR`;

const SAMPLE_ICS_ALL_DAY_EVENT = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:all-day-1@example.com
DTSTART;VALUE=DATE:20250315
DTEND;VALUE=DATE:20250316
SUMMARY:All Day Event
END:VEVENT
END:VCALENDAR`;

const SAMPLE_ICS_MULTIPLE_EVENTS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:event-1@example.com
DTSTART:20250315T100000Z
DTEND:20250315T110000Z
SUMMARY:First Event
END:VEVENT
BEGIN:VEVENT
UID:event-2@example.com
DTSTART:20250316T140000Z
DTEND:20250316T150000Z
SUMMARY:Second Event
END:VEVENT
BEGIN:VEVENT
UID:event-3@example.com
DTSTART:20250317T090000Z
DTEND:20250317T100000Z
SUMMARY:Third Event
END:VEVENT
END:VCALENDAR`;

const SAMPLE_ICS_NO_EVENTS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
END:VCALENDAR`;

const SAMPLE_ICS_WITH_CATEGORIES = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:cat-event-1@example.com
DTSTART:20250315T100000Z
DTEND:20250315T110000Z
SUMMARY:Categorized Event
CATEGORIES:work,meeting,important
END:VEVENT
END:VCALENDAR`;

describe("ICS Import", () => {
	describe("parseICSContent", () => {
		it("should successfully parse a single event", () => {
			const result = parseICSContent(SAMPLE_ICS_SINGLE_EVENT);

			expect(result.success).toBe(true);
			expect(result.events).toHaveLength(1);
			expect(result.events[0].title).toBe("Test Meeting");
			expect(result.events[0].description).toBe("This is a test meeting description");
			expect(result.events[0].allDay).toBe(false);
		});

		it("should parse event start and end times correctly", () => {
			const result = parseICSContent(SAMPLE_ICS_SINGLE_EVENT);

			expect(result.success).toBe(true);
			const event = result.events[0];
			expect(event.start).toBeInstanceOf(Date);
			expect(event.end).toBeInstanceOf(Date);
			expect(event.start.toISOString()).toBe("2025-03-15T10:00:00.000Z");
			expect(event.end?.toISOString()).toBe("2025-03-15T11:00:00.000Z");
		});

		it("should correctly identify all-day events", () => {
			const result = parseICSContent(SAMPLE_ICS_ALL_DAY_EVENT);

			expect(result.success).toBe(true);
			expect(result.events).toHaveLength(1);
			expect(result.events[0].title).toBe("All Day Event");
			expect(result.events[0].allDay).toBe(true);
		});

		it("should parse multiple events", () => {
			const result = parseICSContent(SAMPLE_ICS_MULTIPLE_EVENTS);

			expect(result.success).toBe(true);
			expect(result.events).toHaveLength(3);
			expect(result.events[0].title).toBe("First Event");
			expect(result.events[1].title).toBe("Second Event");
			expect(result.events[2].title).toBe("Third Event");
		});

		it("should return error when no events are found", () => {
			const result = parseICSContent(SAMPLE_ICS_NO_EVENTS);

			expect(result.success).toBe(false);
			expect(result.events).toHaveLength(0);
			expect(result.error?.message).toBe("No events found in ICS file");
		});

		it("should return error for invalid ICS content", () => {
			const result = parseICSContent("not valid ics content");

			expect(result.success).toBe(false);
			expect(result.events).toHaveLength(0);
			expect(result.error).toBeDefined();
		});

		it("should return error for empty string", () => {
			const result = parseICSContent("");

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});

		it("should parse categories when present", () => {
			const result = parseICSContent(SAMPLE_ICS_WITH_CATEGORIES);

			expect(result.success).toBe(true);
			expect(result.events[0].categories).toBeDefined();
		});

		it("should use default title for events without summary", () => {
			const icsWithoutSummary = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:no-title@example.com
DTSTART:20250315T100000Z
DTEND:20250315T110000Z
END:VEVENT
END:VCALENDAR`;

			const result = parseICSContent(icsWithoutSummary);

			expect(result.success).toBe(true);
			expect(result.events[0].title).toBe("Untitled Event");
		});

		it("should handle events without end time", () => {
			const icsWithoutEnd = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:no-end@example.com
DTSTART:20250315T100000Z
SUMMARY:Event without end
END:VEVENT
END:VCALENDAR`;

			const result = parseICSContent(icsWithoutEnd);

			expect(result.success).toBe(true);
			expect(result.events[0].end).toBeUndefined();
		});

		it("should handle events without description", () => {
			const icsWithoutDescription = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:no-desc@example.com
DTSTART:20250315T100000Z
SUMMARY:Event without description
END:VEVENT
END:VCALENDAR`;

			const result = parseICSContent(icsWithoutDescription);

			expect(result.success).toBe(true);
			expect(result.events[0].description).toBeUndefined();
		});

		it("should skip events without start time", () => {
			const icsWithoutStart = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:no-start@example.com
SUMMARY:Event without start
END:VEVENT
BEGIN:VEVENT
UID:with-start@example.com
DTSTART:20250315T100000Z
SUMMARY:Event with start
END:VEVENT
END:VCALENDAR`;

			const result = parseICSContent(icsWithoutStart);

			expect(result.success).toBe(true);
			expect(result.events).toHaveLength(1);
			expect(result.events[0].title).toBe("Event with start");
		});

		describe("VALARM parsing", () => {
			it("should parse VALARM trigger in minutes", () => {
				const icsWithAlarm = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:alarm-event@example.com
DTSTART:20250315T100000Z
SUMMARY:Event with alarm
BEGIN:VALARM
ACTION:DISPLAY
TRIGGER:-PT15M
DESCRIPTION:Reminder
END:VALARM
END:VEVENT
END:VCALENDAR`;

				const result = parseICSContent(icsWithAlarm);

				expect(result.success).toBe(true);
				expect(result.events[0].reminderMinutes).toBe(15);
			});

			it("should parse VALARM trigger in hours", () => {
				const icsWithHourAlarm = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:alarm-hour@example.com
DTSTART:20250315T100000Z
SUMMARY:Event with hour alarm
BEGIN:VALARM
ACTION:DISPLAY
TRIGGER:-PT1H
END:VALARM
END:VEVENT
END:VCALENDAR`;

				const result = parseICSContent(icsWithHourAlarm);

				expect(result.success).toBe(true);
				expect(result.events[0].reminderMinutes).toBe(60);
			});

			it("should parse VALARM trigger in days", () => {
				const icsWithDayAlarm = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:alarm-day@example.com
DTSTART:20250315T100000Z
SUMMARY:Event with day alarm
BEGIN:VALARM
ACTION:DISPLAY
TRIGGER:-P1D
END:VALARM
END:VEVENT
END:VCALENDAR`;

				const result = parseICSContent(icsWithDayAlarm);

				expect(result.success).toBe(true);
				expect(result.events[0].reminderMinutes).toBe(1440);
			});

			it("should return undefined when no VALARM present", () => {
				const result = parseICSContent(SAMPLE_ICS_SINGLE_EVENT);

				expect(result.success).toBe(true);
				expect(result.events[0].reminderMinutes).toBeUndefined();
			});

			it("should parse combined hours and minutes trigger", () => {
				const icsWithCombinedAlarm = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:alarm-combined@example.com
DTSTART:20250315T100000Z
SUMMARY:Event with combined alarm
BEGIN:VALARM
ACTION:DISPLAY
TRIGGER:-PT1H30M
END:VALARM
END:VEVENT
END:VCALENDAR`;

				const result = parseICSContent(icsWithCombinedAlarm);

				expect(result.success).toBe(true);
				expect(result.events[0].reminderMinutes).toBe(90);
			});
		});

		describe("X-PRISMA-* property parsing", () => {
			it("should parse X-PRISMA-FILE property and UID", () => {
				const icsWithPrismaProps = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:a5439f25-b706-5f03-90ea-75530c0d30b5
DTSTART:20250315T100000Z
SUMMARY:Prisma Event
X-PRISMA-FILE:Tasks/My Event-20250315100000.md
END:VEVENT
END:VCALENDAR`;

				const result = parseICSContent(icsWithPrismaProps);

				expect(result.success).toBe(true);
				expect(result.events[0].originalFilePath).toBe("Tasks/My Event-20250315100000.md");
				expect(result.events[0].uid).toBe("a5439f25-b706-5f03-90ea-75530c0d30b5");
			});

			it("should parse X-PRISMA-FM-* properties as frontmatter", () => {
				const icsWithFrontmatter = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:fm-event@example.com
DTSTART:20250315T100000Z
SUMMARY:Event with frontmatter
X-PRISMA-FM-TITLE;ORIGINAL=Title:My Custom Title
X-PRISMA-FM-PRIORITY;ORIGINAL=priority:1
X-PRISMA-FM-COMPLETED;ORIGINAL=completed:false
END:VEVENT
END:VCALENDAR`;

				const result = parseICSContent(icsWithFrontmatter);

				expect(result.success).toBe(true);
				expect(result.events[0].frontmatter).toBeDefined();
				expect(result.events[0].frontmatter?.Title).toBe("My Custom Title");
				expect(result.events[0].frontmatter?.priority).toBe(1);
				expect(result.events[0].frontmatter?.completed).toBe(false);
			});

			it("should parse JSON array values from X-PRISMA-FM-* properties", () => {
				const icsWithArray = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:array-event@example.com
DTSTART:20250315T100000Z
SUMMARY:Event with array
X-PRISMA-FM-TAGS;ORIGINAL=tags:["work","meeting","important"]
END:VEVENT
END:VCALENDAR`;

				const result = parseICSContent(icsWithArray);

				expect(result.success).toBe(true);
				expect(result.events[0].frontmatter?.tags).toEqual(["work", "meeting", "important"]);
			});

			it("should return undefined frontmatter when no X-PRISMA-FM-* properties", () => {
				const result = parseICSContent(SAMPLE_ICS_SINGLE_EVENT);

				expect(result.success).toBe(true);
				expect(result.events[0].frontmatter).toBeUndefined();
			});
		});
	});

	describe("round-trip idempotency", () => {
		function createMockEvent(overrides: Partial<ParsedEvent> = {}): ParsedEvent {
			return {
				id: "test-event-id",
				ref: { filePath: "calendar/test-event-20250115143000.md" },
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
				notifications: {
					minutesBeforeProp: "Minutes Before",
					daysBeforeProp: "Days Before",
				},
				excludeProps: {
					startProp: "Start Date",
					endProp: "End Date",
					dateProp: "Date",
					allDayProp: "All Day",
					titleProp: "Title",
				},
				...overrides,
			};
		}

		it("should preserve custom frontmatter through export and import cycle", () => {
			const originalMeta = {
				completed: false,
				priority: 1,
				location: "Office",
				tags: ["work", "meeting"],
			};

			const event = createMockEvent({ meta: originalMeta });
			const exportResult = createICSFromEvents([event], createOptions());
			expect(exportResult.success).toBe(true);

			const importResult = parseICSContent(exportResult.content!);
			expect(importResult.success).toBe(true);
			expect(importResult.events).toHaveLength(1);

			const importedEvent = importResult.events[0];
			expect(importedEvent.frontmatter).toBeDefined();
			expect(importedEvent.frontmatter?.completed).toBe(originalMeta.completed);
			expect(importedEvent.frontmatter?.priority).toBe(originalMeta.priority);
			expect(importedEvent.frontmatter?.location).toBe(originalMeta.location);
			expect(importedEvent.frontmatter?.tags).toEqual(originalMeta.tags);
		});

		it("should NOT include standard properties in X-PRISMA-FM-* (they use standard ICS fields)", () => {
			const originalMeta = {
				"Start Date": "2025-01-15T10:00:00Z",
				"End Date": "2025-01-15T11:00:00Z",
				"Minutes Before": 15,
				Category: ["work", "meeting"],
				customProp: "should be preserved",
			};

			const event = createMockEvent({ meta: originalMeta });
			const exportResult = createICSFromEvents([event], createOptions());
			expect(exportResult.success).toBe(true);

			const importResult = parseICSContent(exportResult.content!);
			expect(importResult.success).toBe(true);

			const importedEvent = importResult.events[0];
			// Standard properties should NOT be in frontmatter (they're excluded from X-PRISMA-FM-*)
			expect(importedEvent.frontmatter?.["Start Date"]).toBeUndefined();
			expect(importedEvent.frontmatter?.["End Date"]).toBeUndefined();
			expect(importedEvent.frontmatter?.["Minutes Before"]).toBeUndefined();
			expect(importedEvent.frontmatter?.Category).toBeUndefined();
			// Custom properties SHOULD be preserved
			expect(importedEvent.frontmatter?.customProp).toBe("should be preserved");
		});

		it("should preserve original file path through round-trip", () => {
			const event = createMockEvent({
				ref: { filePath: "Tasks/Add A shortcut To Auto Tag nOtes-20251130110500.md" },
			});

			const exportResult = createICSFromEvents([event], createOptions());
			expect(exportResult.success).toBe(true);

			const importResult = parseICSContent(exportResult.content!);
			expect(importResult.success).toBe(true);
			expect(importResult.events[0].originalFilePath).toBe("Tasks/Add A shortcut To Auto Tag nOtes-20251130110500.md");
		});

		it("should preserve event ID through round-trip via UID", () => {
			const event = createMockEvent({ id: "unique-event-id-123" });

			const exportResult = createICSFromEvents([event], createOptions());
			expect(exportResult.success).toBe(true);
			expect(exportResult.content).toContain("UID:unique-event-id-123");

			const importResult = parseICSContent(exportResult.content!);
			expect(importResult.success).toBe(true);
			expect(importResult.events[0].uid).toBe("unique-event-id-123");
		});

		it("should use sample event from user for round-trip test", () => {
			// This is the actual event from the user's example
			const event = createMockEvent({
				id: "1ff5a333-bea3-5b7e-9f89-8d1b304e405b",
				ref: { filePath: "Tasks/Add A shortcut To Auto Tag nOtes.md" },
				title: "Add A shortcut To Auto Tag nOtes",
				start: "2025-09-07T13:41:26Z",
				end: "2025-09-07T14:41:26Z",
				allDay: false,
				meta: {
					"Start Date": "2025-09-07T13:41:26.000Z",
					"End Date": "2025-09-07T14:41:26.000Z",
					"Minutes Before": 1,
					customNote: "This is a custom property",
				},
			});

			const exportResult = createICSFromEvents([event], createOptions({ vaultName: "SecondBrain" }));
			expect(exportResult.success).toBe(true);
			expect(exportResult.content).toContain("SUMMARY:Add A shortcut To Auto Tag nOtes");
			expect(exportResult.content).toContain("X-PRISMA-VAULT:SecondBrain");
			expect(exportResult.content).toContain("UID:1ff5a333-bea3-5b7e-9f89-8d1b304e405b");
			// Standard properties should NOT be in X-PRISMA-FM-*
			expect(exportResult.content).not.toContain("X-PRISMA-FM-START-DATE");
			expect(exportResult.content).not.toContain("X-PRISMA-FM-MINUTES-BEFORE");
			// Custom property SHOULD be in X-PRISMA-FM-*
			expect(exportResult.content).toContain("X-PRISMA-FM-CUSTOMNOTE");

			const importResult = parseICSContent(exportResult.content!);
			expect(importResult.success).toBe(true);

			const imported = importResult.events[0];
			expect(imported.title).toBe("Add A shortcut To Auto Tag nOtes");
			expect(imported.uid).toBe("1ff5a333-bea3-5b7e-9f89-8d1b304e405b");
			// Standard properties are parsed from ICS fields directly (DTSTART, DTEND, etc.)
			expect(imported.start.toISOString()).toBe("2025-09-07T13:41:26.000Z");
			expect(imported.end?.toISOString()).toBe("2025-09-07T14:41:26.000Z");
			expect(imported.reminderMinutes).toBe(1);
			// Custom properties are restored from X-PRISMA-FM-*
			expect(imported.frontmatter?.customNote).toBe("This is a custom property");
		});
	});

	describe("timezone conversion on import", () => {
		const defaultSettings = {
			startProp: "Start Date",
			endProp: "End Date",
			dateProp: "Date",
			allDayProp: "All Day",
			titleProp: "Title",
			minutesBeforeProp: "Minutes Before",
			daysBeforeProp: "Days Before",
			categoryProp: "Category",
		};

		function createImportedEvent(overrides: Partial<ImportedEvent> = {}): ImportedEvent {
			return {
				title: "Test Event",
				start: new Date("2025-01-15T13:00:00.000Z"),
				end: new Date("2025-01-15T14:00:00.000Z"),
				allDay: false,
				uid: "test-uid",
				...overrides,
			};
		}

		it("should convert timed event to UTC timezone (stays the same)", () => {
			const event = createImportedEvent({
				start: new Date("2025-01-15T13:00:00.000Z"),
				end: new Date("2025-01-15T14:00:00.000Z"),
			});

			const fm = buildFrontmatterFromImportedEvent(event, defaultSettings, "UTC");

			expect(fm["Start Date"]).toBe("2025-01-15T13:00:00.000Z");
			expect(fm["End Date"]).toBe("2025-01-15T14:00:00.000Z");
		});

		it("should convert timed event from Europe/Berlin timezone to normalized UTC", () => {
			const event = createImportedEvent({
				start: new Date("2025-01-15T13:00:00.000Z"),
				end: new Date("2025-01-15T14:00:00.000Z"),
			});

			const fm = buildFrontmatterFromImportedEvent(event, defaultSettings, "Europe/Berlin");

			// UTC 13:00 = 14:00 in Berlin → stored as 14:00.000Z (local time normalized to UTC)
			expect(fm["Start Date"]).toBe("2025-01-15T14:00:00.000Z");
			expect(fm["End Date"]).toBe("2025-01-15T15:00:00.000Z");
		});

		it("should convert timed event from America/New_York timezone to normalized UTC", () => {
			const event = createImportedEvent({
				start: new Date("2025-01-15T13:00:00.000Z"),
				end: new Date("2025-01-15T14:00:00.000Z"),
			});

			const fm = buildFrontmatterFromImportedEvent(event, defaultSettings, "America/New_York");

			// UTC 13:00 = 08:00 in New York → stored as 08:00.000Z (local time normalized to UTC)
			expect(fm["Start Date"]).toBe("2025-01-15T08:00:00.000Z");
			expect(fm["End Date"]).toBe("2025-01-15T09:00:00.000Z");
		});

		it("should preserve all-day event date in UTC", () => {
			const event = createImportedEvent({
				start: new Date("2025-01-15T00:00:00.000Z"),
				allDay: true,
			});

			const fm = buildFrontmatterFromImportedEvent(event, defaultSettings, "UTC");

			expect(fm["All Day"]).toBe(true);
			expect(fm.Date).toBe("2025-01-15");
		});

		it("should preserve all-day event date in Europe/Berlin timezone", () => {
			// UTC midnight = 01:00 in Berlin, same date
			const event = createImportedEvent({
				start: new Date("2025-01-15T00:00:00.000Z"),
				allDay: true,
			});

			const fm = buildFrontmatterFromImportedEvent(event, defaultSettings, "Europe/Berlin");

			expect(fm["All Day"]).toBe(true);
			expect(fm.Date).toBe("2025-01-15");
		});

		it("should handle all-day event near date boundary correctly", () => {
			// UTC 23:00 on the 14th = 00:00 on the 15th in Berlin
			const event = createImportedEvent({
				start: new Date("2025-01-14T23:00:00.000Z"),
				allDay: true,
			});

			const fm = buildFrontmatterFromImportedEvent(event, defaultSettings, "Europe/Berlin");

			expect(fm["All Day"]).toBe(true);
			// Should be the 15th in Berlin timezone
			expect(fm.Date).toBe("2025-01-15");
		});
	});
});
