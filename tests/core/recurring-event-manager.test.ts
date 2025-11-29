import { DateTime } from "luxon";
import { BehaviorSubject, Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecurringEventManager } from "../../src/core/recurring-event-manager";

// Mock the dependencies early
vi.mock("../../src/core/template-service");

const mockGetNextOccurrence = vi.fn();
const mockIsDateOnWeekdays = vi.fn();
const mockIterateOccurrencesInRange = vi.fn();

vi.mock("@real1ty-obsidian-plugins/utils/date-recurrence-utils", async () => {
	const actual = await vi.importActual("@real1ty-obsidian-plugins/utils/date-recurrence-utils");
	return {
		...actual,
		getNextOccurrence: mockGetNextOccurrence,
		isDateOnWeekdays: mockIsDateOnWeekdays,
		// Use the real function for calculateRecurringInstanceDateTime
		calculateRecurringInstanceDateTime: actual.calculateRecurringInstanceDateTime,
		// Return a generator function for iterateOccurrencesInRange
		iterateOccurrencesInRange: mockIterateOccurrencesInRange,
	};
});
vi.mock("utils/file-utils", () => ({
	sanitizeForFilename: vi.fn().mockReturnValue("test-event-2024-01-02"),
}));

describe("RecurringEventManager Physical Instance Logic", () => {
	let mockApp: any;
	let mockIndexer: any;
	let mockSettingsStore: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Setup mock implementations for date utilities
		mockGetNextOccurrence.mockImplementation(
			(currentDate: DateTime, recurrenceType: string, originalDateTime: DateTime) => {
				// Mock realistic next occurrence based on recurrence type
				switch (recurrenceType) {
					case "daily":
						return currentDate.plus({ days: 1 });
					case "weekly":
						return currentDate.plus({ weeks: 1 });
					case "bi-weekly":
						return currentDate.plus({ weeks: 2 });
					case "monthly":
					case "bi-monthly": {
						// For monthly, preserve the original day
						const monthsToAdd = recurrenceType === "monthly" ? 1 : 2;
						return currentDate.plus({ months: monthsToAdd }).set({ day: originalDateTime.day });
					}
					case "yearly":
						// For yearly, preserve the original month and day
						return currentDate.plus({ years: 1 }).set({
							month: originalDateTime.month,
							day: originalDateTime.day,
						});
					default:
						return currentDate.plus({ days: 1 });
				}
			}
		);

		mockIterateOccurrencesInRange.mockImplementation(function* (startDate, _rrules, rangeStart, rangeEnd) {
			// Simple mock generator: yield a few dates for testing purposes.
			let currentDate = startDate;
			for (let i = 0; i < 5; i++) {
				currentDate = currentDate.plus({ days: i + 1 });
				if (currentDate >= rangeStart && currentDate <= rangeEnd) {
					yield currentDate;
				}
			}
		});

		// Mock Obsidian App
		mockApp = {
			vault: {
				getMarkdownFiles: vi.fn(() => []),
				create: vi.fn(),
				getAbstractFileByPath: vi.fn(() => null), // Return null = file doesn't exist
				cachedRead: vi.fn().mockResolvedValue(""),
			},
			metadataCache: {
				getFileCache: vi.fn(() => null),
			},
			fileManager: {
				processFrontMatter: vi.fn().mockResolvedValue({}),
			},
		};

		// Mock Settings Store with single calendar settings
		const mockSingleSettings = {
			id: "default",
			name: "Main Calendar",
			enabled: true,
			directory: "Calendar",
			startProp: "Start Date",
			endProp: "End Date",
			allDayProp: "All Day",
			rruleProp: "RRule",
			rruleSpecProp: "RRuleSpec",
			rruleIdProp: "RRuleID",
			instanceDateProp: "Recurring Instance Date",
			futureInstancesCount: 2,
		};

		mockSettingsStore = {
			value: mockSingleSettings,
			subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
		};

		// Mock Indexer with simple event stream and indexing completion
		mockIndexer = {
			events$: new Subject(),
			indexingComplete$: new BehaviorSubject(true), // Default to completed for tests
		};
	});

	describe("Basic Physical Instance Creation", () => {
		it("should be able to instantiate RecurringEventManager", async () => {
			expect(() => {
				new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);
			}).not.toThrow();
		});

		it("should add recurring events to internal map", async () => {
			// No need to mock iterateOccurrencesInRange here, it's handled globally now

			// Using default calculateRecurringInstanceDateTime mock

			const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

			const mockRecurringEvent = {
				sourceFilePath: "test-recurring.md",
				title: "Weekly Meeting",
				rRuleId: "test-rrule-123",
				rrules: {
					type: "weekly" as const,
					weekdays: ["tuesday", "thursday"] as (
						| "sunday"
						| "monday"
						| "tuesday"
						| "wednesday"
						| "thursday"
						| "friday"
						| "saturday"
					)[],
					startTime: DateTime.fromISO("2024-01-01T10:00:00Z"),
					endTime: DateTime.fromISO("2024-01-01T11:00:00Z"),
					allDay: false,
				},
				frontmatter: {
					"Start Date": "2024-01-01T10:00:00Z",
				},
				futureInstancesCount: 2,
				content: "",
			};

			// Simulate the indexer finding a recurring event
			await (manager as any).handleIndexerEvent({
				type: "recurring-event-found",
				filePath: "recurring.md",
				recurringEvent: mockRecurringEvent,
			});

			// Test that it can generate virtual instances (indicates the event was added)
			const virtualEvents = await manager.generateAllVirtualInstances(
				DateTime.fromISO("2024-01-01"),
				DateTime.fromISO("2024-01-10")
			);

			// Should be able to generate events without errors
			expect(Array.isArray(virtualEvents)).toBe(true);
		});

		it("should find existing physical instances based on RRuleID", async () => {
			// Set indexing to incomplete to prevent auto-creation of instances
			// This test is specifically about tracking existing instances, not creating new ones
			mockIndexer.indexingComplete$ = new BehaviorSubject(false);

			// Mock existing files
			mockApp.vault.getMarkdownFiles.mockReturnValue([
				{ path: "Calendar/Meeting 2024-01-02.md", stat: { mtime: Date.now() } },
				{ path: "Calendar/Meeting 2024-01-04.md", stat: { mtime: Date.now() } },
			]);

			mockApp.metadataCache.getFileCache.mockImplementation((file: any) => {
				if (file.path.includes("2024-01-02")) {
					return {
						frontmatter: {
							RRuleID: "test-rrule-123",
							"Recurring Instance Date": "2024-01-02",
						},
					};
				}
				if (file.path.includes("2024-01-04")) {
					return {
						frontmatter: {
							RRuleID: "test-rrule-123",
							"Recurring Instance Date": "2024-01-04",
						},
					};
				}
				return null;
			});

			const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

			const mockRecurringEvent = {
				rRuleId: "test-rrule-123",
				title: "Meeting",
				rrules: {
					type: "weekly" as const,
					allDay: false,
					weekdays: [],
					startTime: DateTime.fromISO("2024-01-01T10:00:00"),
					endTime: DateTime.fromISO("2024-01-01T11:00:00"),
				},
				frontmatter: {},
				futureInstancesCount: 2,
				sourceFilePath: "recurring.md",
				content: "",
			};

			// The new implementation tracks physical instances automatically through indexer events
			// So we need to simulate physical instance files being detected
			// Simulate the indexer finding a recurring event
			await (manager as any).handleIndexerEvent({
				type: "recurring-event-found",
				filePath: "recurring.md",
				recurringEvent: mockRecurringEvent,
			});

			// Simulate file-changed events for physical instances
			await (manager as any).handleFileChanged("Calendar/Meeting 2024-01-02.md", {
				RRuleID: "test-rrule-123",
				"Recurring Instance Date": "2024-01-02",
			});
			await (manager as any).handleFileChanged("Calendar/Meeting 2024-01-04.md", {
				RRuleID: "test-rrule-123",
				"Recurring Instance Date": "2024-01-04",
			});

			// Check that physical instances are tracked in the map
			const recurringData = (manager as any).recurringEventsMap.get("test-rrule-123");
			expect(recurringData.physicalInstances.size).toBe(2);
			expect(recurringData.physicalInstances.has("2024-01-02")).toBe(true);
			expect(recurringData.physicalInstances.has("2024-01-04")).toBe(true);
		});

		it("should exclude physical instance dates from virtual generation", async () => {
			// Mock date utility functions
			mockGetNextOccurrence
				.mockReturnValueOnce(DateTime.fromISO("2024-01-02"))
				.mockReturnValueOnce(DateTime.fromISO("2024-01-04"))
				.mockReturnValueOnce(DateTime.fromISO("2024-01-06"));

			mockIsDateOnWeekdays.mockReturnValue(true);
			// Using default calculateRecurringInstanceDateTime mock

			// Mock existing physical instance
			mockApp.vault.getMarkdownFiles.mockReturnValue([
				{ path: "Calendar/Meeting 2024-01-02.md", stat: { mtime: Date.now() } },
			]);

			mockApp.metadataCache.getFileCache.mockReturnValue({
				frontmatter: {
					RRuleID: "test-rrule-123",
					"Recurring Instance Date": "2024-01-02",
				},
			});

			const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

			const mockRecurringEvent = {
				rRuleId: "test-rrule-123",
				title: "Meeting",
				rrules: {
					type: "weekly" as const,
					weekdays: ["tuesday", "thursday"] as (
						| "sunday"
						| "monday"
						| "tuesday"
						| "wednesday"
						| "thursday"
						| "friday"
						| "saturday"
					)[],
					startTime: DateTime.fromISO("2024-01-01T10:00:00Z"),
					endTime: DateTime.fromISO("2024-01-01T11:00:00Z"),
					allDay: false,
				},
				frontmatter: {
					"Start Date": "2024-01-01T10:00:00Z",
				},
				futureInstancesCount: 2,
				sourceFilePath: "recurring.md",
				content: "",
			};

			// Simulate the indexer finding a recurring event
			await (manager as any).handleIndexerEvent({
				type: "recurring-event-found",
				filePath: "recurring.md",
				recurringEvent: mockRecurringEvent,
			});

			// Simulate a physical instance for 2024-01-02
			await (manager as any).handleFileChanged("Calendar/Meeting 2024-01-02.md", {
				RRuleID: "test-rrule-123",
				"Recurring Instance Date": "2024-01-02",
			});

			const virtualEvents = await manager.generateAllVirtualInstances(
				DateTime.fromISO("2024-01-01"),
				DateTime.fromISO("2024-01-10")
			);

			// Virtual events should not include the date that has a physical instance (2024-01-02)
			const eventIds = virtualEvents.map((event) => event.id);
			const hasPhysicalDate = eventIds.some((id) => id.includes("2024-01-02"));

			expect(hasPhysicalDate).toBe(false);
		});
	});

	describe("Settings Integration", () => {
		it("should use futureInstancesCount from recurring event", async () => {
			const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

			const mockRecurringEvent = {
				rRuleId: "test-rrule-123",
				title: "Meeting",
				futureInstancesCount: 5, // Different from settings default
				rrules: {
					type: "daily" as const,
					allDay: false,
					weekdays: [],
					startTime: DateTime.fromISO("2024-01-01T10:00:00"),
					endTime: DateTime.fromISO("2024-01-01T11:00:00"),
				},
				frontmatter: { "Start Date": "2024-01-01T10:00:00" },
				sourceFilePath: "recurring.md",
				content: "",
			};

			// Test that the event stores the correct future instance count
			// Simulate the indexer finding a recurring event
			await (manager as any).handleIndexerEvent({
				type: "recurring-event-found",
				filePath: "recurring.md",
				recurringEvent: mockRecurringEvent,
			});

			// Access the internal storage to verify
			const recurringData = (manager as any).recurringEventsMap.get("test-rrule-123");
			expect(recurringData.recurringEvent.futureInstancesCount).toBe(5);
		});
	});

	describe("Recurrence Type Specific Logic", () => {
		describe("Daily Recurrence", () => {
			it("should create all-day daily instances correctly", async () => {
				const { TemplateService } = await import("../../src/core/templates");

				// Mock template service to capture frontmatter operations
				const mockFile = { path: "test.md" };
				const mockCreate = vi.fn().mockResolvedValue(mockFile);
				(TemplateService as any).prototype.createFile = mockCreate;

				const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

				const mockRecurringEvent = {
					rRuleId: "daily-all-day-123",
					title: "Daily All Day Event",
					rrules: {
						type: "daily" as const,
						allDay: true,
						date: DateTime.fromISO("2024-01-15"), // All-day events use date field
						startTime: undefined,
						endTime: undefined,
						weekdays: [],
					},
					frontmatter: {
						Date: "2024-01-15", // All-day uses Date property
					},
					futureInstancesCount: 2,
					sourceFilePath: "recurring.md",
					content: "",
				};

				// Simulate adding the recurring event
				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: "recurring.md",
					recurringEvent: mockRecurringEvent,
				});

				// Trigger physical instance creation
				await (manager as any).ensurePhysicalInstances("daily-all-day-123");

				// Verify createFile was called with correct frontmatter
				expect(mockCreate).toHaveBeenCalled();
				const createCall = mockCreate.mock.calls[0][0];
				const frontmatter = createCall.frontmatter;

				// For daily all-day events, should preserve all-day status
				expect(frontmatter["All Day"]).toBe(true);
				// All-day events should use Date property, not Start Date
				expect(frontmatter.Date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
				expect(frontmatter["Start Date"]).toBeUndefined();
				expect(frontmatter["End Date"]).toBeUndefined();
			});

			it("should create timed daily instances with correct time extraction", async () => {
				const { TemplateService } = await import("../../src/core/templates");

				// Mock template service
				const mockFile = { path: "test.md" };
				const mockCreate = vi.fn().mockResolvedValue(mockFile);
				(TemplateService as any).prototype.createFile = mockCreate;

				const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

				const mockRecurringEvent = {
					rRuleId: "daily-timed-123",
					title: "Daily Timed Event",
					rrules: {
						type: "daily" as const,
						allDay: false,
						startTime: DateTime.fromISO("2024-01-01T09:30:00Z"), // Should extract this time
						endTime: DateTime.fromISO("2024-01-01T10:15:00Z"), // Should extract this time
						weekdays: [],
					},
					frontmatter: {
						"Start Date": "2024-01-15T14:00:00Z",
						"End Date": "2024-01-15T15:30:00Z",
					},
					futureInstancesCount: 2,
					sourceFilePath: "recurring.md",
					content: "",
				};

				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: "recurring.md",
					recurringEvent: mockRecurringEvent,
				});

				await (manager as any).ensurePhysicalInstances("daily-timed-123");

				// Verify createFile was called with correct frontmatter
				expect(mockCreate).toHaveBeenCalled();
				const createCall = mockCreate.mock.calls[0][0];
				const frontmatter = createCall.frontmatter;

				// For daily timed events, should use extracted time (09:30-10:15) not original time (14:00-15:30)
				expect(frontmatter["All Day"]).toBe(false);
				expect(frontmatter["Start Date"]).toMatch(/T09:30:00/);
				expect(frontmatter["End Date"]).toMatch(/T10:15:00/);
			});
		});

		describe("Weekly/Bi-Weekly Recurrence", () => {
			it("should create weekly instances with time extraction", async () => {
				const { TemplateService } = await import("../../src/core/templates");

				const mockFile = { path: "test.md" };
				const mockCreate = vi.fn().mockResolvedValue(mockFile);
				(TemplateService as any).prototype.createFile = mockCreate;

				const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

				const mockRecurringEvent = {
					rRuleId: "weekly-123",
					title: "Weekly Meeting",
					rrules: {
						type: "weekly" as const,
						allDay: false,
						startTime: DateTime.fromISO("2024-01-01T10:00:00Z"), // Should extract this time
						endTime: DateTime.fromISO("2024-01-01T11:30:00Z"), // Should extract this time
						weekdays: ["tuesday", "thursday"] as const,
					},
					frontmatter: {
						"Start Date": "2024-01-15T16:45:00", // Original time should be ignored
						"End Date": "2024-01-15T18:00:00", // Original time should be ignored
					},
					futureInstancesCount: 2,
					sourceFilePath: "recurring.md",
					content: "",
				};

				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: "recurring.md",
					recurringEvent: mockRecurringEvent,
				});

				await (manager as any).ensurePhysicalInstances("weekly-123");

				expect(mockCreate).toHaveBeenCalled();
				const createCall = mockCreate.mock.calls[0][0];
				const frontmatter = createCall.frontmatter;

				// For weekly events, should use extracted time (10:00-11:30) not original (16:45-18:00)
				expect(frontmatter["All Day"]).toBe(false);
				expect(frontmatter["Start Date"]).toMatch(/T10:00:00/);
				expect(frontmatter["End Date"]).toMatch(/T11:30:00/);
			});

			it("should create bi-weekly instances with time extraction", async () => {
				const { TemplateService } = await import("../../src/core/templates");

				const mockFile = { path: "test.md" };
				const mockCreate = vi.fn().mockResolvedValue(mockFile);
				(TemplateService as any).prototype.createFile = mockCreate;

				const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

				const mockRecurringEvent = {
					rRuleId: "bi-weekly-123",
					title: "Bi-Weekly Standup",
					rrules: {
						type: "bi-weekly" as const,
						allDay: false,
						startTime: DateTime.fromISO("2024-01-01T09:15:00Z"), // Should extract this time
						endTime: DateTime.fromISO("2024-01-01T10:00:00Z"), // Should extract this time
						weekdays: ["monday", "friday"] as const,
					},
					frontmatter: {
						"Start Date": "2024-01-15T13:20:00", // Original time should be ignored
						"End Date": "2024-01-15T14:45:00", // Original time should be ignored
					},
					futureInstancesCount: 2,
					sourceFilePath: "recurring.md",
					content: "",
				};

				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: "recurring.md",
					recurringEvent: mockRecurringEvent,
				});

				await (manager as any).ensurePhysicalInstances("bi-weekly-123");

				expect(mockCreate).toHaveBeenCalled();
				const createCall = mockCreate.mock.calls[0][0];
				const frontmatter = createCall.frontmatter;

				// For bi-weekly events, should use extracted time (09:15-10:00) not original (13:20-14:45)
				expect(frontmatter["All Day"]).toBe(false);
				expect(frontmatter["Start Date"]).toMatch(/T09:15:00/);
				expect(frontmatter["End Date"]).toMatch(/T10:00:00/);
			});
		});

		describe("Monthly Recurrence", () => {
			it("should create monthly all-day instances inheriting day of month", async () => {
				const { TemplateService } = await import("../../src/core/templates");

				const mockFile = { path: "test.md" };
				const mockCreate = vi.fn().mockResolvedValue(mockFile);
				(TemplateService as any).prototype.createFile = mockCreate;

				const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

				const mockRecurringEvent = {
					rRuleId: "monthly-all-day-123",
					title: "Monthly Review",
					rrules: {
						type: "monthly" as const,
						allDay: true,
						date: DateTime.fromISO("2024-01-15"), // 15th of January - should inherit day 15
						startTime: undefined,
						endTime: undefined,
						weekdays: [],
					},
					frontmatter: {
						Date: "2024-01-15", // 15th of January - should inherit day 15
					},
					futureInstancesCount: 2,
					sourceFilePath: "recurring.md",
					content: "",
				};

				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: "recurring.md",
					recurringEvent: mockRecurringEvent,
				});

				await (manager as any).ensurePhysicalInstances("monthly-all-day-123");

				expect(mockCreate).toHaveBeenCalled();
				const createCall = mockCreate.mock.calls[0][0];
				const frontmatter = createCall.frontmatter;

				// For monthly all-day events, should inherit the day (15th) and be all-day
				expect(frontmatter["All Day"]).toBe(true);
				// All-day events should use Date property, not Start Date
				expect(frontmatter.Date).toMatch(/^\d{4}-\d{2}-15$/); // Should be 15th day of the month
				expect(frontmatter["Start Date"]).toBeUndefined();
				expect(frontmatter["End Date"]).toBeUndefined();
			});

			it("should create monthly timed instances inheriting day and time", async () => {
				const { TemplateService } = await import("../../src/core/templates");

				const mockFile = { path: "test.md" };
				const mockCreate = vi.fn().mockResolvedValue(mockFile);
				(TemplateService as any).prototype.createFile = mockCreate;

				const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

				const mockRecurringEvent = {
					rRuleId: "monthly-timed-123",
					title: "Monthly Planning",
					rrules: {
						type: "monthly" as const,
						allDay: false,
						startTime: DateTime.fromISO("2024-01-25T14:30:00Z"), // 25th at 14:30 - should inherit both day and time
						endTime: DateTime.fromISO("2024-01-25T16:00:00Z"), // 25th at 16:00 - should inherit both day and time
						weekdays: [],
					},
					frontmatter: {
						"Start Date": "2024-01-25T14:30:00", // 25th at 14:30 - should inherit both day and time
						"End Date": "2024-01-25T16:00:00", // 25th at 16:00 - should inherit both day and time
					},
					futureInstancesCount: 2,
					sourceFilePath: "recurring.md",
					content: "",
				};

				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: "recurring.md",
					recurringEvent: mockRecurringEvent,
				});

				await (manager as any).ensurePhysicalInstances("monthly-timed-123");

				expect(mockCreate).toHaveBeenCalled();
				const createCall = mockCreate.mock.calls[0][0];
				const frontmatter = createCall.frontmatter;

				// For monthly timed events, should inherit day (25th) and time (14:30-16:00)
				expect(frontmatter["All Day"]).toBe(false);
				expect(frontmatter["Start Date"]).toMatch(/-25T14:30:00/); // Should be 25th at 14:30
				expect(frontmatter["End Date"]).toMatch(/-25T16:00:00/); // Should be 25th at 16:00
			});
		});

		describe("Yearly Recurrence", () => {
			it("should create yearly all-day instances inheriting day and month", async () => {
				const { TemplateService } = await import("../../src/core/templates");

				const mockFile = { path: "test.md" };
				const mockCreate = vi.fn().mockResolvedValue(mockFile);
				(TemplateService as any).prototype.createFile = mockCreate;

				const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

				const mockRecurringEvent = {
					rRuleId: "yearly-all-day-123",
					title: "Annual Conference",
					rrules: {
						type: "yearly" as const,
						allDay: true,
						date: DateTime.fromISO("2024-06-20"), // June 20th - should inherit month and day
						startTime: undefined,
						endTime: undefined,
						weekdays: [],
					},
					frontmatter: {
						Date: "2024-06-20", // June 20th - should inherit month and day
					},
					futureInstancesCount: 2,
					sourceFilePath: "recurring.md",
					content: "",
				};

				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: "recurring.md",
					recurringEvent: mockRecurringEvent,
				});

				await (manager as any).ensurePhysicalInstances("yearly-all-day-123");

				expect(mockCreate).toHaveBeenCalled();
				const createCall = mockCreate.mock.calls[0][0];
				const frontmatter = createCall.frontmatter;

				// For yearly all-day events, should inherit month (06) and day (20)
				expect(frontmatter["All Day"]).toBe(true);
				// All-day events should use Date property, not Start Date
				expect(frontmatter.Date).toMatch(/-06-20$/); // Should be June 20th
				expect(frontmatter["Start Date"]).toBeUndefined();
				expect(frontmatter["End Date"]).toBeUndefined();
			});

			it("should create yearly timed instances inheriting day, month and time", async () => {
				const { TemplateService } = await import("../../src/core/templates");

				const mockFile = { path: "test.md" };
				const mockCreate = vi.fn().mockResolvedValue(mockFile);
				(TemplateService as any).prototype.createFile = mockCreate;

				const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

				const mockRecurringEvent = {
					rRuleId: "yearly-timed-123",
					title: "Birthday Party",
					rrules: {
						type: "yearly" as const,
						allDay: false,
						startTime: DateTime.fromISO("2024-03-12T18:00:00Z"), // March 12th at 18:00 - should inherit all
						endTime: DateTime.fromISO("2024-03-12T22:30:00Z"), // March 12th at 22:30 - should inherit all
						weekdays: [],
					},
					frontmatter: {
						"Start Date": "2024-03-12T18:00:00", // March 12th at 18:00 - should inherit all
						"End Date": "2024-03-12T22:30:00", // March 12th at 22:30 - should inherit all
					},
					futureInstancesCount: 2,
					sourceFilePath: "recurring.md",
					content: "",
				};

				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: "recurring.md",
					recurringEvent: mockRecurringEvent,
				});

				await (manager as any).ensurePhysicalInstances("yearly-timed-123");

				expect(mockCreate).toHaveBeenCalled();
				const createCall = mockCreate.mock.calls[0][0];
				const frontmatter = createCall.frontmatter;

				// For yearly timed events, should inherit month (03), day (12) and time (18:00-22:30)
				expect(frontmatter["All Day"]).toBe(false);
				expect(frontmatter["Start Date"]).toMatch(/-03-12T18:00:00/); // Should be March 12th at 18:00
				expect(frontmatter["End Date"]).toMatch(/-03-12T22:30:00/); // Should be March 12th at 22:30
			});
		});

		describe("Virtual Instance Generation", () => {
			it.skip("should generate virtual instances with correct date/time logic for different recurrence types", async () => {
				const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

				const monthlyRecurringEvent = {
					rRuleId: "monthly-virtual-123",
					title: "Monthly Virtual Meeting",
					rrules: {
						type: "monthly" as const,
						allDay: false,
						startTime: DateTime.fromISO("2024-01-15T14:30:00Z"), // January 15th
						endTime: DateTime.fromISO("2024-01-15T16:00:00Z"),
						weekdays: [],
					},
					frontmatter: {
						"Start Date": "2024-01-15T14:30:00.000Z",
						"End Date": "2024-01-15T16:00:00.000Z",
					},
					futureInstancesCount: 0, // No physical instances - test pure virtual generation
					sourceFilePath: "recurring.md",
					content: "",
				};

				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: "recurring.md",
					recurringEvent: monthlyRecurringEvent,
				});

				// Query virtual events starting from February (first after source)
				// With no physical instances, virtuals should start from Feb 15 onwards
				const virtualEvents = await manager.generateAllVirtualInstances(
					DateTime.fromISO("2024-02-01"),
					DateTime.fromISO("2024-03-31")
				);

				// Should generate virtual events for February and March
				// Times should match source (14:30 and 16:00)
				expect(virtualEvents).toHaveLength(2);
				expect(virtualEvents[0].start).toMatch(/2024-02-15T14:30:00/);
				expect(virtualEvents[0].end).toMatch(/2024-02-15T16:00:00/);
				expect(virtualEvents[1].start).toMatch(/2024-03-15T14:30:00/);
				expect(virtualEvents[1].end).toMatch(/2024-03-15T16:00:00/);
			});
		});
	});

	describe("Calendar Notification After Rapid Recurring Event Generation", () => {
		it("should notify subscribers after bulk recurring event processing completes", async () => {
			const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

			// Mock the subscribe method to track notifications
			const notificationCallback = vi.fn();
			manager.subscribe(notificationCallback);

			// Create multiple recurring events that will generate physical instances
			const recurringEvents = [
				{
					rRuleId: "daily-event-1",
					title: "Daily Event 1",
					rrules: {
						type: "daily" as const,
						allDay: false,
						startTime: DateTime.fromISO("2024-01-01T10:00:00Z"),
						endTime: DateTime.fromISO("2024-01-01T11:00:00Z"),
						weekdays: [],
					},
					frontmatter: {
						"Start Date": "2024-01-01T10:00:00.000Z",
					},
					sourceFilePath: "daily1.md",
					content: "Daily event content",
				},
				{
					rRuleId: "daily-event-2",
					title: "Daily Event 2",
					rrules: {
						type: "daily" as const,
						allDay: false,
						startTime: DateTime.fromISO("2024-01-01T14:00:00Z"),
						endTime: DateTime.fromISO("2024-01-01T15:00:00Z"),
						weekdays: [],
					},
					frontmatter: {
						"Start Date": "2024-01-01T14:00:00.000Z",
					},
					sourceFilePath: "daily2.md",
					content: "Daily event content 2",
				},
				{
					rRuleId: "weekly-event",
					title: "Weekly Event",
					rrules: {
						type: "weekly" as const,
						allDay: false,
						startTime: DateTime.fromISO("2024-01-01T09:00:00Z"),
						endTime: DateTime.fromISO("2024-01-01T10:00:00Z"),
						weekdays: [1], // Monday
					},
					frontmatter: {
						"Start Date": "2024-01-01T09:00:00.000Z",
					},
					sourceFilePath: "weekly.md",
					content: "Weekly event content",
				},
			];

			// Add all recurring events
			for (const event of recurringEvents) {
				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: event.sourceFilePath,
					recurringEvent: event,
				});
			}

			// Clear notification callback calls from adding events
			notificationCallback.mockClear();

			// Trigger indexing complete which should process all recurring events
			mockIndexer.indexingComplete$.next(true);

			// Wait for async processing to complete
			await new Promise((resolve) => setTimeout(resolve, 200));

			// Should have received at least one notification after processing completes
			expect(notificationCallback).toHaveBeenCalled();

			// Verify the notification was called (could be multiple times during debouncing)
			expect(notificationCallback.mock.calls.length).toBeGreaterThanOrEqual(1);
		});

		it("should flush pending debounced refreshes when processing completes", async () => {
			const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

			const notificationCallback = vi.fn();
			manager.subscribe(notificationCallback);

			// Create a recurring event
			const recurringEvent = {
				rRuleId: "test-event",
				title: "Test Event",
				rrules: {
					type: "daily" as const,
					allDay: false,
					startTime: DateTime.fromISO("2024-01-01T10:00:00Z"),
					endTime: DateTime.fromISO("2024-01-01T11:00:00Z"),
					weekdays: [],
				},
				frontmatter: {
					"Start Date": "2024-01-01T10:00:00.000Z",
				},
				sourceFilePath: "test.md",
				content: "Test content",
			};

			await (manager as any).handleIndexerEvent({
				type: "recurring-event-found",
				filePath: "test.md",
				recurringEvent,
			});

			notificationCallback.mockClear();

			// Simulate rapid file changes (which would normally be debounced)
			for (let i = 0; i < 5; i++) {
				await (manager as any).handleFileChanged(`instance-${i}.md`, {
					RRuleID: "test-event",
					"Recurring Instance Date": `2024-01-0${i + 2}`,
				});
			}

			// Without flush, notifications would be debounced
			// Trigger indexing complete to flush pending refreshes
			mockIndexer.indexingComplete$.next(true);

			// Wait a bit for the flush to happen
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Should have been notified immediately without waiting for debounce timeout
			expect(notificationCallback).toHaveBeenCalled();
		});

		it("should notify after individual recurring event is added when indexing is already complete", async () => {
			const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

			// Set indexing as complete first
			mockIndexer.indexingComplete$.next(true);
			await new Promise((resolve) => setTimeout(resolve, 50));

			const notificationCallback = vi.fn();
			manager.subscribe(notificationCallback);

			// Add a recurring event after indexing is complete
			const recurringEvent = {
				rRuleId: "new-event",
				title: "New Event",
				rrules: {
					type: "daily" as const,
					allDay: false,
					startTime: DateTime.fromISO("2024-01-01T10:00:00Z"),
					endTime: DateTime.fromISO("2024-01-01T11:00:00Z"),
					weekdays: [],
				},
				frontmatter: {
					"Start Date": "2024-01-01T10:00:00.000Z",
				},
				sourceFilePath: "new.md",
				content: "New content",
			};

			await (manager as any).handleIndexerEvent({
				type: "recurring-event-found",
				filePath: "new.md",
				recurringEvent,
			});

			// Wait for async instance creation
			await new Promise((resolve) => setTimeout(resolve, 200));

			// Should have been notified after adding the event and creating instances
			expect(notificationCallback).toHaveBeenCalled();
		});
	});

	describe("Deterministic File Path Generation", () => {
		it("should generate deterministic file paths based on (rRuleId, date)", async () => {
			const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

			const recurringEvent = {
				rRuleId: "1730000000000-abc12",
				title: "Test Event",
				rrules: {
					type: "daily" as const,
					allDay: false,
					startTime: DateTime.fromISO("2024-01-01T10:00:00Z"),
					endTime: DateTime.fromISO("2024-01-01T11:00:00Z"),
					weekdays: [],
				},
				frontmatter: {
					"Start Date": "2024-01-01T10:00:00.000Z",
				},
				sourceFilePath: "source.md",
				content: "Test content",
			};

			const instanceDate = DateTime.fromISO("2024-01-15T00:00:00Z");

			// Generate path twice - should be identical
			const path1 = (manager as any).generateNodeInstanceFilePath(recurringEvent, instanceDate);
			const path2 = (manager as any).generateNodeInstanceFilePath(recurringEvent, instanceDate);

			expect(path1).toBe(path2);
			expect(path1).toMatch(/Test Event 2024-01-15-\d{14}\.md$/);

			manager.destroy();
		});

		it("should generate different paths for different dates", async () => {
			const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

			const recurringEvent = {
				rRuleId: "1730000000000-abc12",
				title: "Test Event",
				rrules: {
					type: "daily" as const,
					allDay: false,
					startTime: DateTime.fromISO("2024-01-01T10:00:00Z"),
					endTime: DateTime.fromISO("2024-01-01T11:00:00Z"),
					weekdays: [],
				},
				frontmatter: {
					"Start Date": "2024-01-01T10:00:00.000Z",
				},
				sourceFilePath: "source.md",
				content: "Test content",
			};

			const date1 = DateTime.fromISO("2024-01-15T00:00:00Z");
			const date2 = DateTime.fromISO("2024-01-16T00:00:00Z");

			const path1 = (manager as any).generateNodeInstanceFilePath(recurringEvent, date1);
			const path2 = (manager as any).generateNodeInstanceFilePath(recurringEvent, date2);

			expect(path1).not.toBe(path2);
			expect(path1).toContain("2024-01-15");
			expect(path2).toContain("2024-01-16");

			// But both should have the same zettel hash (from same rRuleId)
			const hash1 = path1.match(/-(\d{14})\.md$/)?.[1];
			const hash2 = path2.match(/-(\d{14})\.md$/)?.[1];
			expect(hash1).toBe(hash2);

			manager.destroy();
		});

		it("should generate different paths for different rRuleIds", async () => {
			const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

			const event1 = {
				rRuleId: "1730000000000-abc12",
				title: "Test Event",
				rrules: {
					type: "daily" as const,
					allDay: false,
					startTime: DateTime.fromISO("2024-01-01T10:00:00Z"),
					endTime: DateTime.fromISO("2024-01-01T11:00:00Z"),
					weekdays: [],
				},
				frontmatter: {},
				sourceFilePath: "source1.md",
				content: "Test content",
			};

			const event2 = {
				...event1,
				rRuleId: "1730000000000-xyz99",
				sourceFilePath: "source2.md",
			};

			const instanceDate = DateTime.fromISO("2024-01-15T00:00:00Z");

			const path1 = (manager as any).generateNodeInstanceFilePath(event1, instanceDate);
			const path2 = (manager as any).generateNodeInstanceFilePath(event2, instanceDate);

			expect(path1).not.toBe(path2);

			// Dates should be the same
			expect(path1).toContain("2024-01-15");
			expect(path2).toContain("2024-01-15");

			// But zettel hashes should be different
			const hash1 = path1.match(/-(\d{14})\.md$/)?.[1];
			const hash2 = path2.match(/-(\d{14})\.md$/)?.[1];
			expect(hash1).not.toBe(hash2);

			manager.destroy();
		});

		it("should not create duplicate instances if file already exists", async () => {
			const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

			const recurringEvent = {
				rRuleId: "1730000000000-abc12",
				title: "Test Event",
				rrules: {
					type: "daily" as const,
					allDay: false,
					startTime: DateTime.fromISO("2024-01-01T10:00:00Z"),
					endTime: DateTime.fromISO("2024-01-01T11:00:00Z"),
					weekdays: [],
				},
				frontmatter: {
					"Start Date": "2024-01-01T10:00:00.000Z",
				},
				sourceFilePath: "source.md",
				content: "Test content",
			};

			const instanceDate = DateTime.fromISO("2024-01-15T00:00:00Z");
			const expectedPath = (manager as any).generateNodeInstanceFilePath(recurringEvent, instanceDate);

			// Simulate file already exists
			vi.mocked(mockApp.vault.getAbstractFileByPath).mockReturnValueOnce({
				path: expectedPath,
				basename: "Test Event 2024-01-15-12345678901234",
			} as any);

			// Try to create instance - should return null (not created)
			const result = await (manager as any).createPhysicalInstance(recurringEvent, instanceDate);

			expect(result).toBeNull();
			expect(mockApp.vault.create).not.toHaveBeenCalled();

			manager.destroy();
		});

		it("should create instance if file does not exist", async () => {
			const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

			const recurringEvent = {
				rRuleId: "1730000000000-abc12",
				title: "Test Event",
				rrules: {
					type: "daily" as const,
					allDay: false,
					startTime: DateTime.fromISO("2024-01-01T10:00:00Z"),
					endTime: DateTime.fromISO("2024-01-01T11:00:00Z"),
					weekdays: [],
				},
				frontmatter: {
					"Start Date": "2024-01-01T10:00:00.000Z",
				},
				sourceFilePath: "source.md",
				content: "Test content",
			};

			const instanceDate = DateTime.fromISO("2024-01-15T00:00:00Z");

			// File doesn't exist
			vi.mocked(mockApp.vault.getAbstractFileByPath).mockReturnValue(null);

			// Try to create instance - should succeed
			const result = await (manager as any).createPhysicalInstance(recurringEvent, instanceDate);

			expect(result).toBeTruthy();
			expect(result).toMatch(/Test Event 2024-01-15-\d{14}\.md$/);

			manager.destroy();
		});

		it("should prevent race condition with deterministic paths", async () => {
			const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

			const recurringEvent = {
				rRuleId: "1730000000000-abc12",
				title: "Test Event",
				rrules: {
					type: "daily" as const,
					allDay: false,
					startTime: DateTime.fromISO("2024-01-01T10:00:00Z"),
					endTime: DateTime.fromISO("2024-01-01T11:00:00Z"),
					weekdays: [],
				},
				frontmatter: {
					"Start Date": "2024-01-01T10:00:00.000Z",
				},
				sourceFilePath: "source.md",
				content: "Test content",
			};

			const instanceDate = DateTime.fromISO("2024-01-15T00:00:00Z");

			// First call: file doesn't exist, create it
			vi.mocked(mockApp.vault.getAbstractFileByPath).mockReturnValueOnce(null);

			const result1 = await (manager as any).createPhysicalInstance(recurringEvent, instanceDate);
			expect(result1).toBeTruthy();

			// Second call: file now exists (from first call)
			const createdPath = result1;
			vi.mocked(mockApp.vault.getAbstractFileByPath).mockReturnValueOnce({
				path: createdPath,
				basename: createdPath.split("/").pop()?.replace(".md", ""),
			} as any);

			const result2 = await (manager as any).createPhysicalInstance(recurringEvent, instanceDate);
			expect(result2).toBeNull(); // Should not create duplicate

			// Both attempts used the same deterministic path
			expect(result1).toBe(createdPath);

			manager.destroy();
		});

		it("should use consistent zettel hash for same rRuleId across title changes", async () => {
			const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

			const instanceDate = DateTime.fromISO("2024-01-15T00:00:00Z");

			const event1 = {
				rRuleId: "1730000000000-abc12",
				title: "Original Title",
				rrules: {
					type: "daily" as const,
					allDay: false,
					startTime: DateTime.fromISO("2024-01-01T10:00:00Z"),
					endTime: DateTime.fromISO("2024-01-01T11:00:00Z"),
					weekdays: [],
				},
				frontmatter: {},
				sourceFilePath: "source.md",
				content: "Test content",
			};

			const event2 = {
				...event1,
				title: "Updated Title",
			};

			const path1 = (manager as any).generateNodeInstanceFilePath(event1, instanceDate);
			const path2 = (manager as any).generateNodeInstanceFilePath(event2, instanceDate);

			// Paths should be different (different titles)
			expect(path1).not.toBe(path2);

			// But zettel hashes should be identical (same rRuleId)
			const hash1 = path1.match(/-(\d{14})\.md$/)?.[1];
			const hash2 = path2.match(/-(\d{14})\.md$/)?.[1];
			expect(hash1).toBe(hash2);

			// Title parts should be different
			expect(path1).toContain("Original Title");
			expect(path2).toContain("Updated Title");

			manager.destroy();
		});
	});
});
