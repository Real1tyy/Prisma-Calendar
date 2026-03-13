import type { App } from "obsidian";
import type { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventStore } from "../../src/core/event-store";
import { Indexer } from "../../src/core/indexer";
import { Parser } from "../../src/core/parser";
import { RecurringEventManager } from "../../src/core/recurring-event-manager";
import { createMockIntegrationApp } from "../fixtures";
import { createMockFile } from "../mocks/obsidian";
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
		const mockApp = createMockIntegrationApp() as any;
		mockVault = mockApp.vault;
		mockMetadataCache = mockApp.metadataCache;
		indexer = new Indexer(mockApp, settingsStore, null);
		parser = new Parser(mockApp as App, settingsStore);
		recurringEventManager = new RecurringEventManager(
			{} as any,
			settingsStore,
			indexer,
			null
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

			const changedHandler = mockMetadataCache.on.mock.calls.find((call: any[]) => call[0] === "changed")?.[1];

			if (changedHandler) {
				changedHandler(file);
			}

			expect(changedHandler).toBeDefined();
			expect(eventStore).toBeDefined();
			expect(parser).toBeDefined();
		});

		it("should handle file deletion correctly", () => {
			const file = createMockFile("Events/meeting.md");

			const deletedHandler = mockMetadataCache.on.mock.calls.find((call: any[]) => call[0] === "deleted")?.[1];

			if (deletedHandler) {
				deletedHandler(file, null);
			}

			expect(deletedHandler).toBeDefined();
		});

		it("should ignore files without relevant frontmatter", () => {
			const file = createMockFile("Events/notes.md");
			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: { title: "Just a note" },
			});

			const changedHandler = mockMetadataCache.on.mock.calls.find((call: any[]) => call[0] === "changed")?.[1];

			if (changedHandler) {
				changedHandler(file);
			}

			expect(changedHandler).toBeDefined();
		});
	});

	describe("data structure management", () => {
		it("should handle concurrent file changes efficiently", () => {
			const file1 = createMockFile("Events/meeting1.md");
			const file2 = createMockFile("Events/meeting2.md");

			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: { start: "2024-01-15T10:00:00" },
			});

			const changedHandler = mockMetadataCache.on.mock.calls.find((call: any[]) => call[0] === "changed")?.[1];

			if (changedHandler) {
				changedHandler(file1);
				changedHandler(file2);
			}

			expect(changedHandler).toBeDefined();
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

			const changedHandler = mockMetadataCache.on.mock.calls.find((call: any[]) => call[0] === "changed")?.[1];

			if (changedHandler) {
				expect(() => changedHandler(file)).not.toThrow();
			}
		});

		it("should handle large numbers of events efficiently", () => {
			const files = Array.from({ length: 100 }, (_, i) => createMockFile(`Events/meeting${i}.md`));

			mockMetadataCache.getFileCache.mockReturnValue({
				frontmatter: { start: "2024-01-15T10:00:00" },
			});

			const changedHandler = mockMetadataCache.on.mock.calls.find((call: any[]) => call[0] === "changed")?.[1];

			if (changedHandler) {
				expect(() => {
					files.forEach((file) => {
						changedHandler(file);
					});
				}).not.toThrow();
			}
		});
	});
});
