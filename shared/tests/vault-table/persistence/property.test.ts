import fc from "fast-check";
import { describe, it } from "vitest";

import { PersistentTableCache } from "../../../src/core/vault-table/persistence/persistent-table-cache";
import { makeFakeIdb } from "./fake-idb";

type Row = { name: string; value: number };
type Op =
	| { kind: "put"; path: string; row: Row; mtime: number }
	| { kind: "delete"; path: string }
	| { kind: "rename"; from: string; to: string; row: Row; mtime: number };

const pathArb = fc.constantFrom("a.md", "b.md", "c.md", "d.md", "e.md");
const rowArb = fc.record({ name: fc.string(), value: fc.integer({ min: 0, max: 1000 }) });
const mtimeArb = fc.integer({ min: 1, max: 100000 });

const opArb: fc.Arbitrary<Op> = fc.oneof(
	fc.record({ kind: fc.constant("put" as const), path: pathArb, row: rowArb, mtime: mtimeArb }),
	fc.record({ kind: fc.constant("delete" as const), path: pathArb }),
	fc.record({
		kind: fc.constant("rename" as const),
		from: pathArb,
		to: pathArb,
		row: rowArb,
		mtime: mtimeArb,
	})
);

describe("PersistentTableCache — property", () => {
	it("final hydrated state matches a reference Map after a random op stream", async () => {
		await fc.assert(
			fc.asyncProperty(fc.array(opArb, { minLength: 0, maxLength: 30 }), async (ops) => {
				const factory = makeFakeIdb();
				const cache = await PersistentTableCache.create<Row>({
					config: { namespace: `prop-${Math.random().toString(36).slice(2)}`, schemaVersion: 1 },
					directoryPrefix: "events",
					idbFactory: factory,
				});
				if (!cache) throw new Error("cache creation failed");

				const ref = new Map<string, { data: Row; mtime: number }>();

				for (const op of ops) {
					if (op.kind === "put") {
						ref.set(op.path, { data: op.row, mtime: op.mtime });
						cache.put(op.path, op.row, op.mtime);
					} else if (op.kind === "delete") {
						ref.delete(op.path);
						cache.delete(op.path);
					} else {
						ref.delete(op.from);
						ref.set(op.to, { data: op.row, mtime: op.mtime });
						cache.rename(op.from, op.to, op.row, op.mtime);
					}
				}
				await cache.flush();

				const hydrated = await cache.hydrate();
				// Compare keys
				if (hydrated.size !== ref.size) {
					throw new Error(`size mismatch: ref=${ref.size} actual=${hydrated.size}`);
				}
				for (const [path, { data, mtime }] of ref) {
					const got = hydrated.get(path);
					if (!got) throw new Error(`missing path ${path}`);
					if (got.mtime !== mtime) throw new Error(`mtime mismatch at ${path}`);
					if (got.data.name !== data.name || got.data.value !== data.value) {
						throw new Error(`data mismatch at ${path}`);
					}
				}
				cache.close();
			}),
			{ numRuns: 40 }
		);
	});
});
