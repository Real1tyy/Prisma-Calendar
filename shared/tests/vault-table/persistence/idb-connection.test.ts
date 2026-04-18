import { beforeEach, describe, expect, it } from "vitest";

import { ClosedIdbConnection, OpenIdbConnection } from "../../../src/core/vault-table/persistence/idb-connection";
import { makeFakeIdb } from "./fake-idb";

describe("ClosedIdbConnection / OpenIdbConnection (typestate)", () => {
	const DB = "obsidian-cache-test";
	let factory: ReturnType<typeof makeFakeIdb>;

	beforeEach(() => {
		factory = makeFakeIdb();
	});

	function closed(): ClosedIdbConnection {
		return new ClosedIdbConnection(DB, factory);
	}

	it("open() returns an OpenIdbConnection and re-opens after close", async () => {
		const c = closed();
		const open = await c.open();
		expect(open).toBeInstanceOf(OpenIdbConnection);

		const closedAgain = open.close();
		expect(closedAgain).toBeInstanceOf(ClosedIdbConnection);

		const reopened = await closedAgain.open();
		expect(reopened).toBeInstanceOf(OpenIdbConnection);
		expect(reopened).not.toBe(open);
		reopened.close();
	});

	it("open() deduplicates concurrent callers into the same connection", async () => {
		const c = closed();
		const [a, b, d] = await Promise.all([c.open(), c.open(), c.open()]);
		expect(a).toBe(b);
		expect(b).toBe(d);
		a.close();
	});

	it("subsequent open() after close() produces a fresh connection", async () => {
		const c = closed();
		const first = await c.open();
		first.close();
		const second = await c.open();
		expect(second).not.toBe(first);
		second.close();
	});

	it("stores and reads back schema version", async () => {
		const c = await closed().open();
		expect(await c.getStoredSchemaVersion()).toBeUndefined();
		await c.setStoredSchemaVersion(3);
		expect(await c.getStoredSchemaVersion()).toBe(3);
		c.close();
	});

	it("writes and reads records within a prefix range", async () => {
		const c = await closed().open();
		await c.putBatch([
			["ns-a\0file1", { data: 1 }],
			["ns-a\0file2", { data: 2 }],
			["ns-b\0file1", { data: 99 }],
		]);

		const recA = await c.getAllInRange("ns-a\0");
		expect(recA.map((r) => r.key).sort()).toEqual(["ns-a\0file1", "ns-a\0file2"]);
		expect(await c.getAllInRange("ns-b\0")).toHaveLength(1);
		c.close();
	});

	it("fire-and-forget writes on a stale post-close reference are swallowed", async () => {
		const c = await closed().open();
		c.close();
		// Native IDBDatabase throws InvalidStateError once closed; our try/catch eats it.
		expect(() => c.put("k", { x: 1 })).not.toThrow();
		expect(() => c.delete("k")).not.toThrow();
	});

	it("read operations on a stale reference reject", async () => {
		const c = await closed().open();
		c.close();
		await expect(c.getStoredSchemaVersion()).rejects.toThrow();
		await expect(c.getAllInRange("x\0")).rejects.toThrow();
		await expect(c.clearAll()).rejects.toThrow();
	});

	it("clearRange only deletes matching prefix", async () => {
		const c = await closed().open();
		await c.putBatch([
			["alpha\0one", 1],
			["alpha\0two", 2],
			["beta\0one", 3],
		]);
		await c.clearRange("alpha\0");
		expect(await c.getAllInRange("alpha\0")).toHaveLength(0);
		expect(await c.getAllInRange("beta\0")).toHaveLength(1);
		c.close();
	});

	it("clearAll wipes the entire row store", async () => {
		const c = await closed().open();
		await c.putBatch([
			["x\0a", 1],
			["y\0b", 2],
		]);
		await c.clearAll();
		expect(await c.getAllInRange("x\0")).toHaveLength(0);
		expect(await c.getAllInRange("y\0")).toHaveLength(0);
		c.close();
	});

	it("deleteDatabase wipes rows and meta", async () => {
		const c1 = await closed().open();
		await c1.setStoredSchemaVersion(5);
		await c1.putBatch([["x\0a", 1]]);
		const reclosed = await c1.deleteDatabase();

		const c2 = await reclosed.open();
		expect(await c2.getStoredSchemaVersion()).toBeUndefined();
		expect(await c2.getAllInRange("x\0")).toHaveLength(0);
		c2.close();
	});

	it("ClosedIdbConnection.deleteDatabase is safe when nothing is open", async () => {
		await expect(ClosedIdbConnection.deleteDatabase(DB, factory)).resolves.toBeUndefined();
	});

	it("putBatch is a no-op on empty input", async () => {
		const c = await closed().open();
		await expect(c.putBatch([])).resolves.toBeUndefined();
		c.close();
	});

	it("flush resolves even when no writes are pending", async () => {
		const c = await closed().open();
		await expect(c.flush()).resolves.toBeUndefined();
		c.close();
	});

	it("flush waits for fire-and-forget writes queued through this connection", async () => {
		const c = await closed().open();
		c.put("x\0a", { v: 1 });
		c.put("x\0b", { v: 2 });
		await c.flush();
		const rows = await c.getAllInRange("x\0");
		expect(rows).toHaveLength(2);
		c.close();
	});
});
