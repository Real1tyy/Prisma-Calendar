import { BehaviorSubject, Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IndexerEvent, RawEventSource } from "../../src/core/indexer";
import { NotificationManager } from "../../src/core/notification-manager";
import type { SingleCalendarConfig } from "../../src/types/settings";
import { parseAsLocalDate } from "../../src/utils/time-formatter";
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
			notificationSound: false,
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

	const createFutureDate = (hoursOffset: number = 2): Date => {
		const date = new Date();
		date.setHours(date.getHours() + hoursOffset);
		return date;
	};

	const createFutureDateDays = (daysOffset: number = 5): Date => {
		const date = new Date();
		date.setDate(date.getDate() + daysOffset);
		return date;
	};

	const createMockFile = (filePath: string = "event.md", basename: string = "Test Event"): TFile => {
		const file = new TFile(filePath);
		file.basename = basename;
		return file;
	};

	const createRawEventSource = (overrides: Partial<RawEventSource> = {}): RawEventSource => ({
		filePath: "event.md",
		mtime: Date.now(),
		frontmatter: {},
		folder: "",
		isAllDay: false,
		isUntracked: false,
		...overrides,
	});

	const createTimedEventSource = (overrides: Partial<RawEventSource> = {}): RawEventSource => {
		const futureDate = createFutureDate(2);
		return createRawEventSource({
			frontmatter: {
				"Start Date": futureDate.toISOString(),
				"Minutes Before": 15,
				...overrides.frontmatter,
			},
			isAllDay: false,
			...overrides,
		});
	};

	const createAllDayEventSource = (overrides: Partial<RawEventSource> = {}): RawEventSource => {
		const futureDate = createFutureDateDays(5);
		return createRawEventSource({
			frontmatter: {
				Date: futureDate.toISOString().split("T")[0],
				"Days Before": 1,
				...overrides.frontmatter,
			},
			isAllDay: true,
			...overrides,
		});
	};

	const createIndexerEvent = (overrides: Partial<IndexerEvent> = {}): IndexerEvent => ({
		type: "file-changed",
		filePath: "event.md",
		source: createTimedEventSource(),
		...overrides,
	});

	const createFileChangedEvent = (overrides: Partial<IndexerEvent> = {}): IndexerEvent =>
		createIndexerEvent({ type: "file-changed", ...overrides });

	const createFileDeletedEvent = (filePath: string = "event.md"): IndexerEvent => ({
		type: "file-deleted",
		filePath,
	});

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();

		// Mock Web Notifications API
		const mockNotification = vi.fn().mockImplementation((_title: string, _options?: NotificationOptions) => {
			return {
				onclick: null,
				close: vi.fn(),
			};
		}) as any;
		mockNotification.permission = "granted" as NotificationPermission;
		mockNotification.requestPermission = vi.fn().mockResolvedValue("granted");
		(global as any).Notification = mockNotification;

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
				getLeaf: vi.fn().mockReturnValue({
					openFile: vi.fn(),
				}),
			} as any,
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
		delete (global as any).Notification;
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

			indexerEventsSubject.next(createFileChangedEvent());

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

			const futureDate = createFutureDate(2);
			mockVault.getAbstractFileByPath.mockReturnValue(createMockFile());

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createTimedEventSource({
						frontmatter: {
							"Start Date": futureDate.toISOString(),
							"Minutes Before": 15,
						},
					}),
				})
			);

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);
			expect(queue[0].filePath).toBe("event.md");

			const parsedStartDate = parseAsLocalDate(futureDate.toISOString())!;
			const expectedNotifyTime = new Date(parsedStartDate);
			expectedNotifyTime.setMinutes(expectedNotifyTime.getMinutes() - 15);
			expect(queue[0].notifyAt.getTime()).toBe(expectedNotifyTime.getTime());
		});

		it("should use default minutes before when no per-event override", async () => {
			settingsStore.next({
				...createDefaultSettings(),
				defaultMinutesBefore: 30,
			});

			await notificationManager.start();

			const futureDate = createFutureDate(2);
			mockVault.getAbstractFileByPath.mockReturnValue(createMockFile());

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createTimedEventSource({
						frontmatter: {
							"Start Date": futureDate.toISOString(),
						},
					}),
				})
			);

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);

			const parsedStartDate = parseAsLocalDate(futureDate.toISOString())!;
			const expectedNotifyTime = new Date(parsedStartDate);
			expectedNotifyTime.setMinutes(expectedNotifyTime.getMinutes() - 30);
			expect(queue[0].notifyAt.getTime()).toBe(expectedNotifyTime.getTime());
		});

		it("should not add notification for timed event without notification time", async () => {
			await notificationManager.start();

			const futureDate = createFutureDate(2);

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createTimedEventSource({
						frontmatter: {
							"Start Date": futureDate.toISOString(),
						},
					}),
				})
			);

			expect((notificationManager as any).notificationQueue).toHaveLength(0);
		});

		it("should handle 0 minutes before (notify at event start)", async () => {
			await notificationManager.start();

			const futureDate = createFutureDate(2);
			mockVault.getAbstractFileByPath.mockReturnValue(createMockFile());

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createTimedEventSource({
						frontmatter: {
							"Start Date": futureDate.toISOString(),
							"Minutes Before": 0,
						},
					}),
				})
			);

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);
			const parsedStartDate = parseAsLocalDate(futureDate.toISOString())!;
			expect(queue[0].notifyAt.getTime()).toBe(parsedStartDate.getTime());
		});
	});

	describe("All-Day Event Notifications", () => {
		it("should add notification for all-day event with per-event override", async () => {
			settingsStore.next({
				...createDefaultSettings(),
				defaultDaysBefore: 2,
			});

			await notificationManager.start();

			const futureDate = createFutureDateDays(5);
			mockVault.getAbstractFileByPath.mockReturnValue(createMockFile());

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createAllDayEventSource({
						frontmatter: {
							Date: futureDate.toISOString().split("T")[0],
							"Days Before": 1,
						},
					}),
				})
			);

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);

			const expectedNotifyTime = new Date(futureDate);
			expectedNotifyTime.setDate(expectedNotifyTime.getDate() - 1);
			expectedNotifyTime.setHours(0, 0, 0, 0);
			expect(queue[0].notifyAt.getTime()).toBe(expectedNotifyTime.getTime());
			expect(queue[0].isAllDay).toBe(true);
		});

		it("should use default days before when no per-event override", async () => {
			settingsStore.next({
				...createDefaultSettings(),
				defaultDaysBefore: 1,
			});

			await notificationManager.start();

			const futureDate = createFutureDateDays(5);
			mockVault.getAbstractFileByPath.mockReturnValue(createMockFile());

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createAllDayEventSource({
						frontmatter: {
							Date: futureDate.toISOString().split("T")[0],
							"All Day": true,
						},
					}),
				})
			);

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);

			const expectedNotifyTime = new Date(futureDate);
			expectedNotifyTime.setDate(expectedNotifyTime.getDate() - 1);
			expectedNotifyTime.setHours(0, 0, 0, 0);
			expect(queue[0].notifyAt.getTime()).toBe(expectedNotifyTime.getTime());
		});

		it("should handle 0 days before (notify on event day)", async () => {
			await notificationManager.start();

			const futureDate = createFutureDateDays(5);
			mockVault.getAbstractFileByPath.mockReturnValue(createMockFile());

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createAllDayEventSource({
						frontmatter: {
							Date: futureDate.toISOString().split("T")[0],
							"Days Before": 0,
						},
					}),
				})
			);

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);

			const expectedNotifyTime = new Date(futureDate);
			expectedNotifyTime.setHours(0, 0, 0, 0);
			expect(queue[0].notifyAt.getTime()).toBe(expectedNotifyTime.getTime());
		});
	});

	describe("Already Notified Handling", () => {
		it("should not add notification for events already marked as notified", async () => {
			await notificationManager.start();

			const futureDate = createFutureDate(2);

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createTimedEventSource({
						frontmatter: {
							"Start Date": futureDate.toISOString(),
							"Minutes Before": 15,
							"Already Notified": true,
						},
					}),
				})
			);

			expect((notificationManager as any).notificationQueue).toHaveLength(0);
		});

		it('should not add notification when alreadyNotified is "true" string', async () => {
			await notificationManager.start();

			const futureDate = createFutureDate(2);

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createTimedEventSource({
						frontmatter: {
							"Start Date": futureDate.toISOString(),
							"Minutes Before": 15,
							"Already Notified": "true",
						},
					}),
				})
			);

			expect((notificationManager as any).notificationQueue).toHaveLength(0);
		});

		it("should remove notification for previously added event that gets marked as notified", async () => {
			await notificationManager.start();

			const futureDate = createFutureDate(2);
			mockVault.getAbstractFileByPath.mockReturnValue(createMockFile());

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createTimedEventSource({
						frontmatter: {
							"Start Date": futureDate.toISOString(),
							"Minutes Before": 15,
						},
					}),
				})
			);

			expect((notificationManager as any).notificationQueue).toHaveLength(1);

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createTimedEventSource({
						frontmatter: {
							"Start Date": futureDate.toISOString(),
							"Minutes Before": 15,
							"Already Notified": true,
						},
					}),
				})
			);

			expect((notificationManager as any).notificationQueue).toHaveLength(0);
		});
	});

	describe("Queue Management", () => {
		it("should maintain sorted queue by notification time", async () => {
			await notificationManager.start();

			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === "event1.md") return createMockFile("event1.md", "Event 1");
				if (path === "event2.md") return createMockFile("event2.md", "Event 2");
				if (path === "event3.md") return createMockFile("event3.md", "Event 3");
				return null;
			});

			const date1 = createFutureDate(5);
			const date2 = createFutureDate(3);
			const date3 = createFutureDate(4);

			indexerEventsSubject.next(
				createFileChangedEvent({
					filePath: "event1.md",
					source: createTimedEventSource({
						filePath: "event1.md",
						frontmatter: {
							"Start Date": date1.toISOString(),
							"Minutes Before": 15,
						},
					}),
				})
			);

			indexerEventsSubject.next(
				createFileChangedEvent({
					filePath: "event2.md",
					source: createTimedEventSource({
						filePath: "event2.md",
						frontmatter: {
							"Start Date": date2.toISOString(),
							"Minutes Before": 15,
						},
					}),
				})
			);

			indexerEventsSubject.next(
				createFileChangedEvent({
					filePath: "event3.md",
					source: createTimedEventSource({
						filePath: "event3.md",
						frontmatter: {
							"Start Date": date3.toISOString(),
							"Minutes Before": 15,
						},
					}),
				})
			);

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(3);
			expect(queue[0].filePath).toBe("event2.md");
			expect(queue[1].filePath).toBe("event3.md");
			expect(queue[2].filePath).toBe("event1.md");
		});

		it("should update notification when event is modified", async () => {
			await notificationManager.start();

			mockVault.getAbstractFileByPath.mockReturnValue(createMockFile());

			const futureDate1 = createFutureDate(2);

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createTimedEventSource({
						frontmatter: {
							"Start Date": futureDate1.toISOString(),
							"Minutes Before": 15,
						},
					}),
				})
			);

			expect((notificationManager as any).notificationQueue).toHaveLength(1);
			const firstNotifyTime = (notificationManager as any).notificationQueue[0].notifyAt.getTime();

			const futureDate2 = createFutureDate(3);

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createTimedEventSource({
						frontmatter: {
							"Start Date": futureDate2.toISOString(),
							"Minutes Before": 15,
						},
					}),
				})
			);

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);
			expect(queue[0].notifyAt.getTime()).not.toBe(firstNotifyTime);
		});

		it("should remove notification when event is deleted", async () => {
			await notificationManager.start();

			mockVault.getAbstractFileByPath.mockReturnValue(createMockFile());

			const futureDate = createFutureDate(2);

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createTimedEventSource({
						frontmatter: {
							"Start Date": futureDate.toISOString(),
							"Minutes Before": 15,
						},
					}),
				})
			);

			expect((notificationManager as any).notificationQueue).toHaveLength(1);

			indexerEventsSubject.next(createFileDeletedEvent("event.md"));

			expect((notificationManager as any).notificationQueue).toHaveLength(0);
		});

		it("should not add past notifications to queue", async () => {
			await notificationManager.start();

			const pastDate = createFutureDate(-2);

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createTimedEventSource({
						frontmatter: {
							"Start Date": pastDate.toISOString(),
							"Minutes Before": 15,
						},
					}),
				})
			);

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

			mockVault.getAbstractFileByPath.mockReturnValue(createMockFile());

			const futureLocalTime = createFutureDate(1);
			const futureIsoString = `${futureLocalTime.getFullYear()}-${String(futureLocalTime.getMonth() + 1).padStart(2, "0")}-${String(futureLocalTime.getDate()).padStart(2, "0")}T${String(futureLocalTime.getHours()).padStart(2, "0")}:${String(futureLocalTime.getMinutes()).padStart(2, "0")}:${String(futureLocalTime.getSeconds()).padStart(2, "0")}`;

			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: {
					"Start Date": futureIsoString,
					Title: "Test Event",
				},
			});

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createTimedEventSource({
						frontmatter: {
							"Start Date": futureIsoString,
							"Minutes Before": 0,
						},
					}),
				})
			);

			expect((notificationManager as any).notificationQueue).toHaveLength(1);

			vi.advanceTimersByTime(3600000 + 60000);

			expect((notificationManager as any).notificationQueue).toHaveLength(0);
			expect(mockFileManager.processFrontMatter).toHaveBeenCalledWith(createMockFile(), expect.any(Function));
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

			mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
				if (path === "event1.md") return createMockFile("event1.md", "Event 1");
				if (path === "event2.md") return createMockFile("event2.md", "Event 2");
				return null;
			});

			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: {},
			});

			const nearFutureDate1 = createFutureDate(1);
			const futureIsoString1 = `${nearFutureDate1.getFullYear()}-${String(nearFutureDate1.getMonth() + 1).padStart(2, "0")}-${String(nearFutureDate1.getDate()).padStart(2, "0")}T${String(nearFutureDate1.getHours()).padStart(2, "0")}:${String(nearFutureDate1.getMinutes()).padStart(2, "0")}:${String(nearFutureDate1.getSeconds()).padStart(2, "0")}`;

			const nearFutureDate2 = createFutureDate(1);
			const futureIsoString2 = `${nearFutureDate2.getFullYear()}-${String(nearFutureDate2.getMonth() + 1).padStart(2, "0")}-${String(nearFutureDate2.getDate()).padStart(2, "0")}T${String(nearFutureDate2.getHours()).padStart(2, "0")}:${String(nearFutureDate2.getMinutes()).padStart(2, "0")}:${String(nearFutureDate2.getSeconds()).padStart(2, "0")}`;

			indexerEventsSubject.next(
				createFileChangedEvent({
					filePath: "event1.md",
					source: createTimedEventSource({
						filePath: "event1.md",
						frontmatter: {
							"Start Date": futureIsoString1,
							"Minutes Before": 0,
						},
					}),
				})
			);

			indexerEventsSubject.next(
				createFileChangedEvent({
					filePath: "event2.md",
					source: createTimedEventSource({
						filePath: "event2.md",
						frontmatter: {
							"Start Date": futureIsoString2,
							"Minutes Before": 0,
						},
					}),
				})
			);

			expect((notificationManager as any).notificationQueue).toHaveLength(2);

			vi.advanceTimersByTime(3600000 + 60000);

			expect((notificationManager as any).notificationQueue).toHaveLength(0);
			expect(mockFileManager.processFrontMatter).toHaveBeenCalledTimes(2);
		});
	});

	describe("Title Handling", () => {
		it("should use titleProp from frontmatter if available", async () => {
			await notificationManager.start();

			mockVault.getAbstractFileByPath.mockReturnValue(createMockFile("event.md", "File Name"));

			const futureDate = createFutureDate(2);

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createTimedEventSource({
						frontmatter: {
							"Start Date": futureDate.toISOString(),
							"Minutes Before": 15,
							Title: "Custom Title",
						},
					}),
				})
			);

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);
			expect(queue[0].title).toBe("Custom Title");
		});

		it("should fallback to file basename when no title property", async () => {
			await notificationManager.start();

			mockVault.getAbstractFileByPath.mockReturnValue(createMockFile("event.md", "Event File Name"));

			const futureDate = createFutureDate(2);

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createTimedEventSource({
						frontmatter: {
							"Start Date": futureDate.toISOString(),
							"Minutes Before": 15,
						},
					}),
				})
			);

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);
			expect(queue[0].title).toBe("Event File Name");
		});

		it("should fallback to file path when file not found", async () => {
			await notificationManager.start();

			mockVault.getAbstractFileByPath.mockReturnValue(null);

			const futureDate = createFutureDate(2);

			indexerEventsSubject.next(
				createFileChangedEvent({
					source: createTimedEventSource({
						frontmatter: {
							"Start Date": futureDate.toISOString(),
							"Minutes Before": 15,
						},
					}),
				})
			);

			const queue = (notificationManager as any).notificationQueue;
			expect(queue).toHaveLength(1);
			expect(queue[0].title).toBe("event.md");
		});
	});

	describe("Notification Sound Settings", () => {
		it("should include notificationSound setting in settings schema", () => {
			const settings = createDefaultSettings();
			expect(settings).toHaveProperty("notificationSound");
			expect(typeof settings.notificationSound).toBe("boolean");
		});
	});
});
