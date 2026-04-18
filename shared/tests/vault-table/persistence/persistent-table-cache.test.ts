import { beforeEach, describe, expect, it } from "vitest";

import { ClosedIdbConnection } from "../../../src/core/vault-table/persistence/idb-connection";
import { PersistentTableCache } from "../../../src/core/vault-table/persistence/persistent-table-cache";
import { makeFakeIdb } from "./fake-idb";

interface Row {
	name: string;
	value: number;
}

async function settle(): Promise<void> {
	// fake-indexeddb runs tx in microtasks; yield to ensure fire-and-forget puts land
	await Promise.resolve();
	await Promise.resolve();
	await new Promise((r) => setTimeout(r, 0));
}

describe("PersistentTableCache", () => {
	let factory: ReturnType<typeof makeFakeIdb>;

	beforeEach(() => {
		factory = makeFakeIdb();
	});

	async function make(namespace: string, directory: string, schemaVersion = 1) {
		const cache = await PersistentTableCache.create<Row>({
			config: { namespace, schemaVersion },
			directoryPrefix: directory,
			idbFactory: factory,
		});
		if (!cache) throw new Error("expected non-null cache");
		return cache;
	}

	it("create() returns null when disabled", async () => {
		const cache = await PersistentTableCache.create<Row>({
			config: { namespace: "nsx", schemaVersion: 1, enabled: false },
			directoryPrefix: "events",
			idbFactory: factory,
		});
		expect(cache).toBeNull();
	});

	it("writes and hydrates entries across close/reopen", async () => {
		const c = await make("plg", "events");
		c.put("a.md", { name: "a", value: 1 }, 100);
		c.put("b.md", { name: "b", value: 2 }, 200);
		await settle();
		c.close();

		const c2 = await make("plg", "events");
		const hydrated = await c2.hydrate();
		expect(hydrated.size).toBe(2);
		expect(hydrated.get("a.md")).toMatchObject({ data: { name: "a", value: 1 }, mtime: 100 });
		expect(hydrated.get("b.md")).toMatchObject({ data: { name: "b", value: 2 }, mtime: 200 });
		c2.close();
	});

	it("isolates directory prefixes within the same namespace", async () => {
		const events = await make("plg", "events");
		const notes = await make("plg", "notes");

		events.put("a.md", { name: "e", value: 1 }, 100);
		notes.put("a.md", { name: "n", value: 2 }, 200);
		await settle();

		expect((await events.hydrate()).get("a.md")?.data.name).toBe("e");
		expect((await notes.hydrate()).get("a.md")?.data.name).toBe("n");

		events.close();
		notes.close();
	});

	it("isolates namespaces into separate databases", async () => {
		const a = await make("plugin-a", "dir");
		const b = await make("plugin-b", "dir");
		a.put("x.md", { name: "A", value: 1 }, 1);
		b.put("x.md", { name: "B", value: 2 }, 2);
		await settle();

		expect((await a.hydrate()).get("x.md")?.data.name).toBe("A");
		expect((await b.hydrate()).get("x.md")?.data.name).toBe("B");

		a.close();
		b.close();
	});

	it("deletes the database when schema version changes", async () => {
		const c1 = await make("plg", "events", 1);
		c1.put("a.md", { name: "a", value: 1 }, 100);
		await settle();
		c1.close();

		const c2 = await make("plg", "events", 2);
		expect((await c2.hydrate()).size).toBe(0);
		await c2.putBatch([["a.md", { name: "a2", value: 2 }, 200]]);
		c2.close();

		const c3 = await make("plg", "events", 2);
		expect((await c3.hydrate()).get("a.md")?.data.value).toBe(2);
		c3.close();
	});

	it("skips malformed stored entries at hydration time", async () => {
		const seedConn = await new ClosedIdbConnection("obsidian-cache-plg", factory).open();
		await seedConn.setStoredSchemaVersion(1);
		// Corruption-resilience: entries missing the required fields are dropped silently.
		await seedConn.putBatch([
			["events\0a.md", { data: { name: "bad", value: 0 } }], // missing mtime
			["events\0b.md", { mtime: 2 }], // missing data
			["events\0c.md", { data: { name: "ok", value: 3 }, mtime: 3 }],
			["events\0d.md", "not-an-object"],
		]);
		seedConn.close();

		const c = await make("plg", "events", 1);
		const hydrated = await c.hydrate();
		expect(hydrated.has("a.md")).toBe(false);
		expect(hydrated.has("b.md")).toBe(false);
		expect(hydrated.has("d.md")).toBe(false);
		expect(hydrated.get("c.md")?.data.name).toBe("ok");
		c.close();
	});

	it("delete removes an entry", async () => {
		const c = await make("plg", "events");
		c.put("a.md", { name: "a", value: 1 }, 100);
		await settle();
		c.delete("a.md");
		await settle();
		expect((await c.hydrate()).size).toBe(0);
		c.close();
	});

	it("rename moves entry from old path to new path", async () => {
		const c = await make("plg", "events");
		c.put("old.md", { name: "x", value: 1 }, 100);
		await settle();
		c.rename("old.md", "new.md", { name: "x", value: 1 }, 101);
		await settle();
		const h = await c.hydrate();
		expect(h.has("old.md")).toBe(false);
		expect(h.get("new.md")?.mtime).toBe(101);
		c.close();
	});

	it("clear wipes only this directory prefix", async () => {
		const events = await make("plg", "events");
		const notes = await make("plg", "notes");
		events.put("a.md", { name: "e", value: 1 }, 1);
		notes.put("a.md", { name: "n", value: 2 }, 2);
		await settle();

		await events.clear();
		expect((await events.hydrate()).size).toBe(0);
		expect((await notes.hydrate()).size).toBe(1);

		events.close();
		notes.close();
	});

	it("putBatch writes many entries atomically", async () => {
		const c = await make("plg", "events");
		await c.putBatch([
			["a.md", { name: "a", value: 1 }, 100],
			["b.md", { name: "b", value: 2 }, 200],
			["c.md", { name: "c", value: 3 }, 300],
		]);
		const h = await c.hydrate();
		expect(h.size).toBe(3);
		c.close();
	});

	it("fire-and-forget writes on a stale post-close reference are swallowed", async () => {
		const c = await make("plg", "events");
		c.close();
		expect(() => c.put("a.md", { name: "a", value: 1 }, 100)).not.toThrow();
	});
});
