import { IDBFactory as FakeIDBFactory, IDBKeyRange as FakeIDBKeyRange } from "fake-indexeddb";

import type { IdbFactory } from "../../../src/core/vault-table/persistence/types";

/**
 * Produce a fresh in-memory IDB factory so each test is fully isolated from
 * the others. Also patches the global `IDBKeyRange` used by OpenIdbConnection
 * helpers — fake-indexeddb's IDBKeyRange must be visible to the range queries.
 */
export function makeFakeIdb(): IdbFactory {
	const factory = new FakeIDBFactory();
	// Ensure IDBKeyRange works regardless of test environment (node).
	if (typeof (globalThis as { IDBKeyRange?: unknown }).IDBKeyRange === "undefined") {
		(globalThis as unknown as { IDBKeyRange: typeof FakeIDBKeyRange }).IDBKeyRange = FakeIDBKeyRange;
	}
	return {
		open: (name, version) => factory.open(name, version),
		deleteDatabase: (name) => factory.deleteDatabase(name),
	};
}
