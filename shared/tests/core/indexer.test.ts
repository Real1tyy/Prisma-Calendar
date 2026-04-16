import type { App, TFile } from "obsidian";
import { BehaviorSubject, lastValueFrom } from "rxjs";
import { take, toArray } from "rxjs/operators";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Indexer, type IndexerConfig, type IndexerEvent } from "../../src/core/indexer";
import { createMockApp, createMockFile } from "../../src/testing/mocks/obsidian";

describe("Indexer", () => {
	let mockApp: App;
	let configStore: BehaviorSubject<IndexerConfig>;
	let indexer: Indexer;

	// Mock event handlers storage
	const vaultHandlers: Map<string, Set<(...args: unknown[]) => void>> = new Map();
	const metadataCacheRefs: Map<symbol, { event: string; handler: (...args: unknown[]) => void }> = new Map();
	const metadataCacheHandlers: Map<string, Set<(...args: unknown[]) => void>> = new Map();

	beforeEach(() => {
		vaultHandlers.clear();
		metadataCacheRefs.clear();
		metadataCacheHandlers.clear();

		const app = createMockApp({
			vault: {
				getMarkdownFiles: vi.fn(() => []),
				on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
					if (!vaultHandlers.has(event)) {
						vaultHandlers.set(event, new Set());
					}
					vaultHandlers.get(event)?.add(handler);
					return {} as never;
				}),
				off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
					vaultHandlers.get(event)?.delete(handler);
				}),
			},
			metadataCache: {
				getFileCache: vi.fn(() => null),
				on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
					if (!metadataCacheHandlers.has(event)) {
						metadataCacheHandlers.set(event, new Set());
					}
					metadataCacheHandlers.get(event)?.add(handler);
					const ref = Symbol("eventRef");
					metadataCacheRefs.set(ref, { event, handler });
					if (event === "resolved") {
						queueMicrotask(() => handler());
					}
					return ref;
				}),
				offref: vi.fn((ref: symbol) => {
					const entry = metadataCacheRefs.get(ref);
					if (entry) {
						metadataCacheHandlers.get(entry.event)?.delete(entry.handler);
						metadataCacheRefs.delete(ref);
					}
				}),
			},
		});

		mockApp = app as unknown as App;

		configStore = new BehaviorSubject<IndexerConfig>({
			includeFile: (path) => path.startsWith("TestFolder/"),
			excludedDiffProps: new Set(["mtime"]),
			scanConcurrency: 5,
			debounceMs: 10, // Shorter debounce for faster tests
		});

		indexer = new Indexer(mockApp, configStore);
	});

	afterEach(() => {
		indexer.stop();
	});

	describe("initialization", () => {
		it("should create indexer with default config", () => {
			const minimalConfig = new BehaviorSubject<IndexerConfig>({});
			const minimalIndexer = new Indexer(mockApp, minimalConfig);

			expect(minimalIndexer).toBeDefined();
			expect(minimalIndexer.events$).toBeDefined();
			expect(minimalIndexer.indexingComplete$).toBeDefined();

			minimalIndexer.stop();
		});

		it("should expose events$ and indexingComplete$ observables", () => {
			expect(indexer.events$).toBeDefined();
			expect(indexer.indexingComplete$).toBeDefined();
		});
	});

	describe("start and stop", () => {
		it("should register event listeners on start", async () => {
			await indexer.start();

			expect(mockApp.metadataCache.on).toHaveBeenCalledWith("changed", expect.any(Function));
			expect(mockApp.metadataCache.on).toHaveBeenCalledWith("deleted", expect.any(Function));
			expect(mockApp.vault.on).toHaveBeenCalledWith("rename", expect.any(Function));
			expect(mockApp.vault.on).toHaveBeenCalledWith("modify", expect.any(Function));
			expect(mockApp.vault.on).not.toHaveBeenCalledWith("create", expect.any(Function));
			expect(mockApp.vault.on).not.toHaveBeenCalledWith("delete", expect.any(Function));
		});

		it("should unregister vault event listeners on stop", async () => {
			await indexer.start();
			indexer.stop();

			expect(mockApp.vault.off).toHaveBeenCalled();
		});
	});

	describe("file scanning", () => {
		it("should scan all markdown files in configured directory", async () => {
			const mockFile: TFile = {
				path: "TestFolder/note.md",
				basename: "note",
				extension: "md",
				parent: { path: "TestFolder" },
				stat: { mtime: Date.now() },
			} as TFile;

			vi.mocked(mockApp.vault.getMarkdownFiles).mockReturnValue([mockFile]);
			vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
				frontmatter: {
					title: "Test Note",
					tags: ["test"],
				},
			} as never);

			const eventsPromise = lastValueFrom(indexer.events$.pipe(take(1), toArray()));

			await indexer.start();

			const events = await eventsPromise;
			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("file-changed");
			expect(events[0].filePath).toBe("TestFolder/note.md");
			expect(events[0].source?.frontmatter).toEqual({
				title: "Test Note",
				tags: ["test"],
			});
		});

		it("should filter files not in configured directory", async () => {
			const mockFiles: TFile[] = [
				{
					path: "TestFolder/note.md",
					basename: "note",
					extension: "md",
					parent: { path: "TestFolder" },
					stat: { mtime: Date.now() },
				} as TFile,
				{
					path: "OtherFolder/other.md",
					basename: "other",
					extension: "md",
					parent: { path: "OtherFolder" },
					stat: { mtime: Date.now() },
				} as TFile,
			];

			vi.mocked(mockApp.vault.getMarkdownFiles).mockReturnValue(mockFiles);
			vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
				frontmatter: { title: "Test" },
			} as never);

			const eventsPromise = lastValueFrom(indexer.events$.pipe(take(1), toArray()));

			await indexer.start();

			const events = await eventsPromise;
			expect(events).toHaveLength(1);
			expect(events[0].filePath).toBe("TestFolder/note.md");
		});

		it("should skip files without frontmatter", async () => {
			const mockFile: TFile = {
				path: "TestFolder/note.md",
				basename: "note",
				extension: "md",
				parent: { path: "TestFolder" },
				stat: { mtime: Date.now() },
			} as TFile;

			vi.mocked(mockApp.vault.getMarkdownFiles).mockReturnValue([mockFile]);
			vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue(null);

			const events: unknown[] = [];
			const eventsSub = indexer.events$.subscribe((e) => events.push(e));

			await indexer.start();

			eventsSub.unsubscribe();

			// Should complete without emitting any file-changed events
			expect(events).toHaveLength(0);
		});
	});

	describe("resync", () => {
		it("should clear cache and rescan on resync", async () => {
			const mockFile: TFile = {
				path: "TestFolder/note.md",
				basename: "note",
				extension: "md",
				parent: { path: "TestFolder" },
				stat: { mtime: Date.now() },
			} as TFile;

			vi.mocked(mockApp.vault.getMarkdownFiles).mockReturnValue([mockFile]);
			vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
				frontmatter: { title: "Test" },
			} as never);

			await indexer.start();

			// Resync should trigger another scan
			const eventsPromise = lastValueFrom(indexer.events$.pipe(take(1), toArray()));
			indexer.resync();

			const events = await eventsPromise;
			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("file-changed");
		});
	});

	describe("config changes", () => {
		it("should rescan when includeFile config changes", async () => {
			await indexer.start();

			const mockFile: TFile = {
				path: "NewFolder/note.md",
				basename: "note",
				extension: "md",
				parent: { path: "NewFolder" },
				stat: { mtime: Date.now() },
			} as TFile;

			vi.mocked(mockApp.vault.getMarkdownFiles).mockReturnValue([mockFile]);
			vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
				frontmatter: { title: "Test" },
			} as never);

			const eventsPromise = lastValueFrom(indexer.events$.pipe(take(1), toArray()));

			// Change includeFile config
			configStore.next({
				includeFile: (path) => path.startsWith("NewFolder/"),
			});

			const events = await eventsPromise;
			expect(events).toHaveLength(1);
			expect(events[0].filePath).toBe("NewFolder/note.md");
		});

		it("should not rescan when non-includeFile config changes", async () => {
			await indexer.start();

			const scanSpy = vi.spyOn(mockApp.vault, "getMarkdownFiles");
			scanSpy.mockClear();

			// Change non-includeFile config (keep same function reference)
			const originalIncludeFile = configStore.value.includeFile;
			configStore.next({
				includeFile: originalIncludeFile, // Same function reference
				scanConcurrency: 20, // Different concurrency
			});

			// Wait a bit to ensure no scan happens
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Should not trigger new scan
			expect(scanSpy).not.toHaveBeenCalled();
		});
	});

	describe("error handling", () => {
		it("should handle errors during file processing", async () => {
			const mockFile: TFile = {
				path: "TestFolder/error.md",
				basename: "error",
				extension: "md",
				parent: { path: "TestFolder" },
				stat: { mtime: Date.now() },
			} as TFile;

			vi.mocked(mockApp.vault.getMarkdownFiles).mockReturnValue([mockFile]);

			vi.mocked(mockApp.metadataCache.getFileCache)
				.mockReturnValueOnce(null)
				.mockImplementation(() => {
					throw new Error("Cache error");
				});

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

			await indexer.start();

			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error processing file"), expect.any(Error));

			consoleErrorSpy.mockRestore();
		});
	});

	describe("preloaded files", () => {
		it("should use preloadedFiles instead of vault.getMarkdownFiles when provided", async () => {
			const preloadedFile: TFile = {
				path: "TestFolder/preloaded.md",
				basename: "preloaded",
				extension: "md",
				parent: { path: "TestFolder" },
				stat: { mtime: Date.now() },
			} as TFile;

			const vaultFile: TFile = {
				path: "TestFolder/from-vault.md",
				basename: "from-vault",
				extension: "md",
				parent: { path: "TestFolder" },
				stat: { mtime: Date.now() },
			} as TFile;

			vi.mocked(mockApp.vault.getMarkdownFiles).mockReturnValue([vaultFile]);
			vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
				frontmatter: { title: "Preloaded" },
			} as never);

			const preloadConfig = new BehaviorSubject<IndexerConfig>({
				includeFile: (path) => path.startsWith("TestFolder/"),
				debounceMs: 10,
				preloadedFiles: [preloadedFile],
			});
			const preloadIndexer = new Indexer(mockApp, preloadConfig);

			const eventsPromise = lastValueFrom(preloadIndexer.events$.pipe(take(1), toArray()));
			await preloadIndexer.start();
			const events = await eventsPromise;

			expect(events).toHaveLength(1);
			expect(events[0].filePath).toBe("TestFolder/preloaded.md");

			preloadIndexer.stop();
		});

		it("should track descendant files when directoryPrefix is set", async () => {
			const folderNote: TFile = {
				path: "People/Alice/Alice.md",
				basename: "Alice",
				extension: "md",
				parent: { path: "People/Alice" },
				stat: { mtime: Date.now() },
			} as TFile;

			const meetingFile: TFile = {
				path: "People/Alice/meeting-1.md",
				basename: "meeting-1",
				extension: "md",
				parent: { path: "People/Alice" },
				stat: { mtime: Date.now() },
			} as TFile;

			const outsideFile: TFile = {
				path: "Other/note.md",
				basename: "note",
				extension: "md",
				parent: { path: "Other" },
				stat: { mtime: Date.now() },
			} as TFile;

			vi.mocked(mockApp.vault.getMarkdownFiles).mockReturnValue([folderNote, meetingFile, outsideFile]);
			vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
				frontmatter: { name: "Alice" },
			} as never);

			const parentConfig = new BehaviorSubject<IndexerConfig>({
				includeFile: (path) => path === "People/Alice/Alice.md",
				debounceMs: 10,
				directoryPrefix: "People",
			});
			const parentIndexer = new Indexer(mockApp, parentConfig);

			await parentIndexer.start();

			expect(parentIndexer.descendantFiles).toHaveLength(1);
			expect(parentIndexer.descendantFiles[0].path).toBe("People/Alice/meeting-1.md");

			parentIndexer.stop();
		});

		it("should clear descendant files on stop", async () => {
			const meetingFile: TFile = {
				path: "People/Alice/meeting.md",
				basename: "meeting",
				extension: "md",
				parent: { path: "People/Alice" },
				stat: { mtime: Date.now() },
			} as TFile;

			vi.mocked(mockApp.vault.getMarkdownFiles).mockReturnValue([meetingFile]);

			const cfg = new BehaviorSubject<IndexerConfig>({
				includeFile: () => false,
				debounceMs: 10,
				directoryPrefix: "People",
			});
			const idx = new Indexer(mockApp, cfg);
			await idx.start();

			expect(idx.descendantFiles).toHaveLength(1);

			idx.stop();
			expect(idx.descendantFiles).toHaveLength(0);
		});

		it("should clear and repopulate descendant files on resync", async () => {
			const meetingFile: TFile = {
				path: "People/Alice/meeting.md",
				basename: "meeting",
				extension: "md",
				parent: { path: "People/Alice" },
				stat: { mtime: Date.now() },
			} as TFile;

			vi.mocked(mockApp.vault.getMarkdownFiles).mockReturnValue([meetingFile]);

			const cfg = new BehaviorSubject<IndexerConfig>({
				includeFile: () => false,
				debounceMs: 10,
				directoryPrefix: "People",
			});
			const idx = new Indexer(mockApp, cfg);
			await idx.start();

			expect(idx.descendantFiles).toHaveLength(1);

			vi.mocked(mockApp.vault.getMarkdownFiles).mockReturnValue([]);
			idx.resync();
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(idx.descendantFiles).toHaveLength(0);

			idx.stop();
		});

		it("should not track descendants when directoryPrefix is not set", async () => {
			const file: TFile = {
				path: "Anywhere/note.md",
				basename: "note",
				extension: "md",
				parent: { path: "Anywhere" },
				stat: { mtime: Date.now() },
			} as TFile;

			vi.mocked(mockApp.vault.getMarkdownFiles).mockReturnValue([file]);

			const cfg = new BehaviorSubject<IndexerConfig>({
				includeFile: () => false,
				debounceMs: 10,
			});
			const idx = new Indexer(mockApp, cfg);
			await idx.start();

			expect(idx.descendantFiles).toHaveLength(0);

			idx.stop();
		});
	});

	describe("runtime events", () => {
		const mockFile = createMockFile("TestFolder/note.md", { parentPath: "TestFolder" }) as TFile;
		(mockFile as unknown as { stat: { mtime: number } }).stat = { mtime: 1000 };
		const renamedFile = createMockFile("TestFolder/renamed.md", { parentPath: "TestFolder" }) as TFile;
		(renamedFile as unknown as { stat: { mtime: number } }).stat = { mtime: 1000 };

		function emitMetadataChanged(file: TFile): void {
			metadataCacheHandlers.get("changed")?.forEach((h) => h(file));
		}

		function emitMetadataDeleted(file: TFile): void {
			metadataCacheHandlers.get("deleted")?.forEach((h) => h(file, null));
		}

		function emitVaultModify(file: TFile): void {
			vaultHandlers.get("modify")?.forEach((h) => h(file));
		}

		function emitVaultRename(file: TFile, oldPath: string): void {
			vaultHandlers.get("rename")?.forEach((h) => h(file, oldPath));
		}

		async function collectEvents(target: Indexer, count: number, action: () => void): Promise<IndexerEvent[]> {
			const events: IndexerEvent[] = [];
			const sub = target.events$.subscribe((e) => events.push(e));
			action();
			await new Promise((resolve) => setTimeout(resolve, 50));
			sub.unsubscribe();
			return events.slice(-count);
		}

		it("should emit file-changed on metadataCache changed", async () => {
			vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
				frontmatter: { title: "Updated" },
			} as never);

			await indexer.start();

			const events = await collectEvents(indexer, 1, () => emitMetadataChanged(mockFile));
			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("file-changed");
			expect(events[0].filePath).toBe("TestFolder/note.md");
			expect(events[0].source?.frontmatter).toEqual({ title: "Updated" });
		});

		it("should emit file-deleted on metadataCache deleted", async () => {
			await indexer.start();

			const events = await collectEvents(indexer, 1, () => emitMetadataDeleted(mockFile));
			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("file-deleted");
			expect(events[0].filePath).toBe("TestFolder/note.md");
			expect(events[0].isRename).toBeUndefined();
		});

		it("should compute frontmatterDiff on subsequent changes", async () => {
			vi.mocked(mockApp.vault.getMarkdownFiles).mockReturnValue([mockFile]);
			vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
				frontmatter: { title: "Original", status: "draft" },
			} as never);

			await indexer.start();

			vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
				frontmatter: { title: "Updated", status: "draft" },
			} as never);

			const events = await collectEvents(indexer, 1, () => emitMetadataChanged(mockFile));
			expect(events).toHaveLength(1);
			expect(events[0].frontmatterDiff).toBeDefined();
			expect(events[0].frontmatterDiff?.hasChanges).toBe(true);
			expect(events[0].oldFrontmatter).toEqual({ title: "Original", status: "draft" });
		});

		describe("rename with emitRenameEvents=false (default)", () => {
			it("should emit file-deleted + file-changed pair", async () => {
				vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
					frontmatter: { title: "Note" },
				} as never);

				await indexer.start();

				const events = await collectEvents(indexer, 2, () => emitVaultRename(renamedFile, "TestFolder/note.md"));
				expect(events).toHaveLength(2);

				expect(events[0].type).toBe("file-deleted");
				expect(events[0].filePath).toBe("TestFolder/note.md");
				expect(events[0].isRename).toBe(true);

				expect(events[1].type).toBe("file-changed");
				expect(events[1].filePath).toBe("TestFolder/renamed.md");
				expect(events[1].oldPath).toBe("TestFolder/note.md");
			});
		});

		describe("rename with emitRenameEvents=true", () => {
			let renameIndexer: Indexer;

			beforeEach(() => {
				const renameConfig = new BehaviorSubject<IndexerConfig>({
					includeFile: (path) => path.startsWith("TestFolder/"),
					debounceMs: 10,
					emitRenameEvents: true,
				});
				renameIndexer = new Indexer(mockApp, renameConfig);
			});

			afterEach(() => {
				renameIndexer.stop();
			});

			it("should emit a single file-renamed event", async () => {
				vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
					frontmatter: { title: "Note" },
				} as never);

				await renameIndexer.start();

				const events = await collectEvents(renameIndexer, 1, () => emitVaultRename(renamedFile, "TestFolder/note.md"));
				expect(events).toHaveLength(1);
				expect(events[0].type).toBe("file-renamed");
				expect(events[0].filePath).toBe("TestFolder/renamed.md");
				expect(events[0].oldPath).toBe("TestFolder/note.md");
			});

			it("should not emit file-deleted or file-changed on rename", async () => {
				await renameIndexer.start();

				const events = await collectEvents(renameIndexer, 1, () => emitVaultRename(renamedFile, "TestFolder/note.md"));

				for (const event of events) {
					expect(event.type).toBe("file-renamed");
				}
			});

			it("should re-key frontmatter cache on rename", async () => {
				vi.mocked(mockApp.vault.getMarkdownFiles).mockReturnValue([mockFile]);
				vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
					frontmatter: { title: "Cached" },
				} as never);

				await renameIndexer.start();

				emitVaultRename(renamedFile, "TestFolder/note.md");
				await new Promise((resolve) => setTimeout(resolve, 50));

				vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
					frontmatter: { title: "Modified After Rename" },
				} as never);

				const events = await collectEvents(renameIndexer, 1, () => emitMetadataChanged(renamedFile));
				expect(events).toHaveLength(1);
				expect(events[0].type).toBe("file-changed");
				expect(events[0].oldFrontmatter).toEqual({ title: "Cached" });
				expect(events[0].frontmatterDiff).toBeDefined();
			});
		});

		it("should filter out non-markdown files from rename events", async () => {
			const nonMdFile = createMockFile("TestFolder/image.png", {
				extension: "png",
				parentPath: "TestFolder",
			}) as TFile;

			await indexer.start();

			const events = await collectEvents(indexer, 0, () => emitVaultRename(nonMdFile, "TestFolder/old-image.png"));
			expect(events).toHaveLength(0);
		});

		it("should filter out files outside configured directory from rename events", async () => {
			const outsideFile = createMockFile("OtherFolder/note.md", { parentPath: "OtherFolder" }) as TFile;

			await indexer.start();

			const events = await collectEvents(indexer, 0, () => emitVaultRename(outsideFile, "TestFolder/note.md"));
			expect(events).toHaveLength(0);
		});

		describe("vault.modify for content-only changes", () => {
			it("should emit file-changed on vault.modify when metadataCache.changed does not fire", async () => {
				vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
					frontmatter: { title: "Note Content" },
				} as never);

				await indexer.start();

				const events = await collectEvents(indexer, 1, () => emitVaultModify(mockFile));
				expect(events).toHaveLength(1);
				expect(events[0].type).toBe("file-changed");
				expect(events[0].filePath).toBe("TestFolder/note.md");
			});

			it("should debounce vault.modify with metadataCache.changed for the same file", async () => {
				vi.mocked(mockApp.metadataCache.getFileCache).mockReturnValue({
					frontmatter: { title: "Note" },
				} as never);

				await indexer.start();

				const events = await collectEvents(indexer, 1, () => {
					emitVaultModify(mockFile);
					emitMetadataChanged(mockFile);
				});

				expect(events).toHaveLength(1);
				expect(events[0].type).toBe("file-changed");
			});

			it("should filter out non-relevant files from vault.modify", async () => {
				const outsideFile = createMockFile("OtherFolder/note.md", { parentPath: "OtherFolder" }) as TFile;
				(outsideFile as unknown as { stat: { mtime: number } }).stat = { mtime: 1000 };

				await indexer.start();

				const events = await collectEvents(indexer, 0, () => emitVaultModify(outsideFile));
				expect(events).toHaveLength(0);
			});
		});
	});
});
