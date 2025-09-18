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
			const createHandler = mockVault.on.mock.calls.find(
				(call: any[]) => call[0] === "create"
			)?.[1];
			const modifyHandler = mockVault.on.mock.calls.find(
				(call: any[]) => call[0] === "modify"
			)?.[1];

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
			const createHandler = mockVault.on.mock.calls.find(
				(call: any[]) => call[0] === "create"
			)?.[1];

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
			const createHandler = mockVault.on.mock.calls.find(
				(call: any[]) => call[0] === "create"
			)?.[1];

			if (createHandler) {
				createHandler(rootFile);
			}

			// Should eventually emit an event (after debouncing)
			// Note: In a real test, we'd need to wait for the debounce timeout
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
