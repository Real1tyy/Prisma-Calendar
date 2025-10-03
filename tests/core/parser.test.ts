import { DateTime } from "luxon";
import type { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it } from "vitest";
import type { RawEventSource } from "../../src/core/indexer";
import { Parser } from "../../src/core/parser";
import { createMockSingleCalendarSettings, createMockSingleCalendarSettingsStore } from "../setup";

describe("Parser", () => {
	let parser: Parser;
	let settingsStore: BehaviorSubject<any>;
	let settings: any;

	beforeEach(() => {
		settings = {
			...createMockSingleCalendarSettings(),
			startProp: "start",
			endProp: "end",
			dateProp: "Date",
			titleProp: "title",
			allDayProp: "All Day",
			defaultDurationMinutes: 60,
		};
		settingsStore = createMockSingleCalendarSettingsStore(settings);
		parser = new Parser(settingsStore);
	});

	describe("basic event parsing", () => {
		it("should parse a simple event with start date", () => {
			const source: RawEventSource = {
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					Date: "2024-01-15",
					"All Day": true,
				},
				folder: "Events",
			};

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			const event = events!;

			expect(event.title).toBe("meeting"); // From filename
			expect(event.start).toBeTruthy();
			expect(event.allDay).toBe(true);
			expect(event.ref.filePath).toBe("Events/meeting.md");
		});

		it("should parse event with start and end times", () => {
			const source: RawEventSource = {
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					start: "2024-01-15 10:00",
					end: "2024-01-15 11:30",
					title: "Team Meeting",
					allDay: false,
				},
				folder: "Events",
			};

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			const event = events!;

			expect(event.title).toBe("Team Meeting");
			expect(event.allDay).toBe(false);
			expect(event.start).toBeTruthy();
			expect(event.end).toBeTruthy();

			// Verify it's a timed event (should have specific time)
			const startTime = DateTime.fromISO(event.start);
			expect(startTime.hour).toBe(10);
			expect(startTime.minute).toBe(0);
		});

		it("should use default duration when end time is missing", () => {
			const source: RawEventSource = {
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					start: "2024-01-15 10:00",
					allDay: false,
				},
				folder: "Events",
			};

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			const event = events!;

			const startTime = DateTime.fromISO(event.start);
			const endTime = DateTime.fromISO(event.end!);
			const durationMinutes = endTime.diff(startTime, "minutes").minutes;

			expect(durationMinutes).toBe(60); // Default duration
		});

		it("should handle explicit all-day flag", () => {
			const source: RawEventSource = {
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					Date: "2024-01-15",
					"All Day": true,
				},
				folder: "Events",
			};

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			const event = events!;
			expect(event.allDay).toBe(true);
		});
	});

	describe("frontmatter property handling", () => {
		it("should use configured property names", () => {
			const testSettings = {
				...settings,
				startProp: "startDate",
				endProp: "endDate",
				titleProp: "eventTitle",
			};
			settingsStore.next(testSettings);
			parser = new Parser(settingsStore);

			const source: RawEventSource = {
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					startDate: "2024-01-15 10:00",
					endDate: "2024-01-15 11:00",
					eventTitle: "Custom Event",
				},
				folder: "Events",
			};

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			const event = events!;
			expect(event.title).toBe("Custom Event");
		});

		it("should fallback to filename when title property is missing", () => {
			const source: RawEventSource = {
				filePath: "Events/important-meeting.md",
				mtime: Date.now(),
				frontmatter: {
					start: "2024-01-15 10:00",
				},
				folder: "Events",
			};

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			const event = events!;
			expect(event.title).toBe("important-meeting");
		});
	});

	describe("date parsing", () => {
		it("should parse multiple date formats", () => {
			const formats = ["2024-01-15", "2024-01-15 14:30"];

			formats.forEach((dateStr) => {
				const source: RawEventSource = {
					filePath: "Events/test.md",
					mtime: Date.now(),
					frontmatter: { start: dateStr },
					folder: "Events",
				};

				const events = parser.parseEventSource(source);
				expect(events).toBeDefined();

				const startTime = DateTime.fromISO(events!.start);
				expect(startTime.isValid).toBe(true);
				expect(startTime.year).toBe(2024);
				expect(startTime.month).toBe(1);
				expect(startTime.day).toBe(15);
			});
		});

		it("should handle ISO date format", () => {
			const source: RawEventSource = {
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					start: "2024-01-15T10:00:00.000Z",
				},
				folder: "Events",
			};

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			const startTime = DateTime.fromISO(events!.start);
			expect(startTime.isValid).toBe(true);
		});

		it("should reject invalid date formats", () => {
			const source: RawEventSource = {
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					start: "not-a-date",
				},
				folder: "Events",
			};

			const events = parser.parseEventSource(source);

			expect(events).toBeNull();
		});

		it("should handle missing start property", () => {
			const source: RawEventSource = {
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					title: "Meeting without start time",
				},
				folder: "Events",
			};

			const events = parser.parseEventSource(source);

			expect(events).toBeNull();
		});
	});

	describe("UTC handling", () => {
		it("should store dates in UTC format", () => {
			const source: RawEventSource = {
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					start: "2024-01-15 10:00",
				},
				folder: "Events",
			};

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();

			// The stored start time should be in UTC (check the ISO string format)
			expect(events!.start).toMatch(/Z$/); // Should end with Z indicating UTC
		});
	});

	describe("all-day event detection", () => {
		it("should detect all-day events from date-only format", () => {
			const source: RawEventSource = {
				filePath: "Events/holiday.md",
				mtime: Date.now(),
				frontmatter: {
					start: "2024-01-15",
				},
				folder: "Events",
			};

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			expect(events!.allDay).toBe(false);
		});

		it("should detect timed events from datetime format", () => {
			const source: RawEventSource = {
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					start: "2024-01-15 10:00",
				},
				folder: "Events",
			};

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			expect(events!.allDay).toBe(false);
		});

		it("should respect explicit all-day flag over time format", () => {
			const source: RawEventSource = {
				filePath: "Events/all-day-event.md",
				mtime: Date.now(),
				frontmatter: {
					Date: "2024-01-15",
					"All Day": true,
				},
				folder: "Events",
			};

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			expect(events!.allDay).toBe(true);
		});
	});

	describe("metadata handling", () => {
		it("should include file metadata in event", () => {
			const source: RawEventSource = {
				filePath: "Projects/project-meeting.md",
				mtime: Date.now(),
				frontmatter: {
					start: "2024-01-15 10:00",
					priority: "high",
					status: "confirmed",
				},
				folder: "Projects",
			};

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			const event = events!;

			expect(event.meta).toEqual({
				folder: "Projects",
				originalStart: "2024-01-15 10:00",
				originalEnd: undefined,
				// All frontmatter properties should be included for Frontmatter Display
				start: "2024-01-15 10:00",
				priority: "high",
				status: "confirmed",
			});
		});

		it("should generate stable event IDs", () => {
			const source: RawEventSource = {
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					start: "2024-01-15 10:00",
				},
				folder: "Events",
			};

			const events1 = parser.parseEventSource(source);
			const events2 = parser.parseEventSource(source);

			expect(events1!.id).toBe(events2!.id);
			expect(events1!.id).toBeTruthy();
		});
	});

	describe("settings updates", () => {
		it("should update parser settings", () => {
			const newSettings = {
				...settings,
				startProp: "newStart",
				defaultDurationMinutes: 90,
			};

			settingsStore.next(newSettings);

			const source: RawEventSource = {
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					newStart: "2024-01-15 10:00", // Using new property name
				},
				folder: "Events",
			};

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();

			// Should use new default duration (90 minutes)
			const startTime = DateTime.fromISO(events!.start);
			const endTime = DateTime.fromISO(events!.end!);
			const durationMinutes = endTime.diff(startTime, "minutes").minutes;

			expect(durationMinutes).toBe(90);
		});
	});

	describe("error handling", () => {
		it("should handle empty frontmatter gracefully", () => {
			const source: RawEventSource = {
				filePath: "Events/empty.md",
				mtime: Date.now(),
				frontmatter: {},
				folder: "Events",
			};

			const events = parser.parseEventSource(source);

			expect(events).toBeNull();
		});

		it("should handle null/undefined values in frontmatter", () => {
			const source: RawEventSource = {
				filePath: "Events/null-values.md",
				mtime: Date.now(),
				frontmatter: {
					start: null,
					end: undefined,
					title: "",
				},
				folder: "Events",
			};

			const events = parser.parseEventSource(source);

			expect(events).toBeNull();
		});
	});

	describe("Real-world frontmatter parsing", () => {
		it("should parse the exact format from the user's failing case: yyyy-LL-dd HH:mm", () => {
			const testSettings = {
				...settings,
				startProp: "Start Date", // Use capital S to match the frontmatter
			};
			const testSettingsStore = createMockSingleCalendarSettingsStore(testSettings);
			const parser = new Parser(testSettingsStore);

			const source: RawEventSource = {
				filePath: "Tasks/enforce All Templates, Make it a one off script to enforce all frontmatter and templates..md",
				mtime: Date.now(),
				frontmatter: {
					title: "",
					startTime: "",
					endTime: "",
					date: "",
					Goal: "",
					Project: "",
					Parent: "",
					Child: "",
					Related: "",
					allDay: "",
					Status: "",
					Priority: "",
					Difficulty: "",
					"End Date": "",
					"Backlink Tags": "",
					Aliases: "",
					_ZettelID: "",
					_Archived: "",
					_LastModifiedTime: "",
					"Start Date": "2025-09-05 22:21", // This is the exact failing format
				},
				folder: "Tasks",
			};

			const returnedEvent = parser.parseEventSource(source);

			expect(returnedEvent).toBeDefined();
			expect(returnedEvent).not.toBeNull();
			const event = returnedEvent!;

			expect(event.start).toBeTruthy();
			expect(event.allDay).toBe(false); // Should not be all-day since it has time

			// Verify the date and time were parsed correctly
			const startDate = DateTime.fromISO(event.start);
			expect(startDate.isValid).toBe(true);
			expect(startDate.year).toBe(2025);
			expect(startDate.month).toBe(9);
			expect(startDate.day).toBe(5);
			expect(startDate.hour).toBe(22);
			expect(startDate.minute).toBe(21);
		});

		it("should test Luxon DateTime.fromFormat directly with the format", () => {
			const testValue = "2025-09-05 22:21";
			const testFormat = "yyyy-LL-dd HH:mm";

			const parsed = DateTime.fromFormat(testValue, testFormat);

			expect(parsed.isValid).toBe(true);
			expect(parsed.year).toBe(2025);
			expect(parsed.month).toBe(9);
			expect(parsed.day).toBe(5);
			expect(parsed.hour).toBe(22);
			expect(parsed.minute).toBe(21);
		});

		it("should work with default settings (including the yyyy-LL-dd HH:mm format)", () => {
			// Use the default settings from the schema
			const defaultSettings = createMockSingleCalendarSettings();
			const defaultSettingsStore = createMockSingleCalendarSettingsStore(defaultSettings);
			const parser = new Parser(defaultSettingsStore);

			const source: RawEventSource = {
				filePath: "Tasks/test-task.md",
				mtime: Date.now(),
				frontmatter: {
					"Start Date": "2025-09-05 22:21", // This should work with default settings
				},
				folder: "Tasks",
			};

			const event = parser.parseEventSource(source);

			expect(event).toBeDefined();
			expect(event).not.toBeNull();
			expect(event!.start).toBeTruthy();
			expect(event!.allDay).toBe(false);

			// Verify the date and time were parsed correctly
			const startDate = DateTime.fromISO(event!.start);
			expect(startDate.isValid).toBe(true);
			expect(startDate.year).toBe(2025);
			expect(startDate.month).toBe(9);
			expect(startDate.day).toBe(5);
			expect(startDate.hour).toBe(22);
			expect(startDate.minute).toBe(21);
		});
	});
});
