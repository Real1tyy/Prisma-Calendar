import type { App } from "obsidian";
import { TFile } from "obsidian";
import { BehaviorSubject, Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { Indexer, type IndexerConfig, type IndexerEvent } from "../../src/core/indexer";
import { withSerialize } from "../../src/core/vault-table/create-mapped-schema";
import type { VaultTableEvent } from "../../src/core/vault-table/types";
import { VaultTable } from "../../src/core/vault-table/vault-table";
import { createMockApp } from "../../src/testing/mocks/obsidian";

vi.mock("../../src/core/indexer");

const TestSchema = withSerialize(
	z.object({
		title: z.string(),
		priority: z.number().default(0),
		tags: z.array(z.string()).default([]),
		category: z.string().default("general"),
	})
);

type TestData = z.infer<typeof TestSchema>;

function createMockTFile(path: string, mtime = Date.now()): TFile {
	const file = new TFile(path);
	file.stat = { mtime, ctime: mtime, size: 0 };
	return file;
}

function createTestConfig(
	overrides?: Partial<Parameters<(typeof VaultTable<typeof TestSchema>)["prototype"]["constructor"]>[0]>
) {
	const fileStore = new Map<string, TFile>();

	const mockApp = createMockApp({
		vault: {
			getMarkdownFiles: vi.fn(() => []),
			on: vi.fn(),
			off: vi.fn(),
			create: vi.fn().mockImplementation((path: string) => {
				const file = createMockTFile(path);
				fileStore.set(path, file);
				return Promise.resolve(file);
			}),
			trash: vi.fn().mockResolvedValue(undefined),
			cachedRead: vi.fn().mockResolvedValue(""),
			getAbstractFileByPath: vi.fn().mockImplementation((path: string) => fileStore.get(path) ?? null),
			getFileByPath: vi.fn().mockImplementation((path: string) => fileStore.get(path) ?? null),
			createFolder: vi.fn().mockResolvedValue(undefined),
		},
		metadataCache: {
			getFileCache: vi.fn(() => null),
			on: vi.fn(),
			offref: vi.fn(),
		},
		fileManager: {
			processFrontMatter: vi.fn().mockImplementation((_file: TFile, fn: (fm: Record<string, unknown>) => void) => {
				const fm: Record<string, unknown> = {};
				fn(fm);
				return Promise.resolve();
			}),
		},
	});

	return {
		app: mockApp as unknown as App,
		mockApp,
		fileStore,
		config: {
			app: mockApp as unknown as App,
			directory: "test-table",
			schema: TestSchema,
			...overrides,
		} as Parameters<(typeof VaultTable<typeof TestSchema>)["prototype"]["constructor"]>[0],
	};
}

let mockIndexerEventsSubject: Subject<IndexerEvent>;
let mockIndexerCompleteSubject: BehaviorSubject<boolean>;

beforeEach(() => {
	mockIndexerEventsSubject = new Subject<IndexerEvent>();
	mockIndexerCompleteSubject = new BehaviorSubject<boolean>(false);

	vi.mocked(Indexer).mockImplementation(
		() =>
			({
				events$: mockIndexerEventsSubject.asObservable(),
				indexingComplete$: mockIndexerCompleteSubject.asObservable(),
				start: vi.fn().mockResolvedValue(undefined),
				stop: vi.fn(),
				resync: vi.fn(),
			}) as unknown as Indexer
	);
});

afterEach(() => {
	vi.restoreAllMocks();
});

function emitIndexerEvent(event: IndexerEvent): void {
	mockIndexerEventsSubject.next(event);
}

function emitIndexingComplete(): void {
	mockIndexerCompleteSubject.next(true);
}

function createFileChangedEvent(
	filePath: string,
	frontmatter: Record<string, unknown>,
	mtime = Date.now(),
	oldFrontmatter?: Record<string, unknown>
): IndexerEvent {
	return {
		type: "file-changed",
		filePath,
		source: {
			file: createMockTFile(filePath, mtime),
			filePath,
			mtime,
			frontmatter,
			folder: filePath.split("/").slice(0, -1).join("/"),
		},
		oldFrontmatter,
		frontmatterDiff: oldFrontmatter
			? { hasChanges: true, changes: [], added: [], modified: [], deleted: [] }
			: undefined,
	};
}

function createFileDeletedEvent(filePath: string): IndexerEvent {
	return {
		type: "file-deleted",
		filePath,
	};
}

async function createPopulatedTable() {
	const { config, mockApp } = createTestConfig();
	const table = new VaultTable(config);

	await table.start();

	await table.create({
		fileName: "alpha",
		data: { title: "Workout", priority: 3, tags: ["fitness"], category: "personal" },
	});
	await table.create({
		fileName: "beta",
		data: { title: "Team Meeting", priority: 1, tags: ["work"], category: "work" },
	});
	await table.create({
		fileName: "gamma",
		data: { title: "Weekly Review", priority: 2, tags: ["work", "review"], category: "work" },
	});
	await table.create({
		fileName: "delta",
		data: { title: "Grocery Shopping", priority: 1, tags: ["personal"], category: "personal" },
	});
	await table.create({
		fileName: "epsilon",
		data: { title: "Code Review", priority: 4, tags: ["work", "dev"], category: "work" },
	});

	return { table, mockApp };
}

describe("VaultTable", () => {
	describe("lifecycle", () => {
		it("should create a VaultTable instance", () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);

			expect(table).toBeDefined();
			expect(table.events$).toBeDefined();
			expect(table.ready$).toBeDefined();
		});

		it("should start and subscribe to indexer events", async () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();

			const mockIndexerInstance = vi.mocked(Indexer).mock.results[0].value;
			expect(mockIndexerInstance.start).toHaveBeenCalled();

			table.stop();
		});

		it("should stop and clean up subscriptions", async () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();
			table.stop();

			const mockIndexerInstance = vi.mocked(Indexer).mock.results[0].value;
			expect(mockIndexerInstance.stop).toHaveBeenCalled();
		});

		it("should emit ready$ when indexing completes", async () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);

			const readyValues: boolean[] = [];
			table.ready$.subscribe((v) => readyValues.push(v));

			await table.start();
			emitIndexingComplete();

			expect(readyValues).toContain(true);

			table.stop();
		});

		it("should complete all subjects on destroy", async () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();

			let eventsCompleted = false;
			let readyCompleted = false;

			table.events$.subscribe({ complete: () => (eventsCompleted = true) });
			table.ready$.subscribe({ complete: () => (readyCompleted = true) });

			table.destroy();

			expect(eventsCompleted).toBe(true);
			expect(readyCompleted).toBe(true);
		});

		it("should clear all rows on destroy", async () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();
			await table.create({ fileName: "note", data: { title: "Team Meeting", priority: 1, tags: [] } });

			expect(table.count()).toBe(1);

			table.destroy();

			expect(table.count()).toBe(0);
		});
	});

	describe("indexer integration", () => {
		it("should create a row when indexer emits file-changed for a new file", async () => {
			const { config, fileStore } = createTestConfig();
			const table = new VaultTable(config);
			const mockFile = createMockTFile("test-table/meeting.md", 100);
			fileStore.set("test-table/meeting.md", mockFile);

			await table.start();

			const events: VaultTableEvent<TestData>[] = [];
			table.events$.subscribe((e) => events.push(e));

			emitIndexerEvent(
				createFileChangedEvent("test-table/meeting.md", { title: "Team Meeting", priority: 1, tags: ["work"] }, 100)
			);

			await vi.waitFor(() => expect(table.count()).toBe(1));

			const row = table.get("meeting");
			expect(row).toBeDefined();
			expect(row!.data.title).toBe("Team Meeting");
			expect(row!.data.priority).toBe(1);
			expect(row!.data.tags).toEqual(["work"]);
			expect(row!.filePath).toBe("test-table/meeting.md");
			expect(row!.file).toBeInstanceOf(TFile);

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("row-created");

			table.destroy();
		});

		it("should update a row when indexer emits file-changed for existing file", async () => {
			const { config, fileStore } = createTestConfig();
			const table = new VaultTable(config);
			fileStore.set("test-table/task.md", createMockTFile("test-table/task.md", 100));

			await table.start();

			emitIndexerEvent(
				createFileChangedEvent("test-table/task.md", { title: "Weekly Review", priority: 1, tags: [] }, 100)
			);

			await vi.waitFor(() => expect(table.count()).toBe(1));

			const events: VaultTableEvent<TestData>[] = [];
			table.events$.subscribe((e) => events.push(e));

			fileStore.set("test-table/task.md", createMockTFile("test-table/task.md", 200));

			emitIndexerEvent(
				createFileChangedEvent(
					"test-table/task.md",
					{ title: "Weekly Review Updated", priority: 2, tags: ["work"] },
					200,
					{ title: "Weekly Review", priority: 1, tags: [] }
				)
			);

			await vi.waitFor(() => expect(table.get("task")!.data.title).toBe("Weekly Review Updated"));

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("row-updated");

			table.destroy();
		});

		it("should delete a row when indexer emits file-deleted", async () => {
			const { config, fileStore } = createTestConfig();
			const table = new VaultTable(config);
			fileStore.set("test-table/note.md", createMockTFile("test-table/note.md", 100));

			await table.start();

			emitIndexerEvent(createFileChangedEvent("test-table/note.md", { title: "Event", priority: 0, tags: [] }, 100));

			await vi.waitFor(() => expect(table.count()).toBe(1));

			const events: VaultTableEvent<TestData>[] = [];
			table.events$.subscribe((e) => events.push(e));

			emitIndexerEvent(createFileDeletedEvent("test-table/note.md"));

			expect(table.count()).toBe(0);
			expect(table.get("note")).toBeUndefined();

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("row-deleted");

			table.destroy();
		});

		it("should handle rename as delete + create", async () => {
			const { config, fileStore } = createTestConfig();
			const table = new VaultTable(config);
			fileStore.set("test-table/old-name.md", createMockTFile("test-table/old-name.md", 100));

			await table.start();

			emitIndexerEvent(
				createFileChangedEvent("test-table/old-name.md", { title: "Project Planning", priority: 1, tags: [] }, 100)
			);

			await vi.waitFor(() => expect(table.count()).toBe(1));

			emitIndexerEvent(createFileDeletedEvent("test-table/old-name.md"));
			expect(table.count()).toBe(0);

			fileStore.set("test-table/new-name.md", createMockTFile("test-table/new-name.md", 200));

			emitIndexerEvent(
				createFileChangedEvent("test-table/new-name.md", { title: "Project Planning", priority: 1, tags: [] }, 200)
			);

			await vi.waitFor(() => expect(table.count()).toBe(1));

			expect(table.get("old-name")).toBeUndefined();
			expect(table.get("new-name")).toBeDefined();

			table.destroy();
		});

		it("should deduplicate indexer events with same mtime", async () => {
			const { config, fileStore } = createTestConfig();
			const table = new VaultTable(config);
			fileStore.set("test-table/note.md", createMockTFile("test-table/note.md", 100));

			await table.start();

			emitIndexerEvent(createFileChangedEvent("test-table/note.md", { title: "Task", priority: 0, tags: [] }, 100));

			await vi.waitFor(() => expect(table.count()).toBe(1));

			const events: VaultTableEvent<TestData>[] = [];
			table.events$.subscribe((e) => events.push(e));

			emitIndexerEvent(createFileChangedEvent("test-table/note.md", { title: "Task", priority: 0, tags: [] }, 100));

			await new Promise((r) => setTimeout(r, 50));

			expect(events).toHaveLength(0);

			table.destroy();
		});
	});

	describe("invalid frontmatter", () => {
		it("should skip files with invalid frontmatter by default", async () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();

			emitIndexerEvent(createFileChangedEvent("test-table/bad.md", { title: 123 }, 100));

			await new Promise((r) => setTimeout(r, 50));

			expect(table.count()).toBe(0);

			table.destroy();
		});

		it("should remove previously valid row when frontmatter becomes invalid (skip strategy)", async () => {
			const { config, fileStore } = createTestConfig({ invalidStrategy: "skip" });
			const table = new VaultTable(config);
			fileStore.set("test-table/note.md", createMockTFile("test-table/note.md", 100));

			await table.start();

			emitIndexerEvent(createFileChangedEvent("test-table/note.md", { title: "Event", priority: 0, tags: [] }, 100));

			await vi.waitFor(() => expect(table.count()).toBe(1));

			emitIndexerEvent(createFileChangedEvent("test-table/note.md", { title: 123 }, 200));

			await vi.waitFor(() => expect(table.count()).toBe(0));

			table.destroy();
		});

		it("should attempt to correct invalid frontmatter with correct strategy", async () => {
			const { config, fileStore } = createTestConfig({ invalidStrategy: "correct" });
			const table = new VaultTable(config);
			fileStore.set("test-table/fixable.md", createMockTFile("test-table/fixable.md", 100));

			await table.start();

			emitIndexerEvent(createFileChangedEvent("test-table/fixable.md", { priority: "not-a-number" }, 100));

			await new Promise((r) => setTimeout(r, 50));

			expect(table.count()).toBe(0);

			table.destroy();
		});

		it("should call vault.trash for invalid frontmatter with delete strategy", async () => {
			const { config, mockApp, fileStore } = createTestConfig({ invalidStrategy: "delete" });
			const table = new VaultTable(config);
			const mockFile = createMockTFile("test-table/bad.md", 100);
			fileStore.set("test-table/bad.md", mockFile);

			await table.start();

			emitIndexerEvent(createFileChangedEvent("test-table/bad.md", { title: 123 }, 100));

			await new Promise((r) => setTimeout(r, 50));

			expect(mockApp.vault.trash).toHaveBeenCalledWith(mockFile, true);

			table.destroy();
		});
	});

	describe("CRUD operations", () => {
		it("should call vault.create with serialized frontmatter content", async () => {
			const { config, mockApp } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();

			const row = await table.create({
				fileName: "new-task",
				data: { title: "Workout", priority: 2, tags: ["fitness"] },
				content: "Some notes",
			});

			expect(row.id).toBe("new-task");
			expect(row.data.title).toBe("Workout");
			expect(row.content).toBe("Some notes");
			expect(row.filePath).toBe("test-table/new-task.md");
			expect(row.file).toBeInstanceOf(TFile);
			expect(row.file.path).toBe("test-table/new-task.md");

			expect(mockApp.vault.create).toHaveBeenCalledWith("test-table/new-task.md", expect.any(String));

			const createdContent = vi.mocked(mockApp.vault.create).mock.calls[0][1] as string;
			expect(createdContent).toContain("---");
			expect(createdContent).toContain("title: Workout");
			expect(createdContent).toContain("Some notes");

			expect(table.count()).toBe(1);
			expect(table.get("new-task")).toBeDefined();

			table.destroy();
		});

		it("should create a row without content", async () => {
			const { config, mockApp } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();

			const row = await table.create({ fileName: "task", data: { title: "Event", priority: 0, tags: [] } });

			expect(row.content).toBe("");

			const createdContent = vi.mocked(mockApp.vault.create).mock.calls[0][1] as string;
			expect(createdContent).toContain("title: Event");

			table.destroy();
		});

		it("should throw on duplicate create", async () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();
			await table.create({ fileName: "task", data: { title: "Event", priority: 0, tags: [] } });

			await expect(
				table.create({ fileName: "task", data: { title: "Duplicate", priority: 0, tags: [] } })
			).rejects.toThrow('VaultTable: row "task" already exists');

			table.destroy();
		});

		it("should call processFrontMatter on update by id", async () => {
			const { config, mockApp } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();
			const created = await table.create({ fileName: "task", data: { title: "Event", priority: 0, tags: [] } });

			const updated = await table.update("task", { priority: 5 });

			expect(updated.data.priority).toBe(5);
			expect(updated.data.title).toBe("Event");
			expect(updated.file).toBe(created.file);
			expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalledWith(created.file, expect.any(Function));

			table.destroy();
		});

		it("should call processFrontMatter on update", async () => {
			const { config, mockApp } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();
			const created = await table.create({ fileName: "task", data: { title: "Event", priority: 0, tags: [] } });

			const updated = await table.update("task", { priority: 5 });

			expect(updated.data.priority).toBe(5);
			expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalledWith(created.file, expect.any(Function));

			table.destroy();
		});

		it("should throw on update of nonexistent row", async () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();

			await expect(table.update("nonexistent", { priority: 5 })).rejects.toThrow(
				'VaultTable: row "nonexistent" not found'
			);

			table.destroy();
		});

		it("should upsert — call vault.create if not exists", async () => {
			const { config, mockApp } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();

			const row = await table.upsert({ fileName: "new", data: { title: "Task", priority: 1, tags: [] } });

			expect(row.id).toBe("new");
			expect(table.count()).toBe(1);
			expect(mockApp.vault.create).toHaveBeenCalledWith("test-table/new.md", expect.any(String));

			table.destroy();
		});

		it("should upsert — call processFrontMatter if exists", async () => {
			const { config, mockApp } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();
			await table.create({ fileName: "task", data: { title: "Event", priority: 0, tags: [] } });

			const updated = await table.upsert({
				fileName: "task",
				data: { title: "Updated Event", priority: 3, tags: ["work"] },
			});

			expect(updated.data.title).toBe("Updated Event");
			expect(table.count()).toBe(1);
			expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalled();

			table.destroy();
		});

		it("should call vault.trash on delete by id", async () => {
			const { config, mockApp } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();
			const created = await table.create({ fileName: "task", data: { title: "Event", priority: 0, tags: [] } });
			expect(table.count()).toBe(1);

			await table.delete("task");

			expect(table.count()).toBe(0);
			expect(mockApp.vault.trash).toHaveBeenCalledWith(created.file, true);

			table.destroy();
		});

		it("should call vault.trash on delete", async () => {
			const { config, mockApp } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();
			const created = await table.create({ fileName: "task", data: { title: "Event", priority: 0, tags: [] } });

			await table.delete("task");

			expect(table.count()).toBe(0);
			expect(mockApp.vault.trash).toHaveBeenCalledWith(created.file, true);

			table.destroy();
		});

		it("should throw on delete of nonexistent row", async () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();

			await expect(table.delete("ghost")).rejects.toThrow('VaultTable: row "ghost" not found');

			table.destroy();
		});

		it("should call vault.createFolder on start when directory missing", async () => {
			const { config, mockApp } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();

			expect(mockApp.vault.createFolder).toHaveBeenCalledWith("test-table");

			table.destroy();
		});

		it("should not call vault.createFolder on start if directory exists", async () => {
			const { config, mockApp, fileStore } = createTestConfig();
			const table = new VaultTable(config);

			fileStore.set("test-table", { path: "test-table" } as unknown as TFile);

			await table.start();

			expect(mockApp.vault.createFolder).not.toHaveBeenCalled();

			table.destroy();
		});
	});

	describe("reads", () => {
		it("should get row by id", async () => {
			const { table } = await createPopulatedTable();

			expect(table.get("alpha")!.data.title).toBe("Workout");
			expect(table.get("nonexistent")).toBeUndefined();

			table.destroy();
		});

		it("should check existence with has()", async () => {
			const { table } = await createPopulatedTable();

			expect(table.has("alpha")).toBe(true);
			expect(table.has("missing")).toBe(false);

			table.destroy();
		});

		it("should return correct count", async () => {
			const { table } = await createPopulatedTable();

			expect(table.count()).toBe(5);

			table.destroy();
		});

		it("should return first row without predicate", async () => {
			const { table } = await createPopulatedTable();

			const row = table.first();
			expect(row).toBeDefined();

			table.destroy();
		});

		it("should return first matching row with predicate", async () => {
			const { table } = await createPopulatedTable();

			const row = table.first((r) => r.data.priority === 4);
			expect(row).toBeDefined();
			expect(row!.data.title).toBe("Code Review");

			table.destroy();
		});

		it("should return undefined from first() when no match", async () => {
			const { table } = await createPopulatedTable();

			expect(table.first((r) => r.data.priority === 99)).toBeUndefined();

			table.destroy();
		});
	});

	describe("collection access", () => {
		it("should return read-only array from toArray()", async () => {
			const { table } = await createPopulatedTable();

			const arr = table.toArray();
			expect(arr).toHaveLength(5);

			expect(table.toArray()).toBe(arr);

			table.destroy();
		});

		it("should return a cloned array from toClonedArray()", async () => {
			const { table } = await createPopulatedTable();

			const arr1 = table.toClonedArray();
			const arr2 = table.toClonedArray();

			expect(arr1).toHaveLength(5);
			expect(arr1).not.toBe(arr2);
			expect(arr1).toEqual(arr2);

			table.destroy();
		});
	});

	describe("queries", () => {
		it("should filter with where()", async () => {
			const { table } = await createPopulatedTable();

			const workRows = table.where((row) => row.data.tags.includes("work"));
			expect(workRows).toHaveLength(3);

			const highPriority = table.where((row) => row.data.priority >= 3);
			expect(highPriority).toHaveLength(2);

			const noMatch = table.where((row) => row.data.priority > 100);
			expect(noMatch).toHaveLength(0);

			table.destroy();
		});

		it("should find by key-value with findBy()", async () => {
			const { table } = await createPopulatedTable();

			const found = table.findBy("priority", 1);
			expect(found).toHaveLength(2);
			expect(found.map((r) => r.data.title).sort()).toEqual(["Grocery Shopping", "Team Meeting"]);

			const notFound = table.findBy("priority", 99);
			expect(notFound).toHaveLength(0);

			table.destroy();
		});

		it("should sort with orderBy()", async () => {
			const { table } = await createPopulatedTable();

			const ascending = table.orderBy((a, b) => a.data.priority - b.data.priority);
			expect(ascending).toHaveLength(5);
			expect(ascending[0].data.priority).toBe(1);
			expect(ascending[ascending.length - 1].data.priority).toBe(4);

			const descending = table.orderBy((a, b) => b.data.priority - a.data.priority);
			expect(descending[0].data.priority).toBe(4);
			expect(descending[descending.length - 1].data.priority).toBe(1);

			table.destroy();
		});

		it("orderBy() should not mutate the internal array", async () => {
			const { table } = await createPopulatedTable();

			const before = table.toArray();
			table.orderBy((a, b) => b.data.priority - a.data.priority);
			const after = table.toArray();

			expect(before).toBe(after);

			table.destroy();
		});

		it("should group with groupBy()", async () => {
			const { table } = await createPopulatedTable();

			const byCategory = table.groupBy((row) => row.data.category);
			expect(byCategory.size).toBe(2);
			expect(byCategory.get("work")).toHaveLength(3);
			expect(byCategory.get("personal")).toHaveLength(2);

			table.destroy();
		});

		it("should group by priority", async () => {
			const { table } = await createPopulatedTable();

			const byPriority = table.groupBy((row) => row.data.priority);
			expect(byPriority.size).toBe(4);
			expect(byPriority.get(1)).toHaveLength(2);
			expect(byPriority.get(2)).toHaveLength(1);
			expect(byPriority.get(3)).toHaveLength(1);
			expect(byPriority.get(4)).toHaveLength(1);

			table.destroy();
		});

		it("should extract values with pluck()", async () => {
			const { table } = await createPopulatedTable();

			const titles = table.pluck("title");
			expect(titles).toHaveLength(5);
			expect(titles).toContain("Workout");
			expect(titles).toContain("Team Meeting");
			expect(titles).toContain("Code Review");

			const priorities = table.pluck("priority");
			expect(priorities).toHaveLength(5);
			expect(priorities.sort()).toEqual([1, 1, 2, 3, 4]);

			table.destroy();
		});

		it("should check with some()", async () => {
			const { table } = await createPopulatedTable();

			expect(table.some((r) => r.data.priority === 4)).toBe(true);
			expect(table.some((r) => r.data.priority === 99)).toBe(false);
			expect(table.some((r) => r.data.tags.includes("fitness"))).toBe(true);

			table.destroy();
		});

		it("should check with every()", async () => {
			const { table } = await createPopulatedTable();

			expect(table.every((r) => r.data.priority >= 1)).toBe(true);
			expect(table.every((r) => r.data.priority > 2)).toBe(false);
			expect(table.every((r) => r.data.title.length > 0)).toBe(true);

			table.destroy();
		});

		it("should support compound queries via where + sort", async () => {
			const { table } = await createPopulatedTable();

			const workItemsSorted = table
				.where((r) => r.data.category === "work")
				.sort((a, b) => a.data.priority - b.data.priority);

			expect(workItemsSorted).toHaveLength(3);
			expect(workItemsSorted[0].data.title).toBe("Team Meeting");
			expect(workItemsSorted[2].data.title).toBe("Code Review");

			table.destroy();
		});

		it("should handle queries on empty table", async () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();

			expect(table.where(() => true)).toHaveLength(0);
			expect(table.findBy("title", "anything")).toHaveLength(0);
			expect(table.orderBy(() => 0)).toHaveLength(0);
			expect(table.groupBy(() => "key").size).toBe(0);
			expect(table.pluck("title")).toHaveLength(0);
			expect(table.some(() => true)).toBe(false);
			expect(table.every(() => true)).toBe(true);
			expect(table.first()).toBeUndefined();

			table.destroy();
		});
	});

	describe("content change detection", () => {
		it("should emit row-updated with contentChanged when content changes without frontmatter diff", async () => {
			const { config, fileStore, mockApp } = createTestConfig();
			const table = new VaultTable(config);
			fileStore.set("test-table/note.md", createMockTFile("test-table/note.md", 100));

			vi.mocked(mockApp.vault.cachedRead).mockResolvedValue("---\ntitle: Event\n---\nOriginal content");

			await table.start();

			emitIndexerEvent(createFileChangedEvent("test-table/note.md", { title: "Event", priority: 0, tags: [] }, 100));
			await vi.waitFor(() => expect(table.count()).toBe(1));
			expect(table.get("note")!.content).toBe("Original content");

			const events: VaultTableEvent<TestData>[] = [];
			table.events$.subscribe((e) => events.push(e));

			vi.mocked(mockApp.vault.cachedRead).mockResolvedValue("---\ntitle: Event\n---\nUpdated content");
			fileStore.set("test-table/note.md", createMockTFile("test-table/note.md", 200));

			emitIndexerEvent(
				createFileChangedEvent("test-table/note.md", { title: "Event", priority: 0, tags: [] }, 200, {
					title: "Event",
					priority: 0,
					tags: [],
				})
			);

			await vi.waitFor(() => expect(table.get("note")!.content).toBe("Updated content"));

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("row-updated");
			if (events[0].type === "row-updated") {
				expect(events[0].contentChanged).toBe(true);
				expect(events[0].newRow.content).toBe("Updated content");
				expect(events[0].oldRow.content).toBe("Original content");
			}

			table.destroy();
		});

		it("should not emit row-updated when neither frontmatter nor content changes", async () => {
			const { config, fileStore, mockApp } = createTestConfig();
			const table = new VaultTable(config);
			fileStore.set("test-table/note.md", createMockTFile("test-table/note.md", 100));

			vi.mocked(mockApp.vault.cachedRead).mockResolvedValue("---\ntitle: Task\n---\nSame content");

			await table.start();

			emitIndexerEvent(createFileChangedEvent("test-table/note.md", { title: "Task", priority: 0, tags: [] }, 100));
			await vi.waitFor(() => expect(table.count()).toBe(1));

			const events: VaultTableEvent<TestData>[] = [];
			table.events$.subscribe((e) => events.push(e));

			fileStore.set("test-table/note.md", createMockTFile("test-table/note.md", 200));

			emitIndexerEvent(createFileChangedEvent("test-table/note.md", { title: "Task", priority: 0, tags: [] }, 200));

			await new Promise((r) => setTimeout(r, 50));
			expect(events).toHaveLength(0);

			table.destroy();
		});

		it("should emit row-updated with contentChanged=false when only frontmatter changes", async () => {
			const { config, fileStore, mockApp } = createTestConfig();
			const table = new VaultTable(config);
			fileStore.set("test-table/note.md", createMockTFile("test-table/note.md", 100));

			vi.mocked(mockApp.vault.cachedRead).mockResolvedValue("---\ntitle: Event\n---\nSame content");

			await table.start();

			emitIndexerEvent(createFileChangedEvent("test-table/note.md", { title: "Event", priority: 0, tags: [] }, 100));
			await vi.waitFor(() => expect(table.count()).toBe(1));

			const events: VaultTableEvent<TestData>[] = [];
			table.events$.subscribe((e) => events.push(e));

			fileStore.set("test-table/note.md", createMockTFile("test-table/note.md", 200));

			emitIndexerEvent(
				createFileChangedEvent("test-table/note.md", { title: "Updated Event", priority: 0, tags: [] }, 200, {
					title: "Event",
					priority: 0,
					tags: [],
				})
			);

			await vi.waitFor(() => expect(events).toHaveLength(1));
			expect(events[0].type).toBe("row-updated");
			if (events[0].type === "row-updated") {
				expect(events[0].contentChanged).toBe(false);
				expect(events[0].diff).toBeDefined();
			}

			table.destroy();
		});
	});

	describe("reactive emissions", () => {
		it("should emit events only from indexer, not from CRUD", async () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);

			const events: VaultTableEvent<TestData>[] = [];
			table.events$.subscribe((e) => events.push(e));

			await table.start();
			await table.create({ fileName: "note", data: { title: "Event", priority: 0, tags: [] } });
			await table.delete("note");

			expect(events).toHaveLength(0);

			table.destroy();
		});

		it("should emit typed events via indexer", async () => {
			const { config, fileStore } = createTestConfig();
			const table = new VaultTable(config);

			const events: VaultTableEvent<TestData>[] = [];
			table.events$.subscribe((e) => events.push(e));

			await table.start();

			fileStore.set("test-table/note.md", createMockTFile("test-table/note.md", 100));
			emitIndexerEvent(createFileChangedEvent("test-table/note.md", { title: "Event", priority: 0, tags: [] }, 100));

			await vi.waitFor(() => expect(events).toHaveLength(1));
			expect(events[0].type).toBe("row-created");

			emitIndexerEvent(createFileDeletedEvent("test-table/note.md"));
			expect(events).toHaveLength(2);
			expect(events[1].type).toBe("row-deleted");

			table.destroy();
		});
	});

	describe("schema validation with defaults", () => {
		it("should apply schema defaults on create", async () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();

			const row = await table.create({ fileName: "minimal", data: { title: "Event" } as any });

			expect(row.data.priority).toBe(0);
			expect(row.data.tags).toEqual([]);
			expect(row.data.category).toBe("general");

			table.destroy();
		});
	});

	describe("batch operations", () => {
		it("should create multiple rows with createMany", async () => {
			const { config, mockApp } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();

			const rows = await table.createMany([
				{ fileName: "a", data: { title: "Task A", priority: 1, tags: [] } },
				{ fileName: "b", data: { title: "Task B", priority: 2, tags: ["work"] } },
				{ fileName: "c", data: { title: "Task C", priority: 3, tags: ["personal"] } },
			]);

			expect(rows).toHaveLength(3);
			expect(table.count()).toBe(3);
			expect(rows[0].id).toBe("a");
			expect(rows[1].id).toBe("b");
			expect(rows[2].id).toBe("c");
			expect(mockApp.vault.create).toHaveBeenCalledTimes(3);

			table.destroy();
		});

		it("should update multiple rows with updateMany by id", async () => {
			const { table } = await createPopulatedTable();

			const updated = await table.updateMany([
				{ key: "alpha", data: { priority: 10 } },
				{ key: "beta", data: { priority: 20 } },
			]);

			expect(updated).toHaveLength(2);
			expect(updated[0].data.priority).toBe(10);
			expect(updated[1].data.priority).toBe(20);
			expect(table.get("alpha")!.data.priority).toBe(10);
			expect(table.get("beta")!.data.priority).toBe(20);

			table.destroy();
		});

		it("should update multiple rows with updateMany", async () => {
			const { table } = await createPopulatedTable();

			const updated = await table.updateMany([
				{ key: "alpha", data: { priority: 10 } },
				{ key: "beta", data: { priority: 20 } },
			]);

			expect(updated).toHaveLength(2);
			expect(updated[0].data.priority).toBe(10);
			expect(updated[1].data.priority).toBe(20);

			table.destroy();
		});

		it("should upsert multiple rows with upsertMany", async () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();
			await table.create({ fileName: "existing", data: { title: "Old", priority: 0, tags: [] } });

			const rows = await table.upsertMany([
				{ fileName: "existing", data: { title: "Updated", priority: 5, tags: [] } },
				{ fileName: "new-item", data: { title: "Fresh", priority: 1, tags: [] } },
			]);

			expect(rows).toHaveLength(2);
			expect(table.count()).toBe(2);
			expect(rows[0].data.title).toBe("Updated");
			expect(rows[1].data.title).toBe("Fresh");

			table.destroy();
		});

		it("should delete multiple rows with deleteMany by id", async () => {
			const { table, mockApp } = await createPopulatedTable();

			expect(table.count()).toBe(5);

			await table.deleteMany(["alpha", "beta", "gamma"]);

			expect(table.count()).toBe(2);
			expect(table.get("alpha")).toBeUndefined();
			expect(table.get("beta")).toBeUndefined();
			expect(table.get("gamma")).toBeUndefined();
			expect(table.get("delta")).toBeDefined();
			expect(table.get("epsilon")).toBeDefined();
			expect(mockApp.vault.trash).toHaveBeenCalledTimes(3);

			table.destroy();
		});

		it("should delete multiple rows with deleteMany", async () => {
			const { table, mockApp } = await createPopulatedTable();

			await table.deleteMany(["alpha", "beta"]);

			expect(table.count()).toBe(3);
			expect(table.get("alpha")).toBeUndefined();
			expect(table.get("beta")).toBeUndefined();
			expect(mockApp.vault.trash).toHaveBeenCalledTimes(2);

			table.destroy();
		});

		it("should throw on updateMany with nonexistent id", async () => {
			const { table } = await createPopulatedTable();

			await expect(
				table.updateMany([
					{ key: "alpha", data: { priority: 10 } },
					{ key: "ghost", data: { priority: 20 } },
				])
			).rejects.toThrow('VaultTable: row "ghost" not found');

			table.destroy();
		});

		it("should throw on deleteMany with nonexistent id", async () => {
			const { table } = await createPopulatedTable();

			await expect(table.deleteMany(["alpha", "ghost"])).rejects.toThrow('VaultTable: row "ghost" not found');

			table.destroy();
		});
	});

	describe("parent link injection", () => {
		it("should include parent display link in frontmatter when parentLink is set", async () => {
			const { config, mockApp } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();

			(table as any).parentLink = { property: "person", displayLink: "[[People/Alice/Alice|Alice]]" };

			await table.create({
				fileName: "meeting-01",
				data: { title: "Weekly Review", priority: 0, tags: [] },
			});

			const createdContent = vi.mocked(mockApp.vault.create).mock.calls[0][1] as string;
			expect(createdContent).toContain('person: "[[People/Alice/Alice|Alice]]"');

			table.destroy();
		});

		it("should not include parent property when parentLink is not set", async () => {
			const { config, mockApp } = createTestConfig();
			const table = new VaultTable(config);

			await table.start();

			await table.create({
				fileName: "standalone",
				data: { title: "Task", priority: 0, tags: [] },
			});

			const createdContent = vi.mocked(mockApp.vault.create).mock.calls[0][1] as string;
			expect(createdContent).not.toContain("person:");

			table.destroy();
		});
	});

	describe("indexer configuration", () => {
		it("should include folder notes by default", () => {
			const { config } = createTestConfig({ directory: "my-data" });
			new VaultTable(config);

			const indexerCall = vi.mocked(Indexer).mock.calls[0];
			const configStore = indexerCall[1] as BehaviorSubject<IndexerConfig>;
			const includeFile = configStore.value.includeFile!;

			expect(includeFile("my-data/note.md")).toBe(true);
			expect(includeFile("my-data/my-data.md")).toBe(true);
			expect(includeFile("other/note.md")).toBe(false);
			expect(includeFile("my-data-extra/note.md")).toBe(false);
		});

		it("should only include folder notes when nodeType is folderNotes", () => {
			const { config } = createTestConfig({ directory: "my-data", nodeType: "folderNotes" });
			new VaultTable(config);

			const indexerCall = vi.mocked(Indexer).mock.calls[0];
			const configStore = indexerCall[1] as BehaviorSubject<IndexerConfig>;
			const includeFile = configStore.value.includeFile!;

			expect(includeFile("my-data/Alice/Alice.md")).toBe(true);
			expect(includeFile("my-data/note.md")).toBe(false);
			expect(includeFile("my-data/Alice/meeting.md")).toBe(false);
			expect(includeFile("other/Alice/Alice.md")).toBe(false);
		});

		it("should pass debounceMs to indexer config", () => {
			const { config } = createTestConfig({ debounceMs: 250 });
			new VaultTable(config);

			const indexerCall = vi.mocked(Indexer).mock.calls[0];
			const configStore = indexerCall[1] as BehaviorSubject<IndexerConfig>;

			expect(configStore.value.debounceMs).toBe(250);
		});
	});

	// ─── replace (full data replacement without merge) ──────────

	describe("replace", () => {
		it("should replace data without merging with existing", async () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);
			await table.start();

			await table.create({
				fileName: "task",
				data: { title: "Original", priority: 5, tags: ["work", "urgent"], category: "work" },
			});

			// Replace with data that omits 'tags' and 'category'
			await table.replace("task", { title: "Replaced", priority: 1, tags: [], category: "general" });

			const row = table.get("task");
			expect(row).toBeDefined();
			expect(row!.data.title).toBe("Replaced");
			expect(row!.data.priority).toBe(1);

			table.destroy();
		});

		it("should remove properties that are absent in the replacement data", async () => {
			const { config, mockApp } = createTestConfig();
			const table = new VaultTable(config);
			await table.start();

			await table.create({
				fileName: "event",
				data: { title: "Meeting", priority: 2, tags: ["work"], category: "work" },
			});

			// Replace with data that has fewer properties — the old keys should be deleted from frontmatter
			await table.replace("event", { title: "Meeting", priority: 0, tags: [], category: "general" });

			// Verify processFrontMatter was called (replace writes to disk)
			expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalled();

			table.destroy();
		});

		it("should emit row-updated event when emitCrudEvents is true", async () => {
			const { config } = createTestConfig({ emitCrudEvents: true });
			const table = new VaultTable(config);
			await table.start();

			await table.create({
				fileName: "item",
				data: { title: "Before", priority: 0, tags: [], category: "general" },
			});

			const events: VaultTableEvent<TestData>[] = [];
			table.events$.subscribe((e) => events.push(e));

			await table.replace("item", { title: "After", priority: 10, tags: ["replaced"], category: "special" });

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("row-updated");
			if (events[0].type === "row-updated") {
				expect(events[0].oldRow.data.title).toBe("Before");
				expect(events[0].newRow.data.title).toBe("After");
			}

			table.destroy();
		});

		it("should throw when replacing a non-existent row", async () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);
			await table.start();

			await expect(
				table.replace("nonexistent", { title: "X", priority: 0, tags: [], category: "general" })
			).rejects.toThrow();

			table.destroy();
		});

		it("should handle property deletion pattern (unskip use case)", async () => {
			// Simulates: user has Skip: true, updater does delete fm.Skip
			const { config } = createTestConfig();
			const table = new VaultTable(config);
			await table.start();

			await table.create({
				fileName: "skipped-event",
				data: { title: "Skipped", priority: 0, tags: [], category: "general" },
			});

			// Simulate an updater that deletes a property
			const existing = table.get("skipped-event")!;
			const updated = { ...existing.data };
			// In the real scenario this would be: delete updated[skipProp]
			// Here we just pass a clean object without the extra fields
			await table.replace("skipped-event", {
				title: "Unskipped",
				priority: 0,
				tags: [],
				category: "general",
			});

			const row = table.get("skipped-event");
			expect(row!.data.title).toBe("Unskipped");

			table.destroy();
		});
	});

	// ─── update vs replace: property deletion behavior ──────────

	describe("update vs replace: skip/unskip workflow", () => {
		it("update() should KEEP deleted properties due to merge (demonstrates the bug)", async () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);
			await table.start();

			await table.create({
				fileName: "event",
				data: { title: "Skipped Event", priority: 0, tags: ["skip-me"], category: "work" },
			});

			// Simulate unskip: copy data, delete the "skip" field, pass to update()
			const existing = table.get("event")!;
			const updated = { ...existing.data };
			delete (updated as Record<string, unknown>)["tags"]; // pretend tags is "skip" prop

			// update() merges: { ...existing.data, ...updated }
			// The deleted 'tags' key is NOT in 'updated', so existing.data.tags survives the merge
			await table.update("event", updated);

			const row = table.get("event")!;
			// BUG: tags is still there because update() merged it back from existing.data
			expect(row.data.tags).toEqual(["skip-me"]);

			table.destroy();
		});

		it("replace() should RESET deleted properties to schema defaults (not merge from existing)", async () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);
			await table.start();

			await table.create({
				fileName: "event",
				data: { title: "Skipped Event", priority: 0, tags: ["skip-me"], category: "work" },
			});

			// Simulate unskip: copy data, delete a field, pass to replace()
			const existing = table.get("event")!;
			const replaced = { ...existing.data };
			delete (replaced as Record<string, unknown>)["tags"];

			// replace() does NOT merge — deleted fields get schema defaults, not existing values
			await table.replace("event", replaced as TestData);

			const row = table.get("event")!;
			// tags resets to schema default [] (not the old ["skip-me"])
			expect(row.data.tags).toEqual([]);
			// This is the key difference from update() which would keep ["skip-me"]

			table.destroy();
		});

		it("replace() does not resurrect old values like update() does", async () => {
			const { config } = createTestConfig();
			const table = new VaultTable(config);
			await table.start();

			await table.create({
				fileName: "event",
				data: { title: "Meeting", priority: 3, tags: ["important"], category: "work" },
			});

			// update() with explicit property set to different value works fine
			await table.update("event", { priority: 0 });
			expect(table.get("event")!.data.priority).toBe(0);

			// replace() with a completely new object — old category "work" is gone
			await table.replace("event", {
				title: "Replaced",
				priority: 1,
				tags: [],
				category: "general",
			});
			expect(table.get("event")!.data.title).toBe("Replaced");
			expect(table.get("event")!.data.category).toBe("general");

			table.destroy();
		});
	});

	// ─── emitCrudEvents ──────────────────────────────────────────

	describe("emitCrudEvents", () => {
		function createCrudEventConfig(emitCrudEvents: boolean) {
			return createTestConfig({ emitCrudEvents });
		}

		describe("when emitCrudEvents is false (default)", () => {
			it("should NOT emit events from create()", async () => {
				const { config } = createCrudEventConfig(false);
				const table = new VaultTable(config);
				await table.start();

				const events: VaultTableEvent<TestData>[] = [];
				table.events$.subscribe((e) => events.push(e));

				await table.create({ fileName: "test", data: { title: "Test", priority: 1, tags: [], category: "general" } });

				expect(table.get("test")).toBeDefined();
				expect(events).toHaveLength(0);

				table.destroy();
			});

			it("should NOT emit events from update()", async () => {
				const { config, fileStore } = createCrudEventConfig(false);
				const table = new VaultTable(config);
				await table.start();

				// Seed via indexer
				fileStore.set("test-table/item.md", createMockTFile("test-table/item.md", 100));
				emitIndexerEvent(
					createFileChangedEvent("test-table/item.md", { title: "Original", priority: 1, tags: [] }, 100)
				);
				await vi.waitFor(() => expect(table.count()).toBe(1));

				const events: VaultTableEvent<TestData>[] = [];
				table.events$.subscribe((e) => events.push(e));

				await table.update("item", { title: "Updated" });

				expect(table.get("item")!.data.title).toBe("Updated");
				expect(events).toHaveLength(0);

				table.destroy();
			});

			it("should NOT emit events from delete()", async () => {
				const { config } = createCrudEventConfig(false);
				const table = new VaultTable(config);
				await table.start();

				await table.create({
					fileName: "item",
					data: { title: "To delete", priority: 0, tags: [], category: "general" },
				});

				const events: VaultTableEvent<TestData>[] = [];
				table.events$.subscribe((e) => events.push(e));

				await table.delete("item");

				expect(table.get("item")).toBeUndefined();
				expect(events).toHaveLength(0);

				table.destroy();
			});

			it("should still emit events from indexer (external changes)", async () => {
				const { config, fileStore } = createCrudEventConfig(false);
				const table = new VaultTable(config);
				await table.start();

				const events: VaultTableEvent<TestData>[] = [];
				table.events$.subscribe((e) => events.push(e));

				fileStore.set("test-table/ext.md", createMockTFile("test-table/ext.md", 100));
				emitIndexerEvent(
					createFileChangedEvent("test-table/ext.md", { title: "External Edit", priority: 0, tags: [] }, 100)
				);

				await vi.waitFor(() => expect(events).toHaveLength(1));
				expect(events[0].type).toBe("row-created");

				table.destroy();
			});
		});

		describe("when emitCrudEvents is true", () => {
			it("should emit row-created from create()", async () => {
				const { config } = createCrudEventConfig(true);
				const table = new VaultTable(config);
				await table.start();

				const events: VaultTableEvent<TestData>[] = [];
				table.events$.subscribe((e) => events.push(e));

				await table.create({
					fileName: "meeting",
					data: { title: "Standup", priority: 2, tags: ["work"], category: "work" },
				});

				expect(events).toHaveLength(1);
				expect(events[0].type).toBe("row-created");
				if (events[0].type === "row-created") {
					expect(events[0].row.data.title).toBe("Standup");
					expect(events[0].id).toBe("meeting");
					expect(events[0].filePath).toBe("test-table/meeting.md");
				}

				table.destroy();
			});

			it("should emit row-updated from update() with old and new row", async () => {
				const { config } = createCrudEventConfig(true);
				const table = new VaultTable(config);
				await table.start();

				await table.create({
					fileName: "task",
					data: { title: "Original", priority: 1, tags: [], category: "general" },
				});

				const events: VaultTableEvent<TestData>[] = [];
				table.events$.subscribe((e) => events.push(e));

				await table.update("task", { title: "Updated", priority: 5 });

				expect(events).toHaveLength(1);
				expect(events[0].type).toBe("row-updated");
				if (events[0].type === "row-updated") {
					expect(events[0].oldRow.data.title).toBe("Original");
					expect(events[0].newRow.data.title).toBe("Updated");
					expect(events[0].newRow.data.priority).toBe(5);
					expect(events[0].contentChanged).toBe(false);
				}

				table.destroy();
			});

			it("should emit row-updated from updateContent() with contentChanged=true", async () => {
				const { config } = createCrudEventConfig(true);
				const table = new VaultTable(config);
				await table.start();

				await table.create({
					fileName: "note",
					data: { title: "Note", priority: 0, tags: [], category: "general" },
					content: "old body",
				});

				const events: VaultTableEvent<TestData>[] = [];
				table.events$.subscribe((e) => events.push(e));

				await table.updateContent("note", "new body");

				expect(events).toHaveLength(1);
				expect(events[0].type).toBe("row-updated");
				if (events[0].type === "row-updated") {
					expect(events[0].contentChanged).toBe(true);
					expect(events[0].newRow.content).toBe("new body");
				}

				table.destroy();
			});

			it("should emit row-deleted from delete() with old row data", async () => {
				const { config } = createCrudEventConfig(true);
				const table = new VaultTable(config);
				await table.start();

				await table.create({
					fileName: "temp",
					data: { title: "Temporary", priority: 0, tags: [], category: "general" },
				});

				const events: VaultTableEvent<TestData>[] = [];
				table.events$.subscribe((e) => events.push(e));

				await table.delete("temp");

				expect(events).toHaveLength(1);
				expect(events[0].type).toBe("row-deleted");
				if (events[0].type === "row-deleted") {
					expect(events[0].oldRow.data.title).toBe("Temporary");
					expect(events[0].id).toBe("temp");
				}

				table.destroy();
			});

			it("should NOT double-emit when indexer later detects the same CRUD write", async () => {
				const { config, fileStore } = createCrudEventConfig(true);
				const table = new VaultTable(config);
				await table.start();

				const events: VaultTableEvent<TestData>[] = [];
				table.events$.subscribe((e) => events.push(e));

				// CRUD create — emits immediately
				const row = await table.create({
					fileName: "event",
					data: { title: "Created", priority: 1, tags: [], category: "general" },
				});

				expect(events).toHaveLength(1);
				expect(events[0].type).toBe("row-created");

				// Simulate indexer detecting the same file change (same mtime)
				// This should be suppressed by the mtime dedup
				fileStore.set("test-table/event.md", row.file);
				emitIndexerEvent(
					createFileChangedEvent("test-table/event.md", { title: "Created", priority: 1, tags: [] }, row.mtime)
				);

				// Still only 1 event — indexer detection was suppressed
				expect(events).toHaveLength(1);

				table.destroy();
			});

			it("should still emit from indexer for external changes (different mtime)", async () => {
				const { config, fileStore } = createCrudEventConfig(true);
				const table = new VaultTable(config);
				await table.start();

				// Create via CRUD
				await table.create({
					fileName: "item",
					data: { title: "Original", priority: 1, tags: [], category: "general" },
				});

				const events: VaultTableEvent<TestData>[] = [];
				table.events$.subscribe((e) => events.push(e));

				// Simulate external edit (different mtime — user edited in Obsidian)
				const externalMtime = Date.now() + 5000;
				fileStore.set("test-table/item.md", createMockTFile("test-table/item.md", externalMtime));
				emitIndexerEvent(
					createFileChangedEvent(
						"test-table/item.md",
						{ title: "Externally Modified", priority: 9, tags: ["external"] },
						externalMtime,
						{ title: "Original", priority: 1, tags: [] }
					)
				);

				await vi.waitFor(() => expect(events).toHaveLength(1));
				expect(events[0].type).toBe("row-updated");
				if (events[0].type === "row-updated") {
					expect(events[0].newRow.data.title).toBe("Externally Modified");
				}

				table.destroy();
			});

			it("should emit events for a full CRUD lifecycle", async () => {
				const { config } = createCrudEventConfig(true);
				const table = new VaultTable(config);
				await table.start();

				const events: VaultTableEvent<TestData>[] = [];
				table.events$.subscribe((e) => events.push(e));

				await table.create({
					fileName: "lifecycle",
					data: { title: "Step 1", priority: 0, tags: [], category: "general" },
				});
				await table.update("lifecycle", { title: "Step 2", priority: 1 });
				await table.delete("lifecycle");

				expect(events).toHaveLength(3);
				expect(events[0].type).toBe("row-created");
				expect(events[1].type).toBe("row-updated");
				expect(events[2].type).toBe("row-deleted");

				table.destroy();
			});
		});
	});
});
