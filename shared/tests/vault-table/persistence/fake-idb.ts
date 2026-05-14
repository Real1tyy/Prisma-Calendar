import { IDBFactory as FakeIDBFactory, IDBKeyRange as FakeIDBKeyRange } from "fake-indexeddb";

import type { IdbFactory } from "../../../src/core/vault-table/persistence/types";

// eslint-disable-next-line obsidianmd/no-global-this -- node-only test shim
type GlobalWithIdbKeyRange = typeof globalThis & {
	IDBKeyRange?: typeof FakeIDBKeyRange;
};

/**
 * Produce a fresh in-memory IDB factory so each test is fully isolated from
 * the others. Also patches the global `IDBKeyRange` used by OpenIdbConnection
 * helpers — fake-indexeddb's IDBKeyRange must be visible to the range queries.
 */
export function makeFakeIdb(): IdbFactory {
	const factory = new FakeIDBFactory();

	// Reaches for `globalThis` so the polyfill lands in pure-node test runs too
	// (where `window` is undefined). The `obsidianmd/no-global-this` rule exists
	// to prevent popout-window foot-guns in plugin runtime code; this helper
	// only runs in vitest / node, never in Obsidian.
	// eslint-disable-next-line obsidianmd/no-global-this -- node-only test shim
	const globalScope = globalThis as GlobalWithIdbKeyRange;
	globalScope.IDBKeyRange ??= FakeIDBKeyRange;

	return {
		open: (name, version) => factory.open(name, version),
		deleteDatabase: (name) => factory.deleteDatabase(name),
	};
}
