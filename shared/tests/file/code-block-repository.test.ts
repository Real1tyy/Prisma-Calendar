import type { TFile } from "obsidian";
import { TFolder } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { CodeBlockRepository } from "../../src/core/data-access/code-block-repository";
import type { DataRow, VaultTableEvent } from "../../src/core/vault-table/types";
import { createMockApp, createMockFile } from "../../src/testing";

const TestItemSchema = z.object({
	id: z.string(),
	value: z.number(),
});

type TestItem = z.infer<typeof TestItemSchema>;

const CODE_FENCE = "test-block";

function createRepo(): CodeBlockRepository<TestItem> {
	return new CodeBlockRepository({ codeFence: CODE_FENCE, itemSchema: TestItemSchema });
}

function createCrudRepo(): CodeBlockRepository<TestItem> {
	return new CodeBlockRepository({
		codeFence: CODE_FENCE,
		itemSchema: TestItemSchema,
		idField: "id",
		sort: (a, b) => a.id.localeCompare(b.id),
	});
}

function allItems(repo: CodeBlockRepository<TestItem>): TestItem[] {
	return repo.toArray().map((r) => r.data);
}

describe("CodeBlockRepository", () => {
	describe("ensureBlock delegation", () => {
		it("should delegate to the internal CodeBlockFile", async () => {
			const mockApp = createMockApp({
				vault: {
					read: vi.fn().mockResolvedValue("Some content"),
					modify: vi.fn(),
				},
			});
			const repo = createRepo();
			const file = createMockFile("test.md");
			await repo.ensureBlock(mockApp as never, file as TFile);
			expect(mockApp.vault.modify).toHaveBeenCalledWith(file, "```test-block\n[]\n```\n\nSome content");
		});
	});

	// I/O tests (parse/serialize/extractRaw/read/ensureBlock/write/writeRaw) live in code-block-file.test.ts

	describe("CRUD operations", () => {
		const SEED_DATA = '[{"id":"b","value":2},{"id":"a","value":1}]';

		function mockAppWithContent(content: string): ReturnType<typeof createMockApp> {
			return createMockApp({
				vault: { read: vi.fn().mockResolvedValue(content), modify: vi.fn() },
				workspace: { getActiveViewOfType: vi.fn().mockReturnValue(null) },
			});
		}

		function loadedCrudRepo(): {
			repo: CodeBlockRepository<TestItem>;
			mockApp: ReturnType<typeof createMockApp>;
			file: ReturnType<typeof createMockFile>;
		} {
			const mockApp = mockAppWithContent(`\`\`\`test-block\n${SEED_DATA}\n\`\`\``);
			const file = createMockFile("test.md");
			const repo = createCrudRepo();
			repo.loadFromRaw(SEED_DATA, mockApp as never, file as TFile);
			return { repo, mockApp, file };
		}

		describe("load", () => {
			it("should populate index from file and sort", async () => {
				const mockApp = mockAppWithContent(`\`\`\`test-block\n${SEED_DATA}\n\`\`\``);
				const file = createMockFile("test.md");
				const repo = createCrudRepo();

				await repo.load(mockApp as never, file as TFile);

				expect(allItems(repo)).toEqual([
					{ id: "a", value: 1 },
					{ id: "b", value: 2 },
				]);
			});

			it("should clear previous state on re-load", async () => {
				const { repo } = loadedCrudRepo();
				await repo.create({ id: "c", value: 3 });

				const freshApp = mockAppWithContent('```test-block\n[{"id":"x","value":9}]\n```');
				const freshFile = createMockFile("other.md");
				await repo.load(freshApp as never, freshFile as TFile);

				expect(allItems(repo)).toEqual([{ id: "x", value: 9 }]);
				expect(repo.get("a")).toBeUndefined();
			});
		});

		describe("loadFromRaw", () => {
			it("should populate index from raw JSON string", () => {
				const repo = createCrudRepo();
				const mockApp = createMockApp({});
				const file = createMockFile("test.md");

				repo.loadFromRaw('[{"id":"c","value":3},{"id":"a","value":1}]', mockApp as never, file as TFile);

				expect(allItems(repo)).toEqual([
					{ id: "a", value: 1 },
					{ id: "c", value: 3 },
				]);
			});

			it("should handle empty array", () => {
				const repo = createCrudRepo();
				repo.loadFromRaw("[]", createMockApp({}) as never, createMockFile("t.md") as TFile);
				expect(allItems(repo)).toEqual([]);
			});

			it("should handle invalid JSON gracefully", () => {
				const repo = createCrudRepo();
				repo.loadFromRaw("not json", createMockApp({}) as never, createMockFile("t.md") as TFile);
				expect(allItems(repo)).toEqual([]);
			});

			it("should filter invalid items via schema", () => {
				const repo = createCrudRepo();
				repo.loadFromRaw(
					'[{"id":"ok","value":1},{"id":999,"value":"bad"}]',
					createMockApp({}) as never,
					createMockFile("t.md") as TFile
				);
				expect(allItems(repo)).toEqual([{ id: "ok", value: 1 }]);
			});
		});

		describe("get", () => {
			it("should return DataRow by ID", () => {
				const { repo } = loadedCrudRepo();
				expect(repo.get("a")).toEqual({ id: "a", data: { id: "a", value: 1 } });
			});

			it("should return undefined for non-existent ID", () => {
				const { repo } = loadedCrudRepo();
				expect(repo.get("missing")).toBeUndefined();
			});

			it("should return undefined before any load", () => {
				const repo = createCrudRepo();
				expect(repo.get("a")).toBeUndefined();
			});
		});

		describe("create", () => {
			it("should add item, maintain sort, and persist", async () => {
				const { repo, mockApp } = loadedCrudRepo();
				await repo.create({ id: "c", value: 3 });

				expect(allItems(repo).map((i) => i.id)).toEqual(["a", "b", "c"]);
				expect(mockApp.vault.modify).toHaveBeenCalledTimes(1);
			});

			it("should insert in correct sort position", async () => {
				const { repo } = loadedCrudRepo();
				await repo.create({ id: "aa", value: 5 });

				expect(allItems(repo).map((i) => i.id)).toEqual(["a", "aa", "b"]);
			});

			it("should throw on duplicate ID", async () => {
				const { repo } = loadedCrudRepo();
				await expect(repo.create({ id: "a", value: 99 })).rejects.toThrow('Item with ID "a" already exists');
			});

			it("should not modify index on duplicate error", async () => {
				const { repo } = loadedCrudRepo();
				try {
					await repo.create({ id: "a", value: 99 });
				} catch {
					// expected
				}
				expect(repo.get("a")?.data).toEqual({ id: "a", value: 1 });
			});

			it("should throw without bound file", async () => {
				const repo = createCrudRepo();
				await expect(repo.create({ id: "x", value: 1 })).rejects.toThrow("Cannot persist");
			});
		});

		describe("update", () => {
			it("should merge partial into existing item", async () => {
				const { repo } = loadedCrudRepo();
				await repo.update("a", { value: 99 });
				expect(repo.get("a")?.data).toEqual({ id: "a", value: 99 });
			});

			it("should handle ID field change (key migration)", async () => {
				const { repo } = loadedCrudRepo();
				await repo.update("a", { id: "z" });

				expect(repo.get("a")).toBeUndefined();
				expect(repo.get("z")?.data).toEqual({ id: "z", value: 1 });
			});

			it("should re-sort after ID change", async () => {
				const { repo } = loadedCrudRepo();
				await repo.update("a", { id: "z" });
				expect(allItems(repo).map((i) => i.id)).toEqual(["b", "z"]);
			});

			it("should persist after update", async () => {
				const { repo, mockApp } = loadedCrudRepo();
				await repo.update("a", { value: 50 });
				expect(mockApp.vault.modify).toHaveBeenCalledTimes(1);
			});

			it("should throw for non-existent ID", async () => {
				const { repo } = loadedCrudRepo();
				await expect(repo.update("missing", { value: 1 })).rejects.toThrow('Item with ID "missing" not found');
			});

			it("should not modify index on missing-ID error", async () => {
				const { repo } = loadedCrudRepo();
				try {
					await repo.update("missing", { value: 1 });
				} catch {
					// expected
				}
				expect(allItems(repo)).toHaveLength(2);
			});
		});

		describe("delete", () => {
			it("should remove item and persist", async () => {
				const { repo, mockApp } = loadedCrudRepo();
				await repo.delete("a");

				expect(repo.get("a")).toBeUndefined();
				expect(allItems(repo)).toEqual([{ id: "b", value: 2 }]);
				expect(mockApp.vault.modify).toHaveBeenCalledTimes(1);
			});

			it("should no-op and skip persist for missing ID", async () => {
				const { repo, mockApp } = loadedCrudRepo();
				await repo.delete("missing");

				expect(allItems(repo)).toHaveLength(2);
				expect(mockApp.vault.modify).not.toHaveBeenCalled();
			});

			it("should delete all items leaving empty state", async () => {
				const { repo } = loadedCrudRepo();
				await repo.delete("a");
				await repo.delete("b");

				expect(allItems(repo)).toEqual([]);
			});
		});

		describe("bulk operations", () => {
			it("createMany persists once and emits row-created per item", async () => {
				const { repo, mockApp } = loadedCrudRepo();
				const events: VaultTableEvent<TestItem, DataRow<TestItem>>[] = [];
				const sub = repo.events$.subscribe((e) => events.push(e));

				await repo.createMany([
					{ id: "c", value: 3 },
					{ id: "d", value: 4 },
				]);

				expect(mockApp.vault.modify).toHaveBeenCalledTimes(1);
				expect(
					allItems(repo)
						.map((i) => i.id)
						.sort()
				).toEqual(["a", "b", "c", "d"]);
				expect(events.filter((e) => e.type === "row-created").map((e) => e.id)).toEqual(["c", "d"]);
				sub.unsubscribe();
			});

			it("createMany rejects duplicate ids without persisting", async () => {
				const { repo, mockApp } = loadedCrudRepo();
				await expect(
					repo.createMany([
						{ id: "c", value: 3 },
						{ id: "a", value: 99 },
					])
				).rejects.toThrow(/already exists/);
				expect(mockApp.vault.modify).not.toHaveBeenCalled();
			});

			it("updateMany applies all changes with a single persist", async () => {
				const { repo, mockApp } = loadedCrudRepo();
				await repo.updateMany([
					["a", { value: 10 }],
					["b", { value: 20 }],
				]);

				expect(mockApp.vault.modify).toHaveBeenCalledTimes(1);
				expect(repo.get("a")?.data.value).toBe(10);
				expect(repo.get("b")?.data.value).toBe(20);
			});

			it("deleteMany removes every listed id in a single persist", async () => {
				const { repo, mockApp } = loadedCrudRepo();
				const events: VaultTableEvent<TestItem, DataRow<TestItem>>[] = [];
				const sub = repo.events$.subscribe((e) => events.push(e));

				await repo.deleteMany(["a", "b"]);

				expect(mockApp.vault.modify).toHaveBeenCalledTimes(1);
				expect(allItems(repo)).toEqual([]);
				expect(
					events
						.filter((e) => e.type === "row-deleted")
						.map((e) => e.id)
						.sort()
				).toEqual(["a", "b"]);
				sub.unsubscribe();
			});

			it("deleteMany silently skips unknown ids and still persists when at least one matches", async () => {
				const { repo, mockApp } = loadedCrudRepo();
				await repo.deleteMany(["a", "missing"]);

				expect(mockApp.vault.modify).toHaveBeenCalledTimes(1);
				expect(allItems(repo).map((i) => i.id)).toEqual(["b"]);
			});

			it("deleteMany no-ops when nothing matches", async () => {
				const { repo, mockApp } = loadedCrudRepo();
				await repo.deleteMany(["missing-1", "missing-2"]);
				expect(mockApp.vault.modify).not.toHaveBeenCalled();
			});

			it("empty batch calls are no-ops", async () => {
				const { repo, mockApp } = loadedCrudRepo();
				await repo.createMany([]);
				await repo.updateMany([]);
				await repo.deleteMany([]);
				expect(mockApp.vault.modify).not.toHaveBeenCalled();
			});
		});

		describe("sort determinism", () => {
			it("should maintain order through mixed mutations", async () => {
				const { repo } = loadedCrudRepo();

				await repo.create({ id: "d", value: 4 });
				await repo.create({ id: "c", value: 3 });
				await repo.delete("b");
				await repo.update("a", { value: 10 });

				expect(allItems(repo).map((i) => i.id)).toEqual(["a", "c", "d"]);
			});

			it("should sort correctly with reverse comparator", async () => {
				const repo = new CodeBlockRepository<TestItem>({
					codeFence: CODE_FENCE,
					itemSchema: TestItemSchema,
					idField: "id",
					sort: (a, b) => b.id.localeCompare(a.id),
				});
				const mockApp = mockAppWithContent(`\`\`\`test-block\n${SEED_DATA}\n\`\`\``);
				repo.loadFromRaw(SEED_DATA, mockApp as never, createMockFile("t.md") as TFile);

				expect(allItems(repo).map((i) => i.id)).toEqual(["b", "a"]);
			});
		});

		describe("error guards", () => {
			it("should throw on loadFromRaw with items when no idField configured", () => {
				const repo = createRepo();
				expect(() =>
					repo.loadFromRaw('[{"id":"a","value":1}]', createMockApp({}) as never, createMockFile("t.md") as TFile)
				).toThrow("idField");
			});

			it("should allow loadFromRaw with empty array when no idField configured", () => {
				const repo = createRepo();
				expect(() => repo.loadFromRaw("[]", createMockApp({}) as never, createMockFile("t.md") as TFile)).not.toThrow();
			});

			it("should throw on create without idField", async () => {
				const repo = createRepo();
				const mockApp = mockAppWithContent("```test-block\n[]\n```");
				repo.loadFromRaw("[]", mockApp as never, createMockFile("t.md") as TFile);
				await expect(repo.create({ id: "a", value: 1 })).rejects.toThrow("idField");
			});

			it("should throw on persist without bound file", async () => {
				const repo = createCrudRepo();
				await expect(repo.create({ id: "a", value: 1 })).rejects.toThrow("Cannot persist");
			});
		});
	});

	describe("bind", () => {
		const FILE_PATH = "notes/data.md";
		const FILE_CONTENT = '```test-block\n[{"id":"a","value":1},{"id":"b","value":2}]\n```';

		function createContentTrackingApp() {
			const fileContents = new Map<string, string>();
			const file = createMockFile(FILE_PATH);

			fileContents.set(FILE_PATH, FILE_CONTENT);

			const mockApp = createMockApp({
				vault: {
					getAbstractFileByPath: vi.fn().mockImplementation((p: string) => (p === FILE_PATH ? file : null)),
					on: vi.fn().mockReturnValue({ id: "mock-ref" }),
					offref: vi.fn(),
					read: vi.fn().mockImplementation(async (f: { path: string }) => fileContents.get(f.path) ?? ""),
					modify: vi.fn().mockImplementation(async (f: { path: string }, content: string) => {
						fileContents.set(f.path, content);
					}),
				},
				workspace: { getActiveViewOfType: vi.fn().mockReturnValue(null) },
			});

			return { mockApp, file, fileContents };
		}

		it("should load data from existing file on bind", async () => {
			const { mockApp } = createContentTrackingApp();
			const repo = createCrudRepo();

			await repo.bind(mockApp as never, FILE_PATH);

			expect(allItems(repo)).toEqual([
				{ id: "a", value: 1 },
				{ id: "b", value: 2 },
			]);
		});

		it("should call onChange after initial load", async () => {
			const { mockApp } = createContentTrackingApp();
			const repo = createCrudRepo();
			const onChange = vi.fn();

			await repo.bind(mockApp as never, FILE_PATH, { onChange });

			expect(onChange).toHaveBeenCalledTimes(1);
		});

		it("should not call onChange when file does not exist", async () => {
			const mockApp = createMockApp({
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
					on: vi.fn().mockReturnValue({ id: "mock-ref" }),
					offref: vi.fn(),
				},
			});
			const repo = createCrudRepo();
			const onChange = vi.fn();

			await repo.bind(mockApp as never, "nonexistent.md", { onChange });

			expect(onChange).not.toHaveBeenCalled();
			expect(allItems(repo)).toEqual([]);
		});

		it("should not load when path resolves to a folder", async () => {
			const folder = new TFolder("notes/folder");
			const mockApp = createMockApp({
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(folder),
					on: vi.fn().mockReturnValue({ id: "mock-ref" }),
					offref: vi.fn(),
				},
			});
			const repo = createCrudRepo();
			const onChange = vi.fn();

			await repo.bind(mockApp as never, "notes/folder", { onChange });

			expect(onChange).not.toHaveBeenCalled();
			expect(allItems(repo)).toEqual([]);
		});

		it("should reload data when vault fires modify for the bound file", async () => {
			const { mockApp, fileContents } = createContentTrackingApp();
			const repo = createCrudRepo();
			const onChange = vi.fn();

			await repo.bind(mockApp as never, FILE_PATH, { onChange });
			expect(onChange).toHaveBeenCalledTimes(1);

			fileContents.set(FILE_PATH, '```test-block\n[{"id":"c","value":3}]\n```');

			const modifyCallback = (mockApp.vault.on as ReturnType<typeof vi.fn>).mock.calls[0][1];
			modifyCallback({ path: FILE_PATH });
			await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));

			expect(allItems(repo)).toEqual([{ id: "c", value: 3 }]);
		});

		it("should unsubscribe vault listener via binding", async () => {
			const { mockApp } = createContentTrackingApp();
			const repo = createCrudRepo();

			const binding = await repo.bind(mockApp as never, FILE_PATH);
			binding.unsubscribe();

			expect(mockApp.vault.offref).toHaveBeenCalledWith({ id: "mock-ref" });
		});

		it("should skip reload when the modify event was triggered by our own write", async () => {
			const { mockApp, fileContents } = createContentTrackingApp();
			const repo = createCrudRepo();
			const loadSpy = vi.spyOn(repo, "load");

			await repo.bind(mockApp as never, FILE_PATH);
			expect(loadSpy).toHaveBeenCalledTimes(1);

			const modifyCallback = (mockApp.vault.on as ReturnType<typeof vi.fn>).mock.calls[0][1];
			(mockApp.vault.modify as ReturnType<typeof vi.fn>).mockImplementation(
				async (file: { path: string }, content: string) => {
					fileContents.set(file.path, content);
					modifyCallback({ path: file.path });
				}
			);

			await repo.create({ id: "c", value: 3 });
			expect(loadSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe("events$", () => {
		const SEED_DATA = '[{"id":"b","value":2},{"id":"a","value":1}]';

		function loadedReactiveRepo() {
			const mockApp = createMockApp({
				vault: {
					read: vi.fn().mockResolvedValue(`\`\`\`test-block\n${SEED_DATA}\n\`\`\``),
					modify: vi.fn(),
				},
				workspace: { getActiveViewOfType: vi.fn().mockReturnValue(null) },
			});
			const file = createMockFile("test.md");
			const repo = createCrudRepo();
			repo.loadFromRaw(SEED_DATA, mockApp as never, file as TFile);
			return { repo, mockApp, file };
		}

		function collectEvents<T>(repo: CodeBlockRepository<T>): VaultTableEvent<T, DataRow<T>>[] {
			const events: VaultTableEvent<T, DataRow<T>>[] = [];
			repo.events$.subscribe((e) => events.push(e));
			return events;
		}

		function row<T>(id: string, data: T): DataRow<T> {
			return { id, data };
		}

		describe("CRUD events", () => {
			it("should emit row-created on create", async () => {
				const { repo } = loadedReactiveRepo();
				const events = collectEvents(repo);

				await repo.create({ id: "c", value: 3 });

				expect(events).toHaveLength(1);
				expect(events[0]).toEqual({
					type: "row-created",
					id: "c",
					filePath: "",
					row: row("c", { id: "c", value: 3 }),
				});
			});

			it("should emit row-updated on update", async () => {
				const { repo } = loadedReactiveRepo();
				const events = collectEvents(repo);

				await repo.update("a", { value: 99 });

				expect(events).toHaveLength(1);
				expect(events[0]).toEqual({
					type: "row-updated",
					id: "a",
					filePath: "",
					oldRow: row("a", { id: "a", value: 1 }),
					newRow: row("a", { id: "a", value: 99 }),
					contentChanged: false,
				});
			});

			it("should emit row-deleted on delete", async () => {
				const { repo } = loadedReactiveRepo();
				const events = collectEvents(repo);

				await repo.delete("a");

				expect(events).toHaveLength(1);
				expect(events[0]).toEqual({
					type: "row-deleted",
					id: "a",
					filePath: "",
					oldRow: row("a", { id: "a", value: 1 }),
				});
			});

			it("should not emit on delete of non-existent item", async () => {
				const { repo } = loadedReactiveRepo();
				const events = collectEvents(repo);

				await repo.delete("missing");

				expect(events).toHaveLength(0);
			});
		});

		describe("reload diffing", () => {
			it("should emit row-created for new items on reload", () => {
				const repo = createCrudRepo();
				const mockApp = createMockApp({});
				const file = createMockFile("t.md");

				repo.loadFromRaw("[]", mockApp as never, file as TFile);
				const events = collectEvents(repo);

				repo.loadFromRaw('[{"id":"a","value":1}]', mockApp as never, file as TFile);

				expect(events).toHaveLength(1);
				expect(events[0]).toMatchObject({ type: "row-created", id: "a" });
			});

			it("should emit row-deleted for removed items on reload", () => {
				const repo = createCrudRepo();
				const mockApp = createMockApp({});
				const file = createMockFile("t.md");

				repo.loadFromRaw('[{"id":"a","value":1}]', mockApp as never, file as TFile);
				const events = collectEvents(repo);

				repo.loadFromRaw("[]", mockApp as never, file as TFile);

				expect(events).toHaveLength(1);
				expect(events[0]).toMatchObject({ type: "row-deleted", id: "a" });
			});

			it("should emit row-updated for changed items on reload", () => {
				const repo = createCrudRepo();
				const mockApp = createMockApp({});
				const file = createMockFile("t.md");

				repo.loadFromRaw('[{"id":"a","value":1}]', mockApp as never, file as TFile);
				const events = collectEvents(repo);

				repo.loadFromRaw('[{"id":"a","value":99}]', mockApp as never, file as TFile);

				expect(events).toHaveLength(1);
				expect(events[0]).toMatchObject({ type: "row-updated", id: "a" });
			});

			it("should not emit for unchanged items on reload", () => {
				const repo = createCrudRepo();
				const mockApp = createMockApp({});
				const file = createMockFile("t.md");

				repo.loadFromRaw('[{"id":"a","value":1}]', mockApp as never, file as TFile);
				const events = collectEvents(repo);

				repo.loadFromRaw('[{"id":"a","value":1}]', mockApp as never, file as TFile);

				expect(events).toHaveLength(0);
			});

			it("should emit mixed events for complex reload diff", () => {
				const repo = createCrudRepo();
				const mockApp = createMockApp({});
				const file = createMockFile("t.md");

				repo.loadFromRaw('[{"id":"a","value":1},{"id":"b","value":2}]', mockApp as never, file as TFile);
				const events = collectEvents(repo);

				repo.loadFromRaw('[{"id":"b","value":99},{"id":"c","value":3}]', mockApp as never, file as TFile);

				const eventTypes = events.map((e) => `${e.type}:${e.id}`);
				expect(eventTypes).toContain("row-deleted:a");
				expect(eventTypes).toContain("row-updated:b");
				expect(eventTypes).toContain("row-created:c");
				expect(events).toHaveLength(3);
			});
		});
	});

	describe("query API (inherited from ReadableTableMixin)", () => {
		const SEED_DATA = '[{"id":"b","value":2},{"id":"a","value":1},{"id":"c","value":3}]';

		function loadedQueryRepo() {
			const repo = createCrudRepo();
			repo.loadFromRaw(SEED_DATA, createMockApp({}) as never, createMockFile("t.md") as TFile);
			return repo;
		}

		it("count() should return number of items", () => {
			expect(loadedQueryRepo().count()).toBe(3);
		});

		it("first() should return first sorted DataRow", () => {
			expect(loadedQueryRepo().first()).toEqual({ id: "a", data: { id: "a", value: 1 } });
		});

		it("first(predicate) should return first matching DataRow", () => {
			const first = loadedQueryRepo().first((r) => r.data.value > 1);
			expect(first?.data).toEqual({ id: "b", value: 2 });
		});

		it("toArray() should return readonly sorted DataRows", () => {
			expect(
				loadedQueryRepo()
					.toArray()
					.map((r) => r.id)
			).toEqual(["a", "b", "c"]);
		});

		it("toClonedArray() should return a new array reference", () => {
			const repo = loadedQueryRepo();
			expect(repo.toClonedArray()).not.toBe(repo.toClonedArray());
			expect(repo.toClonedArray()).toEqual([...repo.toArray()]);
		});

		it("where() should filter rows", () => {
			expect(
				loadedQueryRepo()
					.where((r) => r.data.value >= 2)
					.map((r) => r.id)
			).toEqual(["b", "c"]);
		});

		it("findBy() should find rows by data key value", () => {
			const result = loadedQueryRepo().findBy("value", 2);
			expect(result).toHaveLength(1);
			expect(result[0].data).toEqual({ id: "b", value: 2 });
		});

		it("orderBy() should sort with custom comparator", () => {
			expect(
				loadedQueryRepo()
					.orderBy((a, b) => b.data.value - a.data.value)
					.map((r) => r.id)
			).toEqual(["c", "b", "a"]);
		});

		it("groupBy() should group rows", () => {
			const groups = loadedQueryRepo().groupBy((r) => (r.data.value <= 2 ? "low" : "high"));
			expect(groups.get("low")?.map((r) => r.id)).toEqual(["a", "b"]);
			expect(groups.get("high")?.map((r) => r.id)).toEqual(["c"]);
		});

		it("pluck() should extract data values", () => {
			expect(loadedQueryRepo().pluck("value")).toEqual([1, 2, 3]);
		});

		it("some() should test predicate on rows", () => {
			const repo = loadedQueryRepo();
			expect(repo.some((r) => r.data.value === 3)).toBe(true);
			expect(repo.some((r) => r.data.value === 99)).toBe(false);
		});

		it("every() should test predicate on rows", () => {
			const repo = loadedQueryRepo();
			expect(repo.every((r) => r.data.value > 0)).toBe(true);
			expect(repo.every((r) => r.data.value > 1)).toBe(false);
		});

		it("createGroupBy() should create reactive grouped index", () => {
			const repo = loadedQueryRepo();
			const groups = repo.createGroupBy((r) => (r.data.value <= 2 ? "low" : "high"));
			expect(groups.getGroup("low").map((r) => r.id)).toEqual(["a", "b"]);
			groups.destroy();
		});

		it("createMultiGroupBy() should create reactive multi-group index", () => {
			const repo = loadedQueryRepo();
			const groups = repo.createMultiGroupBy((r) => (r.data.value <= 2 ? ["low", "all"] : ["high", "all"]));
			expect(groups.getGroup("all")).toHaveLength(3);
			groups.destroy();
		});
	});

	describe("lazy sorted caching", () => {
		it("should rebuild sorted array only when dirty", async () => {
			const repo = createCrudRepo();
			const mockApp = createMockApp({
				vault: {
					read: vi.fn().mockResolvedValue("```test-block\n[]\n```"),
					modify: vi.fn(),
				},
				workspace: { getActiveViewOfType: vi.fn().mockReturnValue(null) },
			});
			const file = createMockFile("t.md");
			repo.loadFromRaw("[]", mockApp as never, file as TFile);

			const arr1 = repo.toArray();
			const arr2 = repo.toArray();
			expect(arr1).toBe(arr2);

			await repo.create({ id: "a", value: 1 });
			const arr3 = repo.toArray();
			expect(arr3).not.toBe(arr1);
			expect(arr3.map((r) => r.data)).toEqual([{ id: "a", value: 1 }]);

			const arr4 = repo.toArray();
			expect(arr4).toBe(arr3);
		});
	});

	describe("destroy", () => {
		it("should complete events$ and clear data", () => {
			const repo = createCrudRepo();
			repo.loadFromRaw('[{"id":"a","value":1}]', createMockApp({}) as never, createMockFile("t.md") as TFile);

			let completed = false;
			repo.events$.subscribe({ complete: () => (completed = true) });

			repo.destroy();

			expect(completed).toBe(true);
			expect(repo.count()).toBe(0);
			expect(allItems(repo)).toEqual([]);
		});
	});
});
