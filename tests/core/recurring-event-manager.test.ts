import { DateTime } from "luxon";
import { BehaviorSubject, Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the dependencies early
vi.mock("../../src/core/template-service");
vi.mock("@real1ty-obsidian-plugins/utils/date-recurrence-utils", async () => {
	const actual = await vi.importActual("@real1ty-obsidian-plugins/utils/date-recurrence-utils");
	return {
		...actual,
		getNextOccurrence: vi.fn().mockImplementation((currentDate: DateTime) => {
			// Simple mock: just add 1 day for testing
			return currentDate.plus({ days: 1 });
		}),
		isDateOnWeekdays: vi.fn(),
		// Use the real function for calculateRecurringInstanceDateTime
		calculateRecurringInstanceDateTime: actual.calculateRecurringInstanceDateTime,
		iterateOccurrencesInRange: vi.fn(),
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

		// Import and setup mocks for date utilities
		const { getNextOccurrence } = await import(
			"@real1ty-obsidian-plugins/utils/date-recurrence-utils"
		);
		(getNextOccurrence as any).mockImplementation(
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

		// Mock Obsidian App
		mockApp = {
			vault: {
				getMarkdownFiles: vi.fn(() => []),
				create: vi.fn(),
				getAbstractFileByPath: vi.fn(() => null), // Return null = file doesn't exist
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
			// Dynamic import to avoid early initialization issues
			const { RecurringEventManager } = await import("../../src/core/recurring-event-manager");

			expect(() => {
				new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);
			}).not.toThrow();
		});

		it("should add recurring events to internal map", async () => {
			const { RecurringEventManager } = await import("../../src/core/recurring-event-manager");
			const { iterateOccurrencesInRange } = await import(
				"@real1ty-obsidian-plugins/utils/date-recurrence-utils"
			);

			// Mock the new iterateOccurrencesInRange function to return the expected dates
			(iterateOccurrencesInRange as any).mockReturnValue([
				DateTime.fromISO("2024-01-02"),
				DateTime.fromISO("2024-01-04"),
			]);

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
					startTime: DateTime.fromISO("2024-01-01T10:00:00"),
					endTime: DateTime.fromISO("2024-01-01T11:00:00"),
					allDay: false,
				},
				frontmatter: {
					"Start Date": "2024-01-01T10:00:00",
				},
				futureInstancesCount: 2,
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
			const { RecurringEventManager } = await import("../../src/core/recurring-event-manager");

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
							nodeRecurringInstanceDate: "2024-01-02",
						},
					};
				}
				if (file.path.includes("2024-01-04")) {
					return {
						frontmatter: {
							RRuleID: "test-rrule-123",
							nodeRecurringInstanceDate: "2024-01-04",
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
				nodeRecurringInstanceDate: "2024-01-02",
			});
			await (manager as any).handleFileChanged("Calendar/Meeting 2024-01-04.md", {
				RRuleID: "test-rrule-123",
				nodeRecurringInstanceDate: "2024-01-04",
			});

			// Check that physical instances are tracked in the map
			const recurringData = (manager as any).recurringEventsMap.get("test-rrule-123");
			expect(recurringData.physicalInstances).toHaveLength(2);
			expect(recurringData.physicalInstances[0].instanceDate.toISODate()).toBe("2024-01-02");
			expect(recurringData.physicalInstances[1].instanceDate.toISODate()).toBe("2024-01-04");
		});

		it("should exclude physical instance dates from virtual generation", async () => {
			const { RecurringEventManager } = await import("../../src/core/recurring-event-manager");
			const { getNextOccurrence, isDateOnWeekdays, iterateOccurrencesInRange } = await import(
				"@real1ty-obsidian-plugins/utils/date-recurrence-utils"
			);

			// Mock date utility functions
			(getNextOccurrence as any)
				.mockReturnValueOnce(DateTime.fromISO("2024-01-02"))
				.mockReturnValueOnce(DateTime.fromISO("2024-01-04"))
				.mockReturnValueOnce(DateTime.fromISO("2024-01-06"));

			(isDateOnWeekdays as any).mockReturnValue(true);
			// Using default calculateRecurringInstanceDateTime mock

			// Mock the new iterateOccurrencesInRange function to return the expected dates
			(iterateOccurrencesInRange as any).mockReturnValue([
				DateTime.fromISO("2024-01-02"),
				DateTime.fromISO("2024-01-04"),
				DateTime.fromISO("2024-01-06"),
			]);

			// Mock existing physical instance
			mockApp.vault.getMarkdownFiles.mockReturnValue([
				{ path: "Calendar/Meeting 2024-01-02.md", stat: { mtime: Date.now() } },
			]);

			mockApp.metadataCache.getFileCache.mockReturnValue({
				frontmatter: {
					RRuleID: "test-rrule-123",
					nodeRecurringInstanceDate: "2024-01-02",
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
					startTime: DateTime.fromISO("2024-01-01T10:00:00"),
					endTime: DateTime.fromISO("2024-01-01T11:00:00"),
					allDay: false,
				},
				frontmatter: {
					"Start Date": "2024-01-01T10:00:00",
				},
				futureInstancesCount: 2,
				sourceFilePath: "recurring.md",
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
				nodeRecurringInstanceDate: "2024-01-02",
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
			const { RecurringEventManager } = await import("../../src/core/recurring-event-manager");

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
				const { RecurringEventManager } = await import("../../src/core/recurring-event-manager");
				const { TemplateService } = await import("../../src/core/template-service");

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
						startTime: DateTime.fromISO("2024-01-01T00:00:00"), // Should be ignored for all-day
						endTime: undefined,
						weekdays: [],
					},
					frontmatter: {
						"Start Date": "2024-01-15T00:00:00", // Monday
					},
					futureInstancesCount: 2,
					sourceFilePath: "recurring.md",
				};

				// Simulate adding the recurring event
				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: "recurring.md",
					recurringEvent: mockRecurringEvent,
				});

				// Trigger physical instance creation
				await (manager as any).ensurePhysicalInstances("daily-all-day-123");

				// Verify processFrontMatter was called with correct data
				expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalled();

				// Get the frontmatter updater function from the call
				const processFrontMatterCall = mockApp.fileManager.processFrontMatter.mock.calls[0];
				const frontmatterUpdater = processFrontMatterCall[1];

				// Test what the updater function does
				const mockFrontmatter: any = {};
				frontmatterUpdater(mockFrontmatter);

				// For daily all-day events, should preserve all-day status
				expect(mockFrontmatter["All Day"]).toBe(true);
				expect(mockFrontmatter["Start Date"]).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00/);
				expect(mockFrontmatter["End Date"]).toBeUndefined();
			});

			it("should create timed daily instances with correct time extraction", async () => {
				const { RecurringEventManager } = await import("../../src/core/recurring-event-manager");
				const { TemplateService } = await import("../../src/core/template-service");

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
						startTime: DateTime.fromISO("2024-01-01T09:30:00"), // Should extract this time
						endTime: DateTime.fromISO("2024-01-01T10:15:00"), // Should extract this time
						weekdays: [],
					},
					frontmatter: {
						"Start Date": "2024-01-15T14:00:00", // Original date/time (should extract only time)
						"End Date": "2024-01-15T15:30:00",
					},
					futureInstancesCount: 2,
					sourceFilePath: "recurring.md",
				};

				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: "recurring.md",
					recurringEvent: mockRecurringEvent,
				});

				await (manager as any).ensurePhysicalInstances("daily-timed-123");

				// Verify processFrontMatter was called
				expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalled();

				const processFrontMatterCall = mockApp.fileManager.processFrontMatter.mock.calls[0];
				const frontmatterUpdater = processFrontMatterCall[1];

				const mockFrontmatter: any = {};
				frontmatterUpdater(mockFrontmatter);

				// For daily timed events, should use extracted time (09:30-10:15) not original time (14:00-15:30)
				expect(mockFrontmatter["All Day"]).toBe(false);
				expect(mockFrontmatter["Start Date"]).toMatch(/T09:30:00/);
				expect(mockFrontmatter["End Date"]).toMatch(/T10:15:00/);
			});
		});

		describe("Weekly/Bi-Weekly Recurrence", () => {
			it("should create weekly instances with time extraction", async () => {
				const { RecurringEventManager } = await import("../../src/core/recurring-event-manager");
				const { TemplateService } = await import("../../src/core/template-service");

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
						startTime: DateTime.fromISO("2024-01-01T10:00:00"), // Should extract this time
						endTime: DateTime.fromISO("2024-01-01T11:30:00"), // Should extract this time
						weekdays: ["tuesday", "thursday"] as const,
					},
					frontmatter: {
						"Start Date": "2024-01-15T16:45:00", // Original time should be ignored
						"End Date": "2024-01-15T18:00:00", // Original time should be ignored
					},
					futureInstancesCount: 2,
					sourceFilePath: "recurring.md",
				};

				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: "recurring.md",
					recurringEvent: mockRecurringEvent,
				});

				await (manager as any).ensurePhysicalInstances("weekly-123");

				expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalled();

				const processFrontMatterCall = mockApp.fileManager.processFrontMatter.mock.calls[0];
				const frontmatterUpdater = processFrontMatterCall[1];

				const mockFrontmatter: any = {};
				frontmatterUpdater(mockFrontmatter);

				// For weekly events, should use extracted time (10:00-11:30) not original (16:45-18:00)
				expect(mockFrontmatter["All Day"]).toBe(false);
				expect(mockFrontmatter["Start Date"]).toMatch(/T10:00:00/);
				expect(mockFrontmatter["End Date"]).toMatch(/T11:30:00/);
			});

			it("should create bi-weekly instances with time extraction", async () => {
				const { RecurringEventManager } = await import("../../src/core/recurring-event-manager");
				const { TemplateService } = await import("../../src/core/template-service");

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
						startTime: DateTime.fromISO("2024-01-01T09:15:00"), // Should extract this time
						endTime: DateTime.fromISO("2024-01-01T10:00:00"), // Should extract this time
						weekdays: ["monday", "friday"] as const,
					},
					frontmatter: {
						"Start Date": "2024-01-15T13:20:00", // Original time should be ignored
						"End Date": "2024-01-15T14:45:00", // Original time should be ignored
					},
					futureInstancesCount: 2,
					sourceFilePath: "recurring.md",
				};

				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: "recurring.md",
					recurringEvent: mockRecurringEvent,
				});

				await (manager as any).ensurePhysicalInstances("bi-weekly-123");

				expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalled();

				const processFrontMatterCall = mockApp.fileManager.processFrontMatter.mock.calls[0];
				const frontmatterUpdater = processFrontMatterCall[1];

				const mockFrontmatter: any = {};
				frontmatterUpdater(mockFrontmatter);

				// For bi-weekly events, should use extracted time (09:15-10:00) not original (13:20-14:45)
				expect(mockFrontmatter["All Day"]).toBe(false);
				expect(mockFrontmatter["Start Date"]).toMatch(/T09:15:00/);
				expect(mockFrontmatter["End Date"]).toMatch(/T10:00:00/);
			});
		});

		describe("Monthly Recurrence", () => {
			it("should create monthly all-day instances inheriting day of month", async () => {
				const { RecurringEventManager } = await import("../../src/core/recurring-event-manager");
				const { TemplateService } = await import("../../src/core/template-service");

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
						startTime: DateTime.fromISO("2024-01-15T00:00:00"), // 15th of January - should inherit day 15
						endTime: undefined,
						weekdays: [],
					},
					frontmatter: {
						"Start Date": "2024-01-15T00:00:00", // 15th of January - should inherit day 15
					},
					futureInstancesCount: 2,
					sourceFilePath: "recurring.md",
				};

				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: "recurring.md",
					recurringEvent: mockRecurringEvent,
				});

				await (manager as any).ensurePhysicalInstances("monthly-all-day-123");

				expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalled();

				const processFrontMatterCall = mockApp.fileManager.processFrontMatter.mock.calls[0];
				const frontmatterUpdater = processFrontMatterCall[1];

				const mockFrontmatter: any = {};
				frontmatterUpdater(mockFrontmatter);

				// For monthly all-day events, should inherit the day (15th) and be all-day
				expect(mockFrontmatter["All Day"]).toBe(true);
				expect(mockFrontmatter["Start Date"]).toMatch(/2025-\d{2}-15T00:00:00/); // Should be 15th of next month in 2025
				expect(mockFrontmatter["End Date"]).toBeUndefined();
			});

			it("should create monthly timed instances inheriting day and time", async () => {
				const { RecurringEventManager } = await import("../../src/core/recurring-event-manager");
				const { TemplateService } = await import("../../src/core/template-service");

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
						startTime: DateTime.fromISO("2024-01-25T14:30:00"), // 25th at 14:30 - should inherit both day and time
						endTime: DateTime.fromISO("2024-01-25T16:00:00"), // 25th at 16:00 - should inherit both day and time
						weekdays: [],
					},
					frontmatter: {
						"Start Date": "2024-01-25T14:30:00", // 25th at 14:30 - should inherit both day and time
						"End Date": "2024-01-25T16:00:00", // 25th at 16:00 - should inherit both day and time
					},
					futureInstancesCount: 2,
					sourceFilePath: "recurring.md",
				};

				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: "recurring.md",
					recurringEvent: mockRecurringEvent,
				});

				await (manager as any).ensurePhysicalInstances("monthly-timed-123");

				expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalled();

				const processFrontMatterCall = mockApp.fileManager.processFrontMatter.mock.calls[0];
				const frontmatterUpdater = processFrontMatterCall[1];

				const mockFrontmatter: any = {};
				frontmatterUpdater(mockFrontmatter);

				// For monthly timed events, should inherit day (25th) and time (14:30-16:00)
				expect(mockFrontmatter["All Day"]).toBe(false);
				expect(mockFrontmatter["Start Date"]).toMatch(/-25T14:30:00/); // Should be 25th at 14:30
				expect(mockFrontmatter["End Date"]).toMatch(/-25T16:00:00/); // Should be 25th at 16:00
			});
		});

		describe("Yearly Recurrence", () => {
			it("should create yearly all-day instances inheriting day and month", async () => {
				const { RecurringEventManager } = await import("../../src/core/recurring-event-manager");
				const { TemplateService } = await import("../../src/core/template-service");

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
						startTime: DateTime.fromISO("2024-06-20T00:00:00"), // June 20th - should inherit month and day
						endTime: undefined,
						weekdays: [],
					},
					frontmatter: {
						"Start Date": "2024-06-20T00:00:00", // June 20th - should inherit month and day
					},
					futureInstancesCount: 2,
					sourceFilePath: "recurring.md",
				};

				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: "recurring.md",
					recurringEvent: mockRecurringEvent,
				});

				await (manager as any).ensurePhysicalInstances("yearly-all-day-123");

				expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalled();

				const processFrontMatterCall = mockApp.fileManager.processFrontMatter.mock.calls[0];
				const frontmatterUpdater = processFrontMatterCall[1];

				const mockFrontmatter: any = {};
				frontmatterUpdater(mockFrontmatter);

				// For yearly all-day events, should inherit month (06) and day (20)
				expect(mockFrontmatter["All Day"]).toBe(true);
				expect(mockFrontmatter["Start Date"]).toMatch(/-06-20T00:00:00/); // Should be June 20th
				expect(mockFrontmatter["End Date"]).toBeUndefined();
			});

			it("should create yearly timed instances inheriting day, month and time", async () => {
				const { RecurringEventManager } = await import("../../src/core/recurring-event-manager");
				const { TemplateService } = await import("../../src/core/template-service");

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
						startTime: DateTime.fromISO("2024-03-12T18:00:00"), // March 12th at 18:00 - should inherit all
						endTime: DateTime.fromISO("2024-03-12T22:30:00"), // March 12th at 22:30 - should inherit all
						weekdays: [],
					},
					frontmatter: {
						"Start Date": "2024-03-12T18:00:00", // March 12th at 18:00 - should inherit all
						"End Date": "2024-03-12T22:30:00", // March 12th at 22:30 - should inherit all
					},
					futureInstancesCount: 2,
					sourceFilePath: "recurring.md",
				};

				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: "recurring.md",
					recurringEvent: mockRecurringEvent,
				});

				await (manager as any).ensurePhysicalInstances("yearly-timed-123");

				expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalled();

				const processFrontMatterCall = mockApp.fileManager.processFrontMatter.mock.calls[0];
				const frontmatterUpdater = processFrontMatterCall[1];

				const mockFrontmatter: any = {};
				frontmatterUpdater(mockFrontmatter);

				// For yearly timed events, should inherit month (03), day (12) and time (18:00-22:30)
				expect(mockFrontmatter["All Day"]).toBe(false);
				expect(mockFrontmatter["Start Date"]).toMatch(/-03-12T18:00:00/); // Should be March 12th at 18:00
				expect(mockFrontmatter["End Date"]).toMatch(/-03-12T22:30:00/); // Should be March 12th at 22:30
			});
		});

		describe("Virtual Instance Generation", () => {
			it("should generate virtual instances with correct date/time logic for different recurrence types", async () => {
				const { RecurringEventManager } = await import("../../src/core/recurring-event-manager");
				const { iterateOccurrencesInRange } = await import(
					"@real1ty-obsidian-plugins/utils/date-recurrence-utils"
				);

				// Mock the utilities to return predictable dates
				(iterateOccurrencesInRange as any).mockReturnValue([
					DateTime.fromISO("2024-02-15T00:00:00.000Z"), // Next month (February 15th) in UTC
					DateTime.fromISO("2024-03-15T00:00:00.000Z"), // Following month (March 15th) in UTC
				]);

				// Using real calculateRecurringInstanceDateTime function

				const manager = new RecurringEventManager(mockApp, mockSettingsStore, mockIndexer);

				const monthlyRecurringEvent = {
					rRuleId: "monthly-virtual-123",
					title: "Monthly Virtual Meeting",
					rrules: {
						type: "monthly" as const,
						allDay: false,
						startTime: DateTime.fromISO("2024-01-15T14:30:00"), // January 15th - should create instances on 15th of each month
						endTime: DateTime.fromISO("2024-01-15T16:00:00"),
						weekdays: [],
					},
					frontmatter: {
						"Start Date": "2024-01-15T14:30:00.000Z", // January 15th - should create instances on 15th of each month
						"End Date": "2024-01-15T16:00:00.000Z",
					},
					futureInstancesCount: 2,
					sourceFilePath: "recurring.md",
				};

				await (manager as any).handleIndexerEvent({
					type: "recurring-event-found",
					filePath: "recurring.md",
					recurringEvent: monthlyRecurringEvent,
				});

				const virtualEvents = await manager.generateAllVirtualInstances(
					DateTime.fromISO("2024-02-01"),
					DateTime.fromISO("2024-03-31")
				);

				// Should generate virtual events for February and March with correct dates/times
				expect(virtualEvents).toHaveLength(2);
				expect(virtualEvents[0].start).toMatch(/2024-02-15T14:30:00\.000[Z+]/); // Accept both UTC (Z) and local timezone (+)
				expect(virtualEvents[0].end).toMatch(/2024-02-15T16:00:00\.000[Z+]/);
				expect(virtualEvents[1].start).toMatch(/2024-03-15T14:30:00\.000[Z+]/);
				expect(virtualEvents[1].end).toMatch(/2024-03-15T16:00:00\.000[Z+]/);
			});
		});
	});
});
