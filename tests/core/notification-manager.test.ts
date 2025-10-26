import { BehaviorSubject, Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IndexerEvent } from "../../src/core/indexer";
import { NotificationManager } from "../../src/core/notification-manager";
import type { SingleCalendarConfig } from "../../src/types/settings";
import type { MockApp } from "../mocks/obsidian";
import { TFile } from "../mocks/obsidian";

describe("NotificationManager", () => {
	let mockApp: MockApp;
	let mockVault: MockApp["vault"];
	let mockMetadataCache: MockApp["metadataCache"];
	let mockFileManager: MockApp["fileManager"];

	let notificationManager: NotificationManager;
	let settingsStore: BehaviorSubject<SingleCalendarConfig>;
	let indexerEventsSubject: Subject<IndexerEvent>;
	let mockIndexer: any;

	const createDefaultSettings = (): SingleCalendarConfig =>
		({
			id: "test",
			name: "Test Calendar",
			enabled: true,
			directory: "test-dir",
			enableNotifications: true,
			defaultMinutesBefore: undefined,
			minutesBeforeProp: "Minutes Before",
			defaultDaysBefore: undefined,
			daysBeforeProp: "Days Before",
			alreadyNotifiedProp: "Already Notified",
			startProp: "Start Date",
			endProp: "End Date",
			dateProp: "Date",
			allDayProp: "All Day",
			titleProp: "Title",
		}) as SingleCalendarConfig;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();

		// Initialize mock app and its components
		mockApp = {
			fileManager: {
				processFrontMatter: vi.fn(),
				renameFile: vi.fn().mockResolvedValue(undefined),
			},
			metadataCache: {
				getFileCache: vi.fn(),
			},
			vault: {
				getAbstractFileByPath: vi.fn(),
				on: vi.fn(),
				read: vi.fn(),
				cachedRead: vi.fn(),
				modify: vi.fn(),
				create: vi.fn(),
				delete: vi.fn(),
				rename: vi.fn(),
				getFiles: vi.fn().mockReturnValue([]),
				getMarkdownFiles: vi.fn().mockReturnValue([]),
				getFolderByPath: vi.fn(),
			},
			workspace: {
				getActiveFile: vi.fn(),
				on: vi.fn(),
			},
		};

		mockVault = mockApp.vault;
		mockMetadataCache = mockApp.metadataCache;
		mockFileManager = mockApp.fileManager;

		indexerEventsSubject = new Subject<IndexerEvent>();
		mockIndexer = {
			events$: indexerEventsSubject.asObservable(),
		};

		settingsStore = new BehaviorSubject<SingleCalendarConfig>(createDefaultSettings());
		notificationManager = new NotificationManager(mockApp as any, settingsStore, mockIndexer);
	});

	afterEach(() => {
		notificationManager.stop();
		vi.useRealTimers();
	});

	describe("Initialization and Lifecycle", () => {
		it("should initialize with empty notification queue", () => {
			expect((notificationManager as any).notificationQueue).toHaveLength(0);
		});

		it("should start and subscribe to indexer events", async () => {
			await notificationManager.start();

			expect((notificationManager as any).indexerSubscription).not.toBeNull();
			expect((notificationManager as any).checkInterval).not.toBeNull();
		});

		it("should stop and cleanup subscriptions", async () => {
			await notificationManager.start();
			notificationManager.stop();

			expect((notificationManager as any).indexerSubscription).toBeNull();
			expect((notificationManager as any).checkInterval).toBeNull();
			expect((notificationManager as any).notificationQueue).toHaveLength(0);
		});
	});

	describe("Settings Changes", () => {
		it("should rebuild queue when settings change", async () => {
			await notificationManager.start();

			const rebuildSpy = vi.spyOn(notificationManager as any, "rebuildNotificationQueue");

			settingsStore.next({
				...createDefaultSettings(),
				defaultMinutesBefore: 15,
			});

			expect(rebuildSpy).toHaveBeenCalled();
		});

		it("should not process events when notifications are disabled", async () => {
			settingsStore.next({
				...createDefaultSettings(),
				enableNotifications: false,
			});

			await notificationManager.start();

			const futureDate = new Date();
			futureDate.setHours(futureDate.getHours() + 2);

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": futureDate.toISOString(),
						"Minutes Before": 15,
					},
					folder: "",
				},
			});

			expect((notificationManager as any).notificationQueue).toHaveLength(0);
		});
	});

	describe("Timed Event Notifications", () => {
		it("should add notification for timed event with per-event override", async () => {
			settingsStore.next({
				...createDefaultSettings(),
				defaultMinutesBefore: 30,
			});

			await notificationManager.start();

			const futureDate = new Date();
			futureDate.setHours(futureDate.getHours() + 2);

			const mockFile = new TFile("event.md");
			mockFile.basename = "Test Event";
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": futureDate.toISOString(),
						"Minutes Before": 15, // Override default 30
					},
					folder: "",
				},
			});

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);
			expect(queue[0].filePath).toBe("event.md");

			const expectedNotifyTime = new Date(futureDate);
			expectedNotifyTime.setMinutes(expectedNotifyTime.getMinutes() - 15);
			expect(queue[0].notifyAt.getTime()).toBe(expectedNotifyTime.getTime());
		});

		it("should use default minutes before when no per-event override", async () => {
			settingsStore.next({
				...createDefaultSettings(),
				defaultMinutesBefore: 30,
			});

			await notificationManager.start();

			const futureDate = new Date();
			futureDate.setHours(futureDate.getHours() + 2);

			const mockFile = new TFile("event.md");
			mockFile.basename = "Test Event";
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": futureDate.toISOString(),
					},
					folder: "",
				},
			});

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);

			const expectedNotifyTime = new Date(futureDate);
			expectedNotifyTime.setMinutes(expectedNotifyTime.getMinutes() - 30);
			expect(queue[0].notifyAt.getTime()).toBe(expectedNotifyTime.getTime());
		});

		it("should not add notification for timed event without notification time", async () => {
			await notificationManager.start();

			const futureDate = new Date();
			futureDate.setHours(futureDate.getHours() + 2);

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": futureDate.toISOString(),
						// No Minutes Before and no default
					},
					folder: "",
				},
			});

			expect((notificationManager as any).notificationQueue).toHaveLength(0);
		});

		it("should handle 0 minutes before (notify at event start)", async () => {
			await notificationManager.start();

			const futureDate = new Date();
			futureDate.setHours(futureDate.getHours() + 2);

			const mockFile = new TFile("event.md");
			mockFile.basename = "Test Event";
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": futureDate.toISOString(),
						"Minutes Before": 0,
					},
					folder: "",
				},
			});

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);
			expect(queue[0].notifyAt.getTime()).toBe(futureDate.getTime());
		});
	});

	describe("All-Day Event Notifications", () => {
		it("should add notification for all-day event with per-event override", async () => {
			settingsStore.next({
				...createDefaultSettings(),
				defaultDaysBefore: 2,
			});

			await notificationManager.start();

			const futureDate = new Date();
			futureDate.setDate(futureDate.getDate() + 5);

			const mockFile = new TFile("event.md");
			mockFile.basename = "Test Event";
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						Date: futureDate.toISOString().split("T")[0],
						"Days Before": 1, // Override default 2
					},
					folder: "",
				},
			});

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);

			const expectedNotifyTime = new Date(futureDate);
			expectedNotifyTime.setDate(expectedNotifyTime.getDate() - 1);
			expectedNotifyTime.setHours(9, 0, 0, 0); // 9 AM notification time
			expect(queue[0].notifyAt.getTime()).toBe(expectedNotifyTime.getTime());
			expect(queue[0].isAllDay).toBe(true);
		});

		it("should use default days before when no per-event override", async () => {
			settingsStore.next({
				...createDefaultSettings(),
				defaultDaysBefore: 1,
			});

			await notificationManager.start();

			const futureDate = new Date();
			futureDate.setDate(futureDate.getDate() + 5);

			const mockFile = new TFile("event.md");
			mockFile.basename = "Test Event";
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						Date: futureDate.toISOString().split("T")[0],
						"All Day": true,
					},
					folder: "",
				},
			});

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);

			const expectedNotifyTime = new Date(futureDate);
			expectedNotifyTime.setDate(expectedNotifyTime.getDate() - 1);
			expectedNotifyTime.setHours(9, 0, 0, 0);
			expect(queue[0].notifyAt.getTime()).toBe(expectedNotifyTime.getTime());
		});

		it("should handle 0 days before (notify on event day)", async () => {
			await notificationManager.start();

			const futureDate = new Date();
			futureDate.setDate(futureDate.getDate() + 5);

			const mockFile = new TFile("event.md");
			mockFile.basename = "Test Event";
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						Date: futureDate.toISOString().split("T")[0],
						"Days Before": 0,
					},
					folder: "",
				},
			});

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);

			const expectedNotifyTime = new Date(futureDate);
			expectedNotifyTime.setHours(9, 0, 0, 0);
			expect(queue[0].notifyAt.getTime()).toBe(expectedNotifyTime.getTime());
		});
	});

	describe("Already Notified Handling", () => {
		it("should not add notification for events already marked as notified", async () => {
			await notificationManager.start();

			const futureDate = new Date();
			futureDate.setHours(futureDate.getHours() + 2);

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": futureDate.toISOString(),
						"Minutes Before": 15,
						"Already Notified": true,
					},
					folder: "",
				},
			});

			expect((notificationManager as any).notificationQueue).toHaveLength(0);
		});

		it('should not add notification when alreadyNotified is "true" string', async () => {
			await notificationManager.start();

			const futureDate = new Date();
			futureDate.setHours(futureDate.getHours() + 2);

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": futureDate.toISOString(),
						"Minutes Before": 15,
						"Already Notified": "true",
					},
					folder: "",
				},
			});

			expect((notificationManager as any).notificationQueue).toHaveLength(0);
		});

		it("should remove notification for previously added event that gets marked as notified", async () => {
			await notificationManager.start();

			const futureDate = new Date();
			futureDate.setHours(futureDate.getHours() + 2);

			const mockFile = new TFile("event.md");
			mockFile.basename = "Test Event";
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

			// First add the notification
			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": futureDate.toISOString(),
						"Minutes Before": 15,
					},
					folder: "",
				},
			});

			expect((notificationManager as any).notificationQueue).toHaveLength(1);

			// Now mark as notified
			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": futureDate.toISOString(),
						"Minutes Before": 15,
						"Already Notified": true,
					},
					folder: "",
				},
			});

			expect((notificationManager as any).notificationQueue).toHaveLength(0);
		});
	});

	describe("Queue Management", () => {
		it("should maintain sorted queue by notification time", async () => {
			await notificationManager.start();

			const mockFile1 = new TFile("event1.md");
			mockFile1.basename = "Event 1";

			const mockFile2 = new TFile("event2.md");
			mockFile2.basename = "Event 2";

			const mockFile3 = new TFile("event3.md");
			mockFile3.basename = "Event 3";

			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === "event1.md") return mockFile1;
				if (path === "event2.md") return mockFile2;
				if (path === "event3.md") return mockFile3;
				return null;
			});

			// Add events in non-chronological order
			const date1 = new Date();
			date1.setHours(date1.getHours() + 3); // Notify in 2h45m

			const date2 = new Date();
			date2.setHours(date2.getHours() + 1); // Notify in 45m

			const date3 = new Date();
			date3.setHours(date3.getHours() + 2); // Notify in 1h45m

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event1.md",
				source: {
					filePath: "event1.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": date1.toISOString(),
						"Minutes Before": 15,
					},
					folder: "",
				},
			});

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event2.md",
				source: {
					filePath: "event2.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": date2.toISOString(),
						"Minutes Before": 15,
					},
					folder: "",
				},
			});

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event3.md",
				source: {
					filePath: "event3.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": date3.toISOString(),
						"Minutes Before": 15,
					},
					folder: "",
				},
			});

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(3);
			expect(queue[0].filePath).toBe("event2.md");
			expect(queue[1].filePath).toBe("event3.md");
			expect(queue[2].filePath).toBe("event1.md");
		});

		it("should update notification when event is modified", async () => {
			await notificationManager.start();

			const mockFile = new TFile("event.md");
			mockFile.basename = "Test Event";
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

			const futureDate1 = new Date();
			futureDate1.setHours(futureDate1.getHours() + 2);

			// Add initial notification
			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": futureDate1.toISOString(),
						"Minutes Before": 15,
					},
					folder: "",
				},
			});

			expect((notificationManager as any).notificationQueue).toHaveLength(1);
			const firstNotifyTime = (notificationManager as any).notificationQueue[0].notifyAt.getTime();

			// Update with new time
			const futureDate2 = new Date();
			futureDate2.setHours(futureDate2.getHours() + 3);

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": futureDate2.toISOString(),
						"Minutes Before": 15,
					},
					folder: "",
				},
			});

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);
			expect(queue[0].notifyAt.getTime()).not.toBe(firstNotifyTime);
		});

		it("should remove notification when event is deleted", async () => {
			await notificationManager.start();

			const mockFile = new TFile("event.md");
			mockFile.basename = "Test Event";
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

			const futureDate = new Date();
			futureDate.setHours(futureDate.getHours() + 2);

			// Add notification
			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": futureDate.toISOString(),
						"Minutes Before": 15,
					},
					folder: "",
				},
			});

			expect((notificationManager as any).notificationQueue).toHaveLength(1);

			// Delete event
			indexerEventsSubject.next({
				type: "file-deleted",
				filePath: "event.md",
			});

			expect((notificationManager as any).notificationQueue).toHaveLength(0);
		});

		it("should not add past notifications to queue", async () => {
			await notificationManager.start();

			const pastDate = new Date();
			pastDate.setHours(pastDate.getHours() - 2);

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": pastDate.toISOString(),
						"Minutes Before": 15,
					},
					folder: "",
				},
			});

			expect((notificationManager as any).notificationQueue).toHaveLength(0);
		});
	});

	describe("Periodic Notification Checking", () => {
		it("should check for notifications every minute", async () => {
			await notificationManager.start();

			const checkSpy = vi.spyOn(notificationManager as any, "checkPendingNotifications");

			// Advance time by 1 minute
			vi.advanceTimersByTime(60000);

			expect(checkSpy).toHaveBeenCalledTimes(1);

			// Advance another minute
			vi.advanceTimersByTime(60000);

			expect(checkSpy).toHaveBeenCalledTimes(2);
		});

		it("should trigger notification and mark as notified", async () => {
			await notificationManager.start();

			const mockFile = new TFile("event.md");
			mockFile.basename = "Test Event";
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

			const nearFutureDate = new Date();
			nearFutureDate.setSeconds(nearFutureDate.getSeconds() + 30);

			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: {
					"Start Date": nearFutureDate.toISOString(),
					Title: "Test Event",
				},
			});

			// Add notification that should trigger soon
			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": nearFutureDate.toISOString(),
						"Minutes Before": 0, // Notify at start time
					},
					folder: "",
				},
			});

			expect((notificationManager as any).notificationQueue).toHaveLength(1);

			// Advance time past notification time
			vi.advanceTimersByTime(60000);

			// Notification should be removed from queue
			expect((notificationManager as any).notificationQueue).toHaveLength(0);

			// processFrontMatter should be called to mark as notified
			expect(mockFileManager.processFrontMatter).toHaveBeenCalledWith(mockFile, expect.any(Function));
		});

		it("should not trigger notifications when disabled", async () => {
			settingsStore.next({
				...createDefaultSettings(),
				enableNotifications: false,
			});

			await notificationManager.start();

			const checkSpy = vi.spyOn(notificationManager as any, "checkPendingNotifications");

			vi.advanceTimersByTime(60000);

			// Check is called but returns early
			expect(checkSpy).toHaveBeenCalled();
			expect((notificationManager as any).notificationQueue).toHaveLength(0);
		});

		it("should trigger multiple notifications at once if times have passed", async () => {
			await notificationManager.start();

			const mockFile1 = new TFile("event1.md");
			mockFile1.basename = "Event 1";

			const mockFile2 = new TFile("event2.md");
			mockFile2.basename = "Event 2";

			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === "event1.md") return mockFile1;
				if (path === "event2.md") return mockFile2;
				return null;
			});

			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: {},
			});

			const nearFutureDate1 = new Date();
			nearFutureDate1.setSeconds(nearFutureDate1.getSeconds() + 30);

			const nearFutureDate2 = new Date();
			nearFutureDate2.setSeconds(nearFutureDate2.getSeconds() + 45);

			// Add two notifications that should both trigger
			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event1.md",
				source: {
					filePath: "event1.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": nearFutureDate1.toISOString(),
						"Minutes Before": 0,
					},
					folder: "",
				},
			});

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event2.md",
				source: {
					filePath: "event2.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": nearFutureDate2.toISOString(),
						"Minutes Before": 0,
					},
					folder: "",
				},
			});

			expect((notificationManager as any).notificationQueue).toHaveLength(2);

			// Advance time past both notification times
			vi.advanceTimersByTime(60000);

			// Both should be removed
			expect((notificationManager as any).notificationQueue).toHaveLength(0);

			// Both should be marked as notified
			expect(mockFileManager.processFrontMatter).toHaveBeenCalledTimes(2);
		});
	});

	describe("Title Handling", () => {
		it("should use titleProp from frontmatter if available", async () => {
			await notificationManager.start();

			const mockFile = new TFile("event.md");
			mockFile.basename = "File Name";
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

			const futureDate = new Date();
			futureDate.setHours(futureDate.getHours() + 2);

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": futureDate.toISOString(),
						"Minutes Before": 15,
						Title: "Custom Title",
					},
					folder: "",
				},
			});

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);
			expect(queue[0].title).toBe("Custom Title");
		});

		it("should fallback to file basename when no title property", async () => {
			await notificationManager.start();

			const mockFile = new TFile("event.md");
			mockFile.basename = "Event File Name";
			mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

			const futureDate = new Date();
			futureDate.setHours(futureDate.getHours() + 2);

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": futureDate.toISOString(),
						"Minutes Before": 15,
					},
					folder: "",
				},
			});

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);
			expect(queue[0].title).toBe("Event File Name");
		});

		it("should fallback to file path when file not found", async () => {
			await notificationManager.start();

			mockVault.getAbstractFileByPath.mockReturnValue(null);

			const futureDate = new Date();
			futureDate.setHours(futureDate.getHours() + 2);

			indexerEventsSubject.next({
				type: "file-changed",
				filePath: "event.md",
				source: {
					filePath: "event.md",
					mtime: Date.now(),
					frontmatter: {
						"Start Date": futureDate.toISOString(),
						"Minutes Before": 15,
					},
					folder: "",
				},
			});

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);
			expect(queue[0].title).toBe("event.md");
		});
	});
});
