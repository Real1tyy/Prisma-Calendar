// Integration tests covering the Indexer → VaultTable pipeline. The two
// layers each have unit tests, but the original cross-calendar-move bug lived
// in the seam between them — the indexer dropped the rename intent before it
// reached the VaultTable, so neither unit suite caught it.
//
// These tests wire a real Indexer to a real VaultTable through a mock vault
// that tracks event listeners. Every assertion is keyed off
// `table.events$` — proof that scope-boundary transitions reach the data
// layer the rest of the codebase consumes.

import type { App, TFile } from "obsidian";
import { firstValueFrom } from "rxjs";
import { filter, take } from "rxjs/operators";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { withSerialize } from "../../src/core/vault-table/create-mapped-schema";
import type { VaultTableEvent } from "../../src/core/vault-table/types";
import { VaultTable } from "../../src/core/vault-table/vault-table";
import { createMockApp, createMockFile } from "../../src/testing/mocks/obsidian";

// Schema mirrors what an actual plugin would persist — a couple of optional
// keys so frontmatter changes have something visible to diff against.
const TestSchema = withSerialize(
	z.object({
		title: z.string(),
		priority: z.number().default(0),
	})
);

type TestData = z.infer<typeof TestSchema>;

describe("Indexer → VaultTable reactivity (integration)", () => {
	const DIR = "Events";
	const OUT_OF_SCOPE_DIR = "Inbox";

	let mockApp: App;
	let vaultHandlers: Map<string, Set<(...args: unknown[]) => void>>;
	let metadataCacheHandlers: Map<string, Set<(...args: unknown[]) => void>>;
	let frontmatterByPath: Map<string, Record<string, unknown> | null>;
	let table: VaultTable<TestData, typeof TestSchema> | null = null;

	function setFrontmatter(path: string, frontmatter: Record<string, unknown> | null): void {
		frontmatterByPath.set(path, frontmatter);
	}

	function emitVaultRename(file: TFile, oldPath: string): void {
		vaultHandlers.get("rename")?.forEach((h) => h(file, oldPath));
	}

	function emitMetadataChanged(file: TFile): void {
		vaultHandlers.get("modify")?.forEach((h) => h(file));
		metadataCacheHandlers.get("changed")?.forEach((h) => h(file));
	}

	function emitMetadataDeleted(file: TFile): void {
		metadataCacheHandlers.get("deleted")?.forEach((h) => h(file, null));
	}

	function newFile(path: string, mtime = 1000): TFile {
		const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
		return createMockFile(path, { parentPath: parent, mtime });
	}

	async function collectTableEvents(
		target: VaultTable<TestData, typeof TestSchema>,
		count: number,
		action: () => void | Promise<void>
	): Promise<VaultTableEvent<TestData>[]> {
		const events: VaultTableEvent<TestData>[] = [];
		const sub = target.events$.subscribe((e) => events.push(e));
		await action();
		// Indexer events flow through `mergeMap(buildEvent)` which awaits a
		// `vault.cachedRead` — give it microtask + macrotask room to settle.
		await new Promise((resolve) => window.setTimeout(resolve, 80));
		sub.unsubscribe();
		return events.slice(0, count + 1);
	}

	beforeEach(async () => {
		vaultHandlers = new Map();
		metadataCacheHandlers = new Map();
		frontmatterByPath = new Map();

		const fileStore = new Map<string, TFile>();

		const app = createMockApp({
			vault: {
				getMarkdownFiles: vi.fn(() => []),
				cachedRead: vi.fn().mockResolvedValue(""),
				getAbstractFileByPath: vi.fn().mockImplementation((path: string) => fileStore.get(path) ?? null),
				getFileByPath: vi.fn().mockImplementation((path: string) => fileStore.get(path) ?? null),
				on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
					if (!vaultHandlers.has(event)) vaultHandlers.set(event, new Set());
					vaultHandlers.get(event)?.add(handler);
					return {} as never;
				}),
				off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
					vaultHandlers.get(event)?.delete(handler);
				}),
				createFolder: vi.fn().mockResolvedValue(undefined),
			},
			metadataCache: {
				// Look up frontmatter by the live TFile.path so renames that
				// mutate TFile.path resolve correctly without manual rekeying.
				getFileCache: vi.fn((file: TFile) => {
					const fm = frontmatterByPath.get(file.path);
					return fm ? ({ frontmatter: fm } as never) : null;
				}),
				on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
					if (!metadataCacheHandlers.has(event)) metadataCacheHandlers.set(event, new Set());
					metadataCacheHandlers.get(event)?.add(handler);
					if (event === "resolved") {
						queueMicrotask(() => handler());
					}
					return Symbol("ref");
				}),
				offref: vi.fn(),
			},
		});

		mockApp = app as unknown as App;
		// Expose for tests that need to seed files into the lookup map.
		Object.assign(mockApp, { __fileStore: fileStore });
	});

	afterEach(() => {
		table?.destroy();
		table = null;
		vi.restoreAllMocks();
	});

	function getFileStore(): Map<string, TFile> {
		return (mockApp as unknown as { __fileStore: Map<string, TFile> }).__fileStore;
	}

	async function startTableWith(seed?: { path: string; frontmatter: Record<string, unknown> }): Promise<{
		table: VaultTable<TestData, typeof TestSchema>;
		seedFile: TFile | null;
	}> {
		const seedFile = seed ? newFile(seed.path) : null;
		if (seedFile && seed) {
			getFileStore().set(seed.path, seedFile);
			setFrontmatter(seed.path, seed.frontmatter);
			vi.mocked(mockApp.vault.getMarkdownFiles).mockReturnValue([seedFile]);
		}

		const created = new VaultTable<TestData, typeof TestSchema>({
			app: mockApp,
			directory: DIR,
			schema: TestSchema,
			debounceMs: 10,
		});

		await created.start();
		await firstValueFrom(created.ready$.pipe(filter(Boolean), take(1)));
		table = created;
		return { table: created, seedFile };
	}

	// ─── In-scope baseline (sanity that the pipeline is wired) ──────────────

	it("emits row-created when a file inside scope becomes visible", async () => {
		const { table } = await startTableWith();

		const file = newFile(`${DIR}/note.md`);
		getFileStore().set(file.path, file);
		setFrontmatter(file.path, { title: "Created" });

		const events = await collectTableEvents(table, 1, () => emitMetadataChanged(file));

		expect(events.map((e) => e.type)).toContain("row-created");
		const created = events.find((e) => e.type === "row-created")!;
		expect(created.filePath).toBe(`${DIR}/note.md`);
	});

	it("emits row-deleted when a file inside scope is deleted", async () => {
		const { table, seedFile } = await startTableWith({
			path: `${DIR}/note.md`,
			frontmatter: { title: "Doomed" },
		});

		const events = await collectTableEvents(table, 1, () => emitMetadataDeleted(seedFile!));

		expect(events).toHaveLength(1);
		expect(events[0].type).toBe("row-deleted");
		expect(events[0].filePath).toBe(`${DIR}/note.md`);
	});

	// ─── Rename scope-boundary matrix (the regression we're protecting) ────

	it("emits row-deleted when a tracked file is renamed OUT of scope (cross-calendar-move flow)", async () => {
		const { table, seedFile } = await startTableWith({
			path: `${DIR}/note.md`,
			frontmatter: { title: "Moving" },
		});

		// Simulate Obsidian's fileManager.renameFile — the TFile reference's
		// path is mutated in place; getAbstractFileByPath now resolves the
		// old key to null.
		const oldPath = seedFile!.path;
		const newPath = `${OUT_OF_SCOPE_DIR}/note.md`;
		seedFile!.path = newPath;
		const store = getFileStore();
		store.delete(oldPath);
		store.set(newPath, seedFile!);
		frontmatterByPath.delete(oldPath);
		frontmatterByPath.set(newPath, { title: "Moving" });

		const events = await collectTableEvents(table, 1, () => emitVaultRename(seedFile!, oldPath));

		expect(events).toHaveLength(1);
		expect(events[0].type).toBe("row-deleted");
		expect(events[0].filePath).toBe(oldPath);
	});

	it("emits row-created when a file is renamed INTO scope", async () => {
		const { table } = await startTableWith();

		const oldPath = `${OUT_OF_SCOPE_DIR}/note.md`;
		const newPath = `${DIR}/note.md`;
		const renamed = newFile(newPath);
		getFileStore().set(newPath, renamed);
		setFrontmatter(newPath, { title: "Arrived" });

		const events = await collectTableEvents(table, 1, () => emitVaultRename(renamed, oldPath));

		expect(events.map((e) => e.type)).toContain("row-created");
		const created = events.find((e) => e.type === "row-created")!;
		expect(created.filePath).toBe(newPath);
	});

	it("emits row-deleted + row-created when a tracked file is renamed within scope", async () => {
		const { table, seedFile } = await startTableWith({
			path: `${DIR}/old.md`,
			frontmatter: { title: "Staying" },
		});

		const oldPath = seedFile!.path;
		const newPath = `${DIR}/new.md`;
		seedFile!.path = newPath;
		const store = getFileStore();
		store.delete(oldPath);
		store.set(newPath, seedFile!);
		frontmatterByPath.delete(oldPath);
		frontmatterByPath.set(newPath, { title: "Staying" });

		const events = await collectTableEvents(table, 2, () => emitVaultRename(seedFile!, oldPath));

		const types = events.map((e) => e.type);
		expect(types).toContain("row-deleted");
		expect(types).toContain("row-created");
		expect(events.find((e) => e.type === "row-deleted")!.filePath).toBe(oldPath);
		expect(events.find((e) => e.type === "row-created")!.filePath).toBe(newPath);
	});

	it("emits no row events when a rename's old and new paths are both out of scope", async () => {
		const { table } = await startTableWith();

		const oldPath = `${OUT_OF_SCOPE_DIR}/old.md`;
		const newPath = `${OUT_OF_SCOPE_DIR}/new.md`;
		const renamed = newFile(newPath);
		getFileStore().set(newPath, renamed);

		const events = await collectTableEvents(table, 0, () => emitVaultRename(renamed, oldPath));

		expect(events).toHaveLength(0);
	});

	// ─── Repeated boundary crossings (no leaks) ────────────────────────────

	it("survives multiple round-trips: in-scope file leaves, returns, leaves again", async () => {
		const { table, seedFile } = await startTableWith({
			path: `${DIR}/ping.md`,
			frontmatter: { title: "Round-trip" },
		});

		const inScope = seedFile!.path;
		const outOfScope = `${OUT_OF_SCOPE_DIR}/ping.md`;
		const store = getFileStore();

		// Leave scope.
		seedFile!.path = outOfScope;
		store.delete(inScope);
		store.set(outOfScope, seedFile!);
		frontmatterByPath.delete(inScope);
		frontmatterByPath.set(outOfScope, { title: "Round-trip" });
		let events = await collectTableEvents(table, 1, () => emitVaultRename(seedFile!, inScope));
		expect(events[0]?.type).toBe("row-deleted");

		// Return to scope.
		seedFile!.path = inScope;
		store.delete(outOfScope);
		store.set(inScope, seedFile!);
		frontmatterByPath.delete(outOfScope);
		frontmatterByPath.set(inScope, { title: "Round-trip" });
		events = await collectTableEvents(table, 1, () => emitVaultRename(seedFile!, outOfScope));
		expect(events.map((e) => e.type)).toContain("row-created");

		// Leave scope again — must still emit row-deleted (no stale-cache leak).
		seedFile!.path = outOfScope;
		store.delete(inScope);
		store.set(outOfScope, seedFile!);
		frontmatterByPath.delete(inScope);
		frontmatterByPath.set(outOfScope, { title: "Round-trip" });
		events = await collectTableEvents(table, 1, () => emitVaultRename(seedFile!, inScope));
		expect(events[0]?.type).toBe("row-deleted");
	});
});
