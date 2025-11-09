import type { TFile } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, type MockedFunction, vi } from "vitest";
import { Indexer, type IndexerEvent } from "../../src/core/indexer";
import { createMockSingleCalendarSettings, createMockSingleCalendarSettingsStore } from "../setup";

describe("Indexer", () => {
	let mockVault: any;
	let mockMetadataCache: any;
	let settings: any;
	let settingsStore: BehaviorSubject<any>;
	let indexer: Indexer;
	let eventListener: MockedFunction<(event: IndexerEvent) => void>;
	let subscription: Subscription;

	beforeEach(async () => {
		mockVault = {
			on: vi.fn(),
			off: vi.fn(),
			getMarkdownFiles: vi.fn().mockReturnValue([]),
		};

		mockMetadataCache = {
			getFileCache: vi.fn(),
		};

		settings = {
			...createMockSingleCalendarSettings(),
			directory: "Events",
			startProp: "start",
			endProp: "end",
		};

		settingsStore = createMockSingleCalendarSettingsStore(settings);
		const mockApp = {
			vault: mockVault,
			metadataCache: mockMetadataCache,
			fileManager: { processFrontMatter: vi.fn() },
		} as any;
		indexer = new Indexer(mockApp, settingsStore);
		eventListener = vi.fn();
		subscription = indexer.events$.subscribe(eventListener);

		// Start the indexer to register vault event listeners
		await indexer.start();
	});

	afterEach(() => {
		if (subscription) {
			subscription.unsubscribe();
		}
		indexer.stop();
	});

	describe("initialization", () => {
		it("should create indexer with correct settings", () => {
			expect(indexer).toBeDefined();
			expect(indexer.events$).toBeDefined();
		});

		it("should register vault event listeners when started", () => {
			// The indexer registers listeners when start() is called
			expect(mockVault.on).toHaveBeenCalledWith("create", expect.any(Function));
			expect(mockVault.on).toHaveBeenCalledWith("modify", expect.any(Function));
			expect(mockVault.on).toHaveBeenCalledWith("rename", expect.any(Function));
			expect(mockVault.on).toHaveBeenCalledWith("delete", expect.any(Function));
		});

		it("should unregister vault event listeners when stopped", () => {
			indexer.stop();

			expect(mockVault.off).toHaveBeenCalledWith("create", expect.any(Function));
			expect(mockVault.off).toHaveBeenCalledWith("modify", expect.any(Function));
			expect(mockVault.off).toHaveBeenCalledWith("rename", expect.any(Function));
			expect(mockVault.off).toHaveBeenCalledWith("delete", expect.any(Function));
		});
	});

	describe("settings updates", () => {
		it("should update settings", () => {
			const newSettings = { ...settings, directory: "NewEvents" };

			expect(() => {
				settingsStore.next(newSettings);
			}).not.toThrow();
		});
	});

	describe("event stream management", () => {
		it("should handle errors in event subscribers gracefully", () => {
			const faultyListener = vi.fn().mockImplementation(() => {
				throw new Error("Listener error");
			});

			// Subscribe with a faulty listener - RxJS will handle errors
			const faultySubscription = indexer.events$.subscribe({
				next: faultyListener,
				error: (err) => {
					// Error handling in RxJS
					console.error("Stream error:", err);
				},
			});

			// Should not prevent other subscriptions from working
			expect(subscription).toBeDefined();
			expect(faultySubscription).toBeDefined();

			faultySubscription.unsubscribe();
		});
	});

	describe("performance and debouncing", () => {
		it("should register debounced event handlers", () => {
			// Verify that the RxJS stream has registered event handlers
			const createHandler = mockVault.on.mock.calls.find((call: any[]) => call[0] === "create")?.[1];
			const modifyHandler = mockVault.on.mock.calls.find((call: any[]) => call[0] === "modify")?.[1];

			expect(createHandler).toBeDefined();
			expect(modifyHandler).toBeDefined();

			// Verify handlers can be called without throwing
			const file = createMockFile("Events/meeting.md");
			expect(() => createHandler?.(file)).not.toThrow();
			expect(() => modifyHandler?.(file)).not.toThrow();
		});
	});

	describe("edge cases", () => {
		it("should handle empty directory configuration", async () => {
			const emptyDirSettings = { ...settings, directory: "" };
			const emptySettingsStore = createMockSingleCalendarSettingsStore(emptyDirSettings);
			const mockApp = {
				vault: mockVault,
				metadataCache: mockMetadataCache,
				fileManager: { processFrontMatter: vi.fn() },
			} as any;
			const emptyIndexer = new Indexer(mockApp, emptySettingsStore);
			const emptyListener = vi.fn();
			const emptySubscription = emptyIndexer.events$.subscribe(emptyListener);

			// Start the empty indexer
			await emptyIndexer.start();

			// Simulate a file event that should be filtered out
			const file = createMockFile("Events/meeting.md");
			const createHandler = mockVault.on.mock.calls.find((call: any[]) => call[0] === "create")?.[1];

			if (createHandler) {
				createHandler(file);
			}

			// Should not emit events for files when directory is empty
			expect(emptyListener).not.toHaveBeenCalled();
			emptySubscription.unsubscribe();
			emptyIndexer.stop();
		});

		it("should handle files at root level of configured directory", () => {
			const rootFile = createMockFile("Events");
			rootFile.path = "Events"; // Exact match with directory
			rootFile.extension = "md";

			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: { start: "2024-01-15" },
			});

			// Simulate the file creation event
			const createHandler = mockVault.on.mock.calls.find((call: any[]) => call[0] === "create")?.[1];

			if (createHandler) {
				createHandler(rootFile);
			}

			// Should eventually emit an event (after debouncing)
			// Note: In a real test, we'd need to wait for the debounce timeout
		});
	});

	describe("markPastInstancesAsDone", () => {
		let mockApp: any;
		let processFrontMatterSpy: MockedFunction<any>;

		beforeEach(() => {
			processFrontMatterSpy = vi.fn((_file: TFile, callback: (fm: Record<string, any>) => void) => {
				// Simulate calling the callback with a mutable frontmatter object
				const fm: Record<string, any> = {};
				callback(fm);
				return Promise.resolve();
			});

			mockApp = {
				vault: mockVault,
				metadataCache: mockMetadataCache,
				fileManager: { processFrontMatter: processFrontMatterSpy },
			};
		});

		it("should NOT mark source recurring events as done even if they are in the past", async () => {
			// Setup: Enable the markPastInstancesAsDone setting
			const settingsWithMarkDone = {
				...settings,
				markPastInstancesAsDone: true,
				startProp: "start",
				endProp: "end",
				rruleProp: "RRule",
				statusProperty: "Status",
				doneValue: "Done",
			};
			const settingsStoreWithMarkDone = createMockSingleCalendarSettingsStore(settingsWithMarkDone);
			const indexerWithMarkDone = new Indexer(mockApp, settingsStoreWithMarkDone);

			// Create a source recurring event that is in the past
			const pastRecurringFile = createMockFile("Events/weekly-meeting.md");
			const pastDate = new Date();
			pastDate.setDate(pastDate.getDate() - 7); // 7 days ago

			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: {
					start: pastDate.toISOString(),
					end: new Date(pastDate.getTime() + 3600000).toISOString(), // 1 hour later
					RRule: "weekly", // This makes it a SOURCE recurring event
					Status: "active",
				},
			});

			mockVault.getMarkdownFiles.mockReturnValue([pastRecurringFile]);

			// Act: Start indexing which triggers markPastEventAsDone
			await indexerWithMarkDone.start();

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 200));

			// Assert: processFrontMatter should NOT be called because this is a source recurring event
			expect(processFrontMatterSpy).not.toHaveBeenCalled();

			indexerWithMarkDone.stop();
		});

		it("should mark regular past events as done when setting is enabled", async () => {
			// Setup: Enable the markPastInstancesAsDone setting
			const settingsWithMarkDone = {
				...settings,
				markPastInstancesAsDone: true,
				startProp: "start",
				endProp: "end",
				statusProperty: "Status",
				doneValue: "Done",
				rruleProp: "RRule",
			};
			const settingsStoreWithMarkDone = createMockSingleCalendarSettingsStore(settingsWithMarkDone);
			const indexerWithMarkDone = new Indexer(mockApp, settingsStoreWithMarkDone);

			// Create a regular event (NOT a recurring source) that is in the past
			const pastEventFile = createMockFile("Events/past-meeting.md");
			const pastDate = new Date();
			pastDate.setDate(pastDate.getDate() - 3); // 3 days ago

			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: {
					start: pastDate.toISOString(),
					end: new Date(pastDate.getTime() + 3600000).toISOString(), // 1 hour later
					Status: "active",
					// No RRule property - this is a regular event
				},
			});

			mockVault.getMarkdownFiles.mockReturnValue([pastEventFile]);

			// Act: Start indexing
			await indexerWithMarkDone.start();

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 200));

			// Assert: processFrontMatter should be called to mark the event as done
			expect(processFrontMatterSpy).toHaveBeenCalledWith(pastEventFile, expect.any(Function));

			// Verify the callback sets the status to done
			const callback = processFrontMatterSpy.mock.calls[0][1] as (fm: Record<string, any>) => void;
			const testFm: Record<string, any> = {};
			callback(testFm);
			expect(testFm.Status).toBe("Done");

			indexerWithMarkDone.stop();
		});

		it("should NOT mark future events as done", async () => {
			// Setup: Enable the markPastInstancesAsDone setting
			const settingsWithMarkDone = {
				...settings,
				markPastInstancesAsDone: true,
				startProp: "start",
				endProp: "end",
				statusProperty: "Status",
				doneValue: "Done",
			};
			const settingsStoreWithMarkDone = createMockSingleCalendarSettingsStore(settingsWithMarkDone);
			const indexerWithMarkDone = new Indexer(mockApp, settingsStoreWithMarkDone);

			// Create a future event
			const futureEventFile = createMockFile("Events/future-meeting.md");
			const futureDate = new Date();
			futureDate.setDate(futureDate.getDate() + 7); // 7 days in the future

			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: {
					start: futureDate.toISOString(),
					end: new Date(futureDate.getTime() + 3600000).toISOString(),
					Status: "active",
				},
			});

			mockVault.getMarkdownFiles.mockReturnValue([futureEventFile]);

			// Act: Start indexing
			await indexerWithMarkDone.start();

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 200));

			// Assert: processFrontMatter should NOT be called
			expect(processFrontMatterSpy).not.toHaveBeenCalled();

			indexerWithMarkDone.stop();
		});

		it("should NOT mark events as done when setting is disabled", async () => {
			// Setup: Disable the markPastInstancesAsDone setting
			const settingsWithoutMarkDone = {
				...settings,
				markPastInstancesAsDone: false,
				startProp: "start",
				endProp: "end",
			};
			const settingsStoreWithoutMarkDone = createMockSingleCalendarSettingsStore(settingsWithoutMarkDone);
			const indexerWithoutMarkDone = new Indexer(mockApp, settingsStoreWithoutMarkDone);

			// Create a past event
			const pastEventFile = createMockFile("Events/past-meeting.md");
			const pastDate = new Date();
			pastDate.setDate(pastDate.getDate() - 3);

			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: {
					start: pastDate.toISOString(),
					end: new Date(pastDate.getTime() + 3600000).toISOString(),
					Status: "active",
				},
			});

			mockVault.getMarkdownFiles.mockReturnValue([pastEventFile]);

			// Act: Start indexing
			await indexerWithoutMarkDone.start();

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 200));

			// Assert: processFrontMatter should NOT be called because setting is disabled
			expect(processFrontMatterSpy).not.toHaveBeenCalled();

			indexerWithoutMarkDone.stop();
		});

		it("should handle all-day past events correctly and NOT mark recurring sources", async () => {
			// Setup: Enable the markPastInstancesAsDone setting
			const settingsWithMarkDone = {
				...settings,
				markPastInstancesAsDone: true,
				dateProp: "Date",
				allDayProp: "All Day",
				statusProperty: "Status",
				doneValue: "Done",
				rruleProp: "RRule",
			};
			const settingsStoreWithMarkDone = createMockSingleCalendarSettingsStore(settingsWithMarkDone);
			const indexerWithMarkDone = new Indexer(mockApp, settingsStoreWithMarkDone);

			// Create an all-day recurring source event in the past
			const pastAllDayRecurringFile = createMockFile("Events/daily-task.md");
			const pastDate = new Date();
			pastDate.setDate(pastDate.getDate() - 5);
			const dateString = pastDate.toISOString().split("T")[0];

			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: {
					Date: dateString,
					"All Day": true,
					RRule: "daily", // SOURCE recurring event
					Status: "active",
				},
			});

			mockVault.getMarkdownFiles.mockReturnValue([pastAllDayRecurringFile]);

			// Act: Start indexing
			await indexerWithMarkDone.start();

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 200));

			// Assert: Should NOT mark as done because it's a source recurring event
			expect(processFrontMatterSpy).not.toHaveBeenCalled();

			indexerWithMarkDone.stop();
		});

		it("should NOT update status if already set to done value", async () => {
			// Setup: Enable the markPastInstancesAsDone setting
			const settingsWithMarkDone = {
				...settings,
				markPastInstancesAsDone: true,
				startProp: "start",
				endProp: "end",
				statusProperty: "Status",
				doneValue: "Done",
			};
			const settingsStoreWithMarkDone = createMockSingleCalendarSettingsStore(settingsWithMarkDone);
			const indexerWithMarkDone = new Indexer(mockApp, settingsStoreWithMarkDone);

			// Create a past event that is already marked as done
			const pastEventFile = createMockFile("Events/completed-meeting.md");
			const pastDate = new Date();
			pastDate.setDate(pastDate.getDate() - 3);

			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: {
					start: pastDate.toISOString(),
					end: new Date(pastDate.getTime() + 3600000).toISOString(),
					Status: "Done", // Already done
				},
			});

			mockVault.getMarkdownFiles.mockReturnValue([pastEventFile]);

			// Act: Start indexing
			await indexerWithMarkDone.start();

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 200));

			// Assert: processFrontMatter should NOT be called because status is already "Done"
			expect(processFrontMatterSpy).not.toHaveBeenCalled();

			indexerWithMarkDone.stop();
		});
	});

	function createMockFile(path: string): TFile {
		return {
			path,
			extension: "md",
			parent: { path: path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "" },
			stat: { mtime: Date.now() },
		} as any;
	}
});
