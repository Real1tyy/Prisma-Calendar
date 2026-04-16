import type { App } from "obsidian";
import { TFile } from "obsidian";
import { BehaviorSubject, Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { Indexer, type IndexerConfig, type IndexerEvent } from "../../src/core/indexer";
import { withSerialize } from "../../src/core/vault-table/create-mapped-schema";
import { VaultTable } from "../../src/core/vault-table/vault-table";
import { createMockApp } from "../../src/testing/mocks/obsidian";

vi.mock("../../src/core/indexer");

const TestSchema = withSerialize(
	z.object({
		title: z.string(),
		priority: z.number().default(0),
		tags: z.array(z.string()).default([]),
	})
);

type TestData = z.infer<typeof TestSchema>;

function createMockTFile(path: string, mtime = Date.now()): TFile {
	const file = new TFile(path);
	file.stat = { mtime, ctime: mtime, size: 0 };
	return file;
}

function createTestConfig(overrides?: Record<string, unknown>) {
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
			trash: vi.fn().mockImplementation((file: TFile) => {
				fileStore.delete(file.path);
				return Promise.resolve();
			}),
			modify: vi.fn().mockResolvedValue(undefined),
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

async function createTableWithHistory(historyConfig?: Record<string, unknown>) {
	const { config, mockApp, fileStore } = createTestConfig({ history: historyConfig ?? {} });
	const table = new VaultTable(config);
	await table.start();
	return { table, mockApp, fileStore };
}

async function createTableWithoutHistory() {
	const { config, mockApp, fileStore } = createTestConfig();
	const table = new VaultTable(config);
	await table.start();
	return { table, mockApp, fileStore };
}

describe("VaultTable history", () => {
	describe("configuration", () => {
		it("should enable history when config is provided", async () => {
			const { table } = await createTableWithHistory();

			await table.create({ fileName: "task", data: { title: "Event", priority: 1, tags: [] } });
			expect(table.canUndo()).toBe(true);

			table.destroy();
		});

		it("should not enable history when config is omitted", async () => {
			const { table } = await createTableWithoutHistory();

			await table.create({ fileName: "task", data: { title: "Event", priority: 1, tags: [] } });
			expect(table.canUndo()).toBe(false);

			table.destroy();
		});

		it("should accept custom history config", async () => {
			const { config } = createTestConfig({ history: { maxSize: 5 } });
			const table = new VaultTable(config);
			await table.start();

			for (let i = 0; i < 10; i++) {
				await table.create({ fileName: `task-${i}`, data: { title: `Task ${i}`, priority: i, tags: [] } });
			}

			let undoCount = 0;
			while (table.canUndo()) {
				await table.undo();
				undoCount++;
			}
			expect(undoCount).toBe(5);

			table.destroy();
		});
	});

	describe("undo/redo create", () => {
		it("should undo a create by deleting the row", async () => {
			const { table, mockApp } = await createTableWithHistory();

			await table.create({ fileName: "task", data: { title: "Event", priority: 1, tags: [] } });
			expect(table.count()).toBe(1);
			expect(table.canUndo()).toBe(true);
			expect(table.peekUndo()).toBe("vault-table:create");

			await table.undo();

			expect(table.count()).toBe(0);
			expect(table.get("task")).toBeUndefined();
			expect(mockApp.vault.trash).toHaveBeenCalled();
			expect(table.canUndo()).toBe(false);
			expect(table.canRedo()).toBe(true);

			table.destroy();
		});

		it("should redo a create by recreating the row", async () => {
			const { table } = await createTableWithHistory();

			await table.create({ fileName: "task", data: { title: "Event", priority: 1, tags: [] } });
			await table.undo();
			expect(table.count()).toBe(0);

			await table.redo();

			expect(table.count()).toBe(1);
			expect(table.get("task")).toBeDefined();
			expect(table.get("task")!.data.title).toBe("Event");
			expect(table.canRedo()).toBe(false);

			table.destroy();
		});
	});

	describe("undo/redo update", () => {
		it("should undo an update by restoring old data", async () => {
			const { table } = await createTableWithHistory();

			await table.create({ fileName: "task", data: { title: "Event", priority: 1, tags: [] } });
			await table.update("task", { priority: 5, title: "Updated Event" });

			expect(table.get("task")!.data.priority).toBe(5);
			expect(table.get("task")!.data.title).toBe("Updated Event");
			expect(table.peekUndo()).toBe("vault-table:update");

			await table.undo();

			expect(table.get("task")!.data.priority).toBe(1);
			expect(table.get("task")!.data.title).toBe("Event");

			table.destroy();
		});

		it("should redo an update by reapplying new data", async () => {
			const { table } = await createTableWithHistory();

			await table.create({ fileName: "task", data: { title: "Event", priority: 1, tags: [] } });
			await table.update("task", { priority: 5 });
			await table.undo();

			expect(table.get("task")!.data.priority).toBe(1);

			await table.redo();

			expect(table.get("task")!.data.priority).toBe(5);

			table.destroy();
		});
	});

	describe("undo/redo updateContent", () => {
		it("should undo a content update by restoring old content", async () => {
			const { table } = await createTableWithHistory();

			await table.create({ fileName: "task", data: { title: "Event", priority: 1, tags: [] }, content: "original" });
			await table.updateContent("task", "modified");

			expect(table.get("task")!.content).toBe("modified");
			expect(table.peekUndo()).toBe("vault-table:update-content");

			await table.undo();

			expect(table.get("task")!.content).toBe("original");

			table.destroy();
		});

		it("should redo a content update by reapplying new content", async () => {
			const { table } = await createTableWithHistory();

			await table.create({ fileName: "task", data: { title: "Event", priority: 1, tags: [] }, content: "original" });
			await table.updateContent("task", "modified");
			await table.undo();
			await table.redo();

			expect(table.get("task")!.content).toBe("modified");

			table.destroy();
		});
	});

	describe("undo/redo delete", () => {
		it("should undo a delete by recreating the row", async () => {
			const { table } = await createTableWithHistory();

			await table.create({ fileName: "task", data: { title: "Event", priority: 3, tags: ["work"] } });
			await table.delete("task");

			expect(table.count()).toBe(0);
			expect(table.peekUndo()).toBe("vault-table:delete");

			await table.undo();

			expect(table.count()).toBe(1);
			const restored = table.get("task");
			expect(restored).toBeDefined();
			expect(restored!.data.title).toBe("Event");
			expect(restored!.data.priority).toBe(3);
			expect(restored!.data.tags).toEqual(["work"]);

			table.destroy();
		});

		it("should redo a delete by deleting the row again", async () => {
			const { table } = await createTableWithHistory();

			await table.create({ fileName: "task", data: { title: "Event", priority: 1, tags: [] } });
			await table.delete("task");
			await table.undo();
			expect(table.count()).toBe(1);

			await table.redo();

			expect(table.count()).toBe(0);

			table.destroy();
		});
	});

	describe("complex sequences", () => {
		it("should handle multiple undo/redo operations", async () => {
			const { table } = await createTableWithHistory();

			await table.create({ fileName: "a", data: { title: "Task A", priority: 1, tags: [] } });
			await table.create({ fileName: "b", data: { title: "Task B", priority: 2, tags: [] } });
			await table.update("a", { priority: 10 });

			expect(table.count()).toBe(2);
			expect(table.get("a")!.data.priority).toBe(10);

			await table.undo();
			expect(table.get("a")!.data.priority).toBe(1);

			await table.undo();
			expect(table.count()).toBe(1);
			expect(table.get("b")).toBeUndefined();

			await table.undo();
			expect(table.count()).toBe(0);

			await table.redo();
			expect(table.count()).toBe(1);
			expect(table.get("a")).toBeDefined();

			await table.redo();
			expect(table.count()).toBe(2);

			await table.redo();
			expect(table.get("a")!.data.priority).toBe(10);

			table.destroy();
		});

		it("should clear redo stack on new operation after undo", async () => {
			const { table } = await createTableWithHistory();

			await table.create({ fileName: "a", data: { title: "Task A", priority: 1, tags: [] } });
			await table.create({ fileName: "b", data: { title: "Task B", priority: 2, tags: [] } });

			await table.undo();
			expect(table.canRedo()).toBe(true);

			await table.create({ fileName: "c", data: { title: "Task C", priority: 3, tags: [] } });
			expect(table.canRedo()).toBe(false);

			table.destroy();
		});
	});

	describe("no-op when history disabled", () => {
		it("should return false from undo/redo when disabled", async () => {
			const { table } = await createTableWithoutHistory();

			await table.create({ fileName: "task", data: { title: "Event", priority: 1, tags: [] } });

			expect(await table.undo()).toBe(false);
			expect(await table.redo()).toBe(false);
			expect(table.canUndo()).toBe(false);
			expect(table.canRedo()).toBe(false);
			expect(table.peekUndo()).toBeNull();
			expect(table.peekRedo()).toBeNull();

			table.destroy();
		});

		it("should not throw when clearing history on disabled table", async () => {
			const { table } = await createTableWithoutHistory();
			expect(() => table.clearHistory()).not.toThrow();
			table.destroy();
		});
	});

	describe("clearHistory", () => {
		it("should clear both undo and redo stacks", async () => {
			const { table } = await createTableWithHistory();

			await table.create({ fileName: "a", data: { title: "Task A", priority: 1, tags: [] } });
			await table.create({ fileName: "b", data: { title: "Task B", priority: 2, tags: [] } });
			await table.undo();

			expect(table.canUndo()).toBe(true);
			expect(table.canRedo()).toBe(true);

			table.clearHistory();

			expect(table.canUndo()).toBe(false);
			expect(table.canRedo()).toBe(false);

			table.destroy();
		});
	});

	describe("destroy clears history", () => {
		it("should clear history on destroy", async () => {
			const { table } = await createTableWithHistory();

			await table.create({ fileName: "task", data: { title: "Event", priority: 1, tags: [] } });
			expect(table.canUndo()).toBe(true);

			table.destroy();

			expect(table.canUndo()).toBe(false);
		});
	});

	describe("upsert with history", () => {
		it("should track upsert-as-create in history", async () => {
			const { table } = await createTableWithHistory();

			await table.upsert({ fileName: "task", data: { title: "Event", priority: 1, tags: [] } });
			expect(table.count()).toBe(1);
			expect(table.peekUndo()).toBe("vault-table:create");

			await table.undo();
			expect(table.count()).toBe(0);

			table.destroy();
		});

		it("should track upsert-as-update in history", async () => {
			const { table } = await createTableWithHistory();

			await table.create({ fileName: "task", data: { title: "Event", priority: 1, tags: [] } });
			await table.upsert({ fileName: "task", data: { title: "Updated Event", priority: 5, tags: [] } });

			expect(table.peekUndo()).toBe("vault-table:update");

			await table.undo();
			expect(table.get("task")!.data.title).toBe("Event");

			table.destroy();
		});
	});

	describe("batch operations with history", () => {
		it("should track each create in createMany individually", async () => {
			const { table } = await createTableWithHistory();

			await table.createMany([
				{ fileName: "a", data: { title: "Task A", priority: 1, tags: [] } },
				{ fileName: "b", data: { title: "Task B", priority: 2, tags: [] } },
				{ fileName: "c", data: { title: "Task C", priority: 3, tags: [] } },
			]);

			expect(table.count()).toBe(3);

			await table.undo();
			expect(table.count()).toBe(2);

			await table.undo();
			expect(table.count()).toBe(1);

			await table.undo();
			expect(table.count()).toBe(0);

			table.destroy();
		});

		it("should track each delete in deleteMany individually", async () => {
			const { table } = await createTableWithHistory();

			await table.createMany([
				{ fileName: "a", data: { title: "Task A", priority: 1, tags: [] } },
				{ fileName: "b", data: { title: "Task B", priority: 2, tags: [] } },
			]);

			await table.deleteMany(["a", "b"]);
			expect(table.count()).toBe(0);

			await table.undo();
			expect(table.count()).toBe(1);

			await table.undo();
			expect(table.count()).toBe(2);

			table.destroy();
		});
	});
});
