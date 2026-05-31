import { DateTime } from "luxon";
import type { App } from "obsidian";
import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Parser } from "../../src/core/parser";
import type { PrismaCalendarSettingsStore, SingleCalendarConfig } from "../../src/types";
import { isAllDayEvent, isTimedEvent } from "../../src/types/calendar";
import { createMockIntegrationApp, createMockMainSettingsStore, createRawEventSource } from "../fixtures";
import { createMockSingleCalendarSettings, createMockSingleCalendarSettingsStore } from "../fixtures/settings-fixtures";
import { createMockFile } from "../setup";

const mockApp = createMockIntegrationApp() as any;

describe("Parser", () => {
	let parser: Parser;
	let settingsStore: BehaviorSubject<any>;
	let mainStore: PrismaCalendarSettingsStore;
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
		mainStore = createMockMainSettingsStore([settings as SingleCalendarConfig]);
		parser = new Parser(mockApp as App, settingsStore, mainStore, settings.id);
	});

	describe("basic event parsing", () => {
		it("should parse a simple event with start date", () => {
			const source = createRawEventSource({
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					Date: "2024-01-15",
					"All Day": true,
				},
				folder: "Events",
				isAllDay: true,
				isUntracked: false,
			});

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			const event = events!;

			expect(event.title).toBe("meeting"); // From filename
			expect(isAllDayEvent(event)).toBe(true);
			expect(event.start).toBeTruthy();
			expect(event.ref.filePath).toBe("Events/meeting.md");
		});

		it("should parse event with start and end times", () => {
			const source = createRawEventSource({
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					start: "2024-01-15 10:00",
					end: "2024-01-15 11:30",
					title: "Team Meeting",
					allDay: false,
				},
				folder: "Events",
				isAllDay: false,
				isUntracked: false,
			});

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			const event = events!;

			expect(event.title).toBe("Team Meeting");
			expect(isTimedEvent(event)).toBe(true);
			expect(event.start).toBeTruthy();
			if (isTimedEvent(event)) {
				expect(event.end).toBeTruthy();
			}

			// Verify it's a timed event (should have specific time)
			const startTime = DateTime.fromISO(event.start);
			expect(startTime.hour).toBe(10);
			expect(startTime.minute).toBe(0);
		});

		it("should use default duration when end time is missing", () => {
			const source = createRawEventSource({
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					start: "2024-01-15 10:00",
					allDay: false,
				},
				folder: "Events",
				isAllDay: false,
				isUntracked: false,
			});

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			const event = events!;
			expect(isTimedEvent(event)).toBe(true);

			if (isTimedEvent(event)) {
				const startTime = DateTime.fromISO(event.start);
				const endTime = DateTime.fromISO(event.end);
				const durationMinutes = endTime.diff(startTime, "minutes").minutes;

				expect(durationMinutes).toBe(60); // Default duration
			}
		});

		it("should handle explicit all-day flag", () => {
			const source = createRawEventSource({
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					Date: "2024-01-15",
					"All Day": true,
				},
				folder: "Events",
				isAllDay: true,
				isUntracked: false,
			});

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			const event = events!;
			expect(isAllDayEvent(event)).toBe(true);
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
			parser = new Parser(mockApp as App, settingsStore, mainStore, settings.id);

			const source = createRawEventSource({
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					startDate: "2024-01-15 10:00",
					endDate: "2024-01-15 11:00",
					eventTitle: "Custom Event",
				},
				folder: "Events",
				isAllDay: false,
				isUntracked: false,
			});

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			const event = events!;
			expect(event.title).toBe("Custom Event");
		});

		it("should fallback to filename when title property is missing", () => {
			const source = createRawEventSource({
				filePath: "Events/important-meeting.md",
				mtime: Date.now(),
				frontmatter: {
					start: "2024-01-15 10:00",
				},
				folder: "Events",
				isAllDay: false,
				isUntracked: false,
			});

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			const event = events!;
			expect(event.title).toBe("important-meeting");
		});
	});

	describe("date parsing", () => {
		it("should parse multiple date formats in their matching temporal role", () => {
			// A datetime belongs in the start property (→ timed); a date-only value
			// belongs in the date property (→ all-day). Both must yield 2024-01-15.
			const cases = [{ frontmatter: { start: "2024-01-15 14:30" } }, { frontmatter: { Date: "2024-01-15" } }];

			cases.forEach(({ frontmatter }) => {
				const source = createRawEventSource({
					filePath: "Events/test.md",
					mtime: Date.now(),
					frontmatter,
					folder: "Events",
					isAllDay: false,
					isUntracked: false,
				});

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
			const source = createRawEventSource({
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					start: "2024-01-15T10:00:00.000Z",
				},
				folder: "Events",
				isAllDay: false,
				isUntracked: false,
			});

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			const startTime = DateTime.fromISO(events!.start);
			expect(startTime.isValid).toBe(true);
		});

		it("should reject invalid date formats", () => {
			const source = createRawEventSource({
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					start: "not-a-date",
				},
				folder: "Events",
				isAllDay: false,
				isUntracked: false,
			});

			const events = parser.parseEventSource(source);

			expect(events).toBeNull();
		});

		it("should handle missing start property", () => {
			const source = createRawEventSource({
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					title: "Meeting without start time",
				},
				folder: "Events",
				isAllDay: false,
				isUntracked: false,
			});

			const events = parser.parseEventSource(source);

			expect(events).toBeNull();
		});
	});

	describe("UTC handling", () => {
		it("should store dates in local ISO format without Z suffix", () => {
			const source = createRawEventSource({
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					start: "2024-01-15 10:00",
				},
				folder: "Events",
				isAllDay: false,
				isUntracked: false,
			});

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			expect(events!.start).not.toMatch(/Z$/);
			expect(events!.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
		});
	});

	describe("all-day event detection", () => {
		it("should detect all-day events from a date-only value in the date property without a flag", () => {
			const source = createRawEventSource({
				filePath: "Events/holiday.md",
				mtime: Date.now(),
				frontmatter: {
					Date: "2024-01-15",
				},
				folder: "Events",
				isAllDay: false,
				isUntracked: false,
			});

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			expect(events!.allDay).toBe(true);
			expect(isAllDayEvent(events!)).toBe(true);
		});

		it("should leave a date-only value in the start property untracked (belongs in the date property)", () => {
			const source = createRawEventSource({
				filePath: "Events/stray.md",
				mtime: Date.now(),
				frontmatter: {
					start: "2024-01-15",
				},
				folder: "Events",
				isAllDay: false,
				isUntracked: false,
			});

			expect(parser.parseEventSource(source)).toBeNull();
		});

		it("should detect timed events from datetime format", () => {
			const source = createRawEventSource({
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					start: "2024-01-15 10:00",
				},
				folder: "Events",
				isAllDay: false,
				isUntracked: false,
			});

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			expect(events!.allDay).toBe(false);
		});

		it("should respect explicit all-day flag over time format", () => {
			const source = createRawEventSource({
				filePath: "Events/all-day-event.md",
				mtime: Date.now(),
				frontmatter: {
					Date: "2024-01-15",
					"All Day": true,
				},
				folder: "Events",
				isAllDay: true,
				isUntracked: false,
			});

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			expect(events!.allDay).toBe(true);
		});
	});

	describe("metadata handling", () => {
		it("should include file metadata in event", () => {
			settings.sortingStrategy = "none";
			settingsStore.next(settings);

			const source = createRawEventSource({
				filePath: "Projects/project-meeting.md",
				mtime: Date.now(),
				frontmatter: {
					start: "2024-01-15 10:00",
					priority: "high",
					status: "confirmed",
				},
				folder: "Projects",
				isAllDay: false,
				isUntracked: false,
			});

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();
			const event = events!;

			expect(event.meta).toEqual({
				folder: "Projects",
				isAllDay: false,
				// All frontmatter properties should be included for Frontmatter Display
				start: "2024-01-15 10:00",
				priority: "high",
				status: "confirmed",
			});
		});

		it("should generate stable event IDs", () => {
			const source = createRawEventSource({
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					start: "2024-01-15 10:00",
				},
				folder: "Events",
				isAllDay: false,
				isUntracked: false,
			});

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

			const source = createRawEventSource({
				filePath: "Events/meeting.md",
				mtime: Date.now(),
				frontmatter: {
					newStart: "2024-01-15 10:00", // Using new property name
				},
				folder: "Events",
				isAllDay: false,
				isUntracked: false,
			});

			const events = parser.parseEventSource(source);

			expect(events).toBeDefined();

			// Should use new default duration (90 minutes)
			if (isTimedEvent(events!)) {
				const startTime = DateTime.fromISO(events.start);
				const endTime = DateTime.fromISO(events.end);
				const durationMinutes = endTime.diff(startTime, "minutes").minutes;

				expect(durationMinutes).toBe(90);
			}
		});
	});

	describe("error handling", () => {
		it("should handle empty frontmatter gracefully", () => {
			const source = createRawEventSource({
				filePath: "Events/empty.md",
				mtime: Date.now(),
				frontmatter: {},
				folder: "Events",
				isAllDay: false,
				isUntracked: false,
			});

			const events = parser.parseEventSource(source);

			expect(events).toBeNull();
		});

		it("should handle null/undefined values in frontmatter", () => {
			const source = createRawEventSource({
				filePath: "Events/null-values.md",
				mtime: Date.now(),
				frontmatter: {
					start: null,
					end: undefined,
					title: "",
				},
				folder: "Events",
				isAllDay: false,
				isUntracked: false,
			});

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
			const parser = new Parser(
				mockApp as App,
				testSettingsStore,
				createMockMainSettingsStore([testSettings as SingleCalendarConfig]),
				testSettings.id
			);

			const source = createRawEventSource({
				filePath: "Tasks/enforce All Templates, Make it a one off script to enforce all frontmatter and templates..md",
				mtime: Date.now(),
				isUntracked: false,
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
				isAllDay: false,
			});

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
			const parser = new Parser(
				mockApp as App,
				defaultSettingsStore,
				createMockMainSettingsStore([defaultSettings as SingleCalendarConfig]),
				defaultSettings.id
			);

			const source = createRawEventSource({
				filePath: "Tasks/test-task.md",
				mtime: Date.now(),
				frontmatter: {
					"Start Date": "2025-09-05 22:21", // This should work with default settings
				},
				folder: "Tasks",
				isAllDay: false,
				isUntracked: false,
			});

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

	// Regression: two planning systems pointing at the same directory with
	// disagreeing (sortingStrategy, sortDateProp) used to thrash each other's
	// `Sort Date` writes on every parse, which corrupted the IDB cache. The
	// Parser now skips its sort-date side effect entirely while a conflict is
	// active.
	describe("normalization conflict guard", () => {
		function makeWritingCalendar(id: string, overrides: Partial<SingleCalendarConfig> = {}): SingleCalendarConfig {
			return {
				...createMockSingleCalendarSettings(),
				id,
				name: id,
				enabled: true,
				directory: "Tasks",
				indexSubdirectories: false,
				sortingStrategy: "allStartDate" as any,
				sortDateProp: "Sort Date",
				...overrides,
			} as SingleCalendarConfig;
		}

		function buildParser(calendars: SingleCalendarConfig[], selfId: string) {
			const fakeFile = createMockFile("Tasks/event.md", { basename: "event", extension: "md" });
			const processFrontMatter = vi.fn(async (_file: unknown, fn: (fm: Record<string, unknown>) => void) => fn({}));
			const app = createMockIntegrationApp({
				vault: { getAbstractFileByPath: vi.fn().mockReturnValue(fakeFile) } as any,
				fileManager: { processFrontMatter, renameFile: vi.fn().mockResolvedValue(undefined) } as any,
			});
			const self = calendars.find((c) => c.id === selfId);
			if (!self) throw new Error(`buildParser: no calendar with id ${selfId}`);
			const perCal = new BehaviorSubject<SingleCalendarConfig>(self);
			const main = createMockMainSettingsStore(calendars);
			const parser = new Parser(app as unknown as App, perCal, main, selfId);
			return { parser, processFrontMatter, main, perCal };
		}

		const seedSource = () =>
			createRawEventSource({
				filePath: "Tasks/event.md",
				mtime: Date.now(),
				frontmatter: { "Start Date": "2026-01-15 10:00" },
				folder: "Tasks",
				isAllDay: false,
				isUntracked: false,
			});

		it("writes Sort Date on parse when no other calendar overlaps", async () => {
			const { parser, processFrontMatter } = buildParser([makeWritingCalendar("solo")], "solo");

			const event = parser.parseEventSource(seedSource());
			expect(event).not.toBeNull();
			await new Promise((r) => window.setTimeout(r, 0));

			expect(processFrontMatter).toHaveBeenCalled();
		});

		it("suppresses Sort Date writes while a conflicting peer shares the directory", async () => {
			const writer = makeWritingCalendar("writer");
			const peer = makeWritingCalendar("peer", { sortingStrategy: "none" as any });
			const { parser, processFrontMatter } = buildParser([writer, peer], "writer");

			parser.parseEventSource(seedSource());
			await new Promise((r) => window.setTimeout(r, 0));

			expect(processFrontMatter).not.toHaveBeenCalled();
		});

		it("blocks the non-writing peer too — both sides of the conflict are silenced", async () => {
			const writer = makeWritingCalendar("writer");
			const peer = makeWritingCalendar("peer", { sortingStrategy: "none" as any });
			const { parser, processFrontMatter } = buildParser([writer, peer], "peer");

			// Peer would normally try to *delete* Sort Date here (strategy=none + prop in fm).
			parser.parseEventSource({
				...seedSource(),
				frontmatter: { "Start Date": "2026-01-15 10:00", "Sort Date": "2026-01-15T10:00:00" },
			} as any);
			await new Promise((r) => window.setTimeout(r, 0));

			expect(processFrontMatter).not.toHaveBeenCalled();
		});

		it("resumes writes when the conflict resolves via a settings change", async () => {
			const writer = makeWritingCalendar("writer");
			const peer = makeWritingCalendar("peer", { sortingStrategy: "none" as any });
			const { parser, processFrontMatter, main } = buildParser([writer, peer], "writer");

			parser.parseEventSource(seedSource());
			await new Promise((r) => window.setTimeout(r, 0));
			expect(processFrontMatter).not.toHaveBeenCalled();

			// User aligns the peer's strategy → conflict clears → next parse writes.
			main.settings$.next({
				...main.currentSettings,
				calendars: [writer, { ...peer, sortingStrategy: "allStartDate" as any }],
			});

			parser.parseEventSource(seedSource());
			await new Promise((r) => window.setTimeout(r, 0));

			expect(processFrontMatter).toHaveBeenCalled();
		});
	});
});
