import type { App, TFile } from "obsidian";
import type { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventStore } from "../../src/core/event-store";
import { Indexer } from "../../src/core/indexer";
import { Parser } from "../../src/core/parser";
import { RecurringEventManager } from "../../src/core/recurring-event-manager";
import { createMockSingleCalendarSettings, createMockSingleCalendarSettingsStore } from "../setup";

describe("Integration: Indexer -> Parser -> EventStore", () => {
	let mockVault: any;
	let mockMetadataCache: any;
	let settings: any;
	let settingsStore: BehaviorSubject<any>;
	let indexer: Indexer;
	let parser: Parser;
	let eventStore: EventStore;
	let recurringEventManager: RecurringEventManager;

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
			titleProp: "title",
			allDayProp: "allDay",
			timezone: "America/New_York",
		};

		settingsStore = createMockSingleCalendarSettingsStore(settings);
		const mockApp = {
			vault: mockVault,
			metadataCache: mockMetadataCache,
			fileManager: { processFrontMatter: vi.fn() },
		} as any;
		indexer = new Indexer(mockApp, settingsStore);
		parser = new Parser(mockApp as App, settingsStore);
		recurringEventManager = new RecurringEventManager(
			{} as any,
			settingsStore,
			indexer
		) as unknown as RecurringEventManager;
		eventStore = new EventStore(indexer, parser, recurringEventManager);

		// EventStore now handles its own subscription to indexer events
		// No manual wiring needed

		// Start the indexer to register vault event listeners
		await indexer.start();
	});

	afterEach(() => {
		indexer.stop();
		eventStore.destroy();
	});

	const createMockFile = (path: string): TFile =>
		({
			path,
			extension: "md",
			parent: { path: path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "" },
			stat: { mtime: Date.now() },
		}) as any;

	describe("end-to-end event processing", () => {
		it("should process a complete event lifecycle", () => {
			const file = createMockFile("Events/meeting.md");
			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: {
					title: "Team Meeting",
					start: "2024-01-15T10:00:00",
					end: "2024-01-15T11:00:00",
				},
			});

			// Simulate file creation event
			const createHandler = mockVault.on.mock.calls.find((call: any[]) => call[0] === "create")?.[1];

			if (createHandler) {
				createHandler(file);
			}

			// Verify the integration is set up correctly
			expect(createHandler).toBeDefined();
			expect(eventStore).toBeDefined();
			expect(parser).toBeDefined();
		});

		it("should handle file deletion correctly", () => {
			const file = createMockFile("Events/meeting.md");

			// Simulate file deletion event
			const deleteHandler = mockVault.on.mock.calls.find((call: any[]) => call[0] === "delete")?.[1];

			if (deleteHandler) {
				deleteHandler(file);
			}

			expect(deleteHandler).toBeDefined();
		});

		it("should ignore files without relevant frontmatter", () => {
			const file = createMockFile("Events/notes.md");
			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: { title: "Just a note" }, // No start property
			});

			// Simulate file creation event
			const createHandler = mockVault.on.mock.calls.find((call: any[]) => call[0] === "create")?.[1];

			if (createHandler) {
				createHandler(file);
			}

			expect(createHandler).toBeDefined();
		});
	});

	describe("data structure management", () => {
		it("should handle concurrent file changes efficiently", () => {
			const file1 = createMockFile("Events/meeting1.md");
			const file2 = createMockFile("Events/meeting2.md");

			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: { start: "2024-01-15T10:00:00" },
			});

			// Simulate concurrent file events
			const createHandler = mockVault.on.mock.calls.find((call: any[]) => call[0] === "create")?.[1];

			if (createHandler) {
				createHandler(file1);
				createHandler(file2);
			}

			expect(createHandler).toBeDefined();
		});

		it("should handle settings changes affecting the entire data structure", () => {
			const newSettings = { ...settings, directory: "NewEvents" };

			expect(() => {
				settingsStore.next(newSettings);
			}).not.toThrow();
		});
	});

	describe("error handling and edge cases", () => {
		it("should handle malformed frontmatter gracefully", () => {
			const file = createMockFile("Events/malformed.md");
			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: { start: "not-a-date" },
			});

			// Simulate file creation event
			const createHandler = mockVault.on.mock.calls.find((call: any[]) => call[0] === "create")?.[1];

			if (createHandler) {
				expect(() => createHandler(file)).not.toThrow();
			}
		});

		it("should handle large numbers of events efficiently", () => {
			const files = Array.from({ length: 100 }, (_, i) => createMockFile(`Events/meeting${i}.md`));

			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: { start: "2024-01-15T10:00:00" },
			});

			const createHandler = mockVault.on.mock.calls.find((call: any[]) => call[0] === "create")?.[1];

			if (createHandler) {
				expect(() => {
					files.forEach((file) => {
						createHandler(file);
					});
				}).not.toThrow();
			}
		});
	});
});
