import type { App } from "obsidian";
import { TFile } from "obsidian";
import { BehaviorSubject, Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { Indexer, type IndexerEvent } from "../../../src/core/indexer";
import { withSerialize } from "../../../src/core/vault-table/create-mapped-schema";
import { VaultTable } from "../../../src/core/vault-table/vault-table";
import { createMockApp } from "../../../src/testing/mocks/obsidian";
import { makeFakeIdb } from "./fake-idb";

vi.mock("../../../src/core/indexer");

const TestSchema = withSerialize(
	z.object({
		title: z.string(),
		priority: z.number().default(0),
	})
);

function makeFile(path: string, mtime = 1000): TFile {
	const f = new TFile(path);
	f.stat = { mtime, ctime: mtime, size: 0 };
	return f;
}

function fileChanged(filePath: string, frontmatter: Record<string, unknown>, mtime = 1000): IndexerEvent {
	return {
		type: "file-changed",
		filePath,
		source: {
			file: makeFile(filePath, mtime),
			filePath,
			mtime,
			frontmatter,
			folder: filePath.split("/").slice(0, -1).join("/"),
		},
	};
}

describe("VaultTable + persistence (integration)", () => {
	let events$: Subject<IndexerEvent>;
	// Each Indexer constructor call gets a fresh complete$ so that a `true` value
	// emitted for table N does not leak into table N+1's subscription and
	// prematurely release its hydration snapshot.
	let currentComplete$: BehaviorSubject<boolean>;
	let parseSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		events$ = new Subject<IndexerEvent>();
		vi.mocked(Indexer).mockImplementation(() => {
			const complete$ = new BehaviorSubject<boolean>(false);
			currentComplete$ = complete$;
			return {
				events$: events$.asObservable(),
				indexingComplete$: complete$.asObservable(),
				start: vi.fn().mockResolvedValue(undefined),
				stop: vi.fn(),
				resync: vi.fn(),
			} as unknown as Indexer;
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	function makeApp() {
		return createMockApp({
			vault: {
				getMarkdownFiles: vi.fn(() => []),
				on: vi.fn(),
				off: vi.fn(),
				cachedRead: vi.fn().mockResolvedValue(""),
				createFolder: vi.fn().mockResolvedValue(undefined),
				getAbstractFileByPath: vi.fn().mockReturnValue(null),
			},
			metadataCache: { getFileCache: vi.fn(() => null), on: vi.fn(), offref: vi.fn() },
		}) as unknown as App;
	}

	it("writes through indexer events to the persistent cache", async () => {
		const idb = makeFakeIdb();
		const app = makeApp();

		const table = new VaultTable({
			app,
			directory: "events",
			schema: TestSchema,
			persistence: { namespace: "plg-int-1", schemaVersion: 1 },
			persistenceIdbFactory: idb,
		});
		await table.start();

		events$.next(fileChanged("events/a.md", { title: "A", priority: 1 }, 100));
		events$.next(fileChanged("events/b.md", { title: "B", priority: 2 }, 200));
		currentComplete$.next(true);
		await new Promise((r) => setTimeout(r, 20));
		await table.destroyAsync();

		// Reopen a fresh table — hydration should produce the same data without parsing.
		const table2 = new VaultTable({
			app,
			directory: "events",
			schema: TestSchema,
			persistence: { namespace: "plg-int-1", schemaVersion: 1 },
			persistenceIdbFactory: idb,
		});
		parseSpy = vi.spyOn(TestSchema, "safeParse");
		await table2.start();

		events$.next(fileChanged("events/a.md", { title: "A", priority: 1 }, 100));
		events$.next(fileChanged("events/b.md", { title: "B", priority: 2 }, 200));
		await new Promise((r) => setTimeout(r, 20));

		// Both events had matching mtime in cache → zero parses.
		expect(parseSpy).not.toHaveBeenCalled();
		expect(table2.get("a")?.data.title).toBe("A");
		expect(table2.get("b")?.data.priority).toBe(2);
		await table2.destroyAsync();
	});

	it("re-parses when a file's mtime has changed since cache", async () => {
		const idb = makeFakeIdb();
		const app = makeApp();

		const t1 = new VaultTable({
			app,
			directory: "events",
			schema: TestSchema,
			persistence: { namespace: "plg-int-2", schemaVersion: 1 },
			persistenceIdbFactory: idb,
		});
		await t1.start();
		events$.next(fileChanged("events/a.md", { title: "old", priority: 1 }, 100));
		await new Promise((r) => setTimeout(r, 20));
		await t1.destroyAsync();

		const t2 = new VaultTable({
			app,
			directory: "events",
			schema: TestSchema,
			persistence: { namespace: "plg-int-2", schemaVersion: 1 },
			persistenceIdbFactory: idb,
		});
		parseSpy = vi.spyOn(TestSchema, "safeParse");
		await t2.start();
		// Newer mtime — cache miss → parse fires, fresh data wins.
		events$.next(fileChanged("events/a.md", { title: "new", priority: 9 }, 500));
		await new Promise((r) => setTimeout(r, 20));

		expect(parseSpy).toHaveBeenCalled();
		expect(t2.get("a")?.data.title).toBe("new");
		expect(t2.get("a")?.data.priority).toBe(9);
		await t2.destroyAsync();
	});

	it("deletes cache entries when files are deleted", async () => {
		const idb = makeFakeIdb();
		const app = makeApp();

		const t1 = new VaultTable({
			app,
			directory: "events",
			schema: TestSchema,
			persistence: { namespace: "plg-int-3", schemaVersion: 1 },
			persistenceIdbFactory: idb,
		});
		await t1.start();
		events$.next(fileChanged("events/a.md", { title: "A", priority: 1 }, 100));
		await new Promise((r) => setTimeout(r, 10));
		events$.next({ type: "file-deleted", filePath: "events/a.md" });
		await new Promise((r) => setTimeout(r, 10));
		await t1.destroyAsync();

		const t2 = new VaultTable({
			app,
			directory: "events",
			schema: TestSchema,
			persistence: { namespace: "plg-int-3", schemaVersion: 1 },
			persistenceIdbFactory: idb,
		});
		parseSpy = vi.spyOn(TestSchema, "safeParse");
		await t2.start();
		events$.next(fileChanged("events/a.md", { title: "A2", priority: 2 }, 500));
		await new Promise((r) => setTimeout(r, 10));

		// Deleted entry means fresh parse on reappearance.
		expect(parseSpy).toHaveBeenCalled();
		expect(t2.get("a")?.data.title).toBe("A2");
		await t2.destroyAsync();
	});

	it("isolates two tables under different namespaces", async () => {
		const idb = makeFakeIdb();
		const app = makeApp();

		const mkTable = (ns: string) =>
			new VaultTable({
				app,
				directory: "events",
				schema: TestSchema,
				persistence: { namespace: ns, schemaVersion: 1 },
				persistenceIdbFactory: idb,
			});

		const a = mkTable("plg-int-4a");
		const b = mkTable("plg-int-4b");
		await a.start();
		await b.start();
		events$.next(fileChanged("events/x.md", { title: "A-owned", priority: 1 }, 100));
		// Both subscribe to the same mock events$; that's fine — cache is per-namespace.
		await new Promise((r) => setTimeout(r, 10));
		await a.destroyAsync();
		await b.destroyAsync();

		// Wipe namespace A only by bumping its schema version.
		const a2 = new VaultTable({
			app,
			directory: "events",
			schema: TestSchema,
			persistence: { namespace: "plg-int-4a", schemaVersion: 99 },
			persistenceIdbFactory: idb,
		});
		const b2 = new VaultTable({
			app,
			directory: "events",
			schema: TestSchema,
			persistence: { namespace: "plg-int-4b", schemaVersion: 1 },
			persistenceIdbFactory: idb,
		});
		parseSpy = vi.spyOn(TestSchema, "safeParse");
		await a2.start();
		await b2.start();

		events$.next(fileChanged("events/x.md", { title: "A-owned", priority: 1 }, 100));
		await new Promise((r) => setTimeout(r, 10));

		// A was nuked (schema bump) → had to parse. B kept its cache → should NOT need to parse for the same event.
		// Parse may be called once (for A's cache miss), but not twice.
		expect(parseSpy.mock.calls.length).toBeLessThanOrEqual(1);
		await a2.destroyAsync();
		await b2.destroyAsync();
	});

	it("enabled: false disables all persistence operations", async () => {
		const idb = makeFakeIdb();
		const app = makeApp();

		const t1 = new VaultTable({
			app,
			directory: "events",
			schema: TestSchema,
			persistence: { namespace: "plg-int-5", schemaVersion: 1, enabled: false },
			persistenceIdbFactory: idb,
		});
		await t1.start();
		events$.next(fileChanged("events/a.md", { title: "A", priority: 1 }, 100));
		await new Promise((r) => setTimeout(r, 10));
		await t1.destroyAsync();

		// Even without "enabled: false" this time, there should be no cached data to hydrate
		// because the first table was disabled.
		const t2 = new VaultTable({
			app,
			directory: "events",
			schema: TestSchema,
			persistence: { namespace: "plg-int-5", schemaVersion: 1 },
			persistenceIdbFactory: idb,
		});
		parseSpy = vi.spyOn(TestSchema, "safeParse");
		await t2.start();
		events$.next(fileChanged("events/a.md", { title: "A", priority: 1 }, 100));
		await new Promise((r) => setTimeout(r, 10));

		expect(parseSpy).toHaveBeenCalled();
		await t2.destroyAsync();
	});

	// Regression: if a same-second write updated the file during the previous
	// session (category rename, bulk frontmatter edit) but the live-session
	// dedup swallowed the update, IDB may hold stale parsed data tagged with
	// the CURRENT file's mtime. On cold start the fs-reported mtime still
	// matches, so a blind mtime-equality fast path would return the stale
	// data. Hydration must verify that raw frontmatter still matches before
	// trusting the cache — otherwise re-parse and overwrite.
	it("hydration re-parses when raw frontmatter diverges from cache despite matching mtime", async () => {
		const idb = makeFakeIdb();
		const app = makeApp();

		const t1 = new VaultTable({
			app,
			directory: "events",
			schema: TestSchema,
			persistence: { namespace: "plg-int-stale", schemaVersion: 1 },
			persistenceIdbFactory: idb,
		});
		await t1.start();
		events$.next(fileChanged("events/a.md", { title: "stale", priority: 1 }, 100));
		currentComplete$.next(true);
		await new Promise((r) => setTimeout(r, 20));
		await t1.destroyAsync();

		const t2 = new VaultTable({
			app,
			directory: "events",
			schema: TestSchema,
			persistence: { namespace: "plg-int-stale", schemaVersion: 1 },
			persistenceIdbFactory: idb,
		});
		await t2.start();

		// Same mtime, different raw frontmatter — simulates a same-second
		// processFrontMatter write that the previous session's live dedup
		// dropped before it could persist.
		events$.next(fileChanged("events/a.md", { title: "fresh", priority: 9 }, 100));
		await new Promise((r) => setTimeout(r, 20));

		expect(t2.get("a")?.data.title).toBe("fresh");
		expect(t2.get("a")?.data.priority).toBe(9);
		await t2.destroyAsync();
	});
});
