/**
 * Contract tests for the generic device-local KV store.
 *
 * LocalKV is the monorepo's one-stop wrapper for per-device state that
 * must NOT replicate via vault-sync (iCloud / Syncthing / OneDrive). The
 * first caller is CalDAV sync-collection tokens; more will follow. These
 * tests pin the essential behaviour the callers rely on — namespacing,
 * schema-validated reads, partial-patch merges, deletion semantics,
 * and tolerance of corrupt entries written by older builds.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { type KVBackend, LocalKV } from "../../src/core/storage/local-kv";

function createInMemoryBackend(): KVBackend & { snapshot: () => Map<string, string> } {
	const store = new Map<string, string>();
	return {
		getItem: (key) => store.get(key) ?? null,
		setItem: (key, value) => {
			store.set(key, value);
		},
		removeItem: (key) => {
			store.delete(key);
		},
		snapshot: () => new Map(store),
	};
}

const SampleSchema = z
	.object({
		token: z.string().optional(),
		updatedAt: z.number().int().optional(),
	})
	.loose();

type Sample = z.infer<typeof SampleSchema>;

describe("LocalKV — generic device-local KV store", () => {
	it("round-trips a value under a scoped key", () => {
		const backend = createInMemoryBackend();
		const kv = new LocalKV<Sample>({ namespace: "test:kv", schema: SampleSchema, backend });

		kv.set("scope-1", { token: "t", updatedAt: 1_000 });

		expect(kv.get("scope-1")).toEqual({ token: "t", updatedAt: 1_000 });
	});

	it("prefixes every entry with the namespace, so callers can't collide", () => {
		const backend = createInMemoryBackend();
		const kv = new LocalKV<Sample>({ namespace: "feature-a", schema: SampleSchema, backend });

		kv.set("scope-1", { token: "t" });

		const keys = Array.from(backend.snapshot().keys());
		expect(keys).toEqual(["feature-a:scope-1"]);
	});

	it("returns null when nothing is stored — the caller's cue to init from defaults", () => {
		const backend = createInMemoryBackend();
		const kv = new LocalKV<Sample>({ namespace: "test:kv", schema: SampleSchema, backend });

		expect(kv.get("never-set")).toBeNull();
	});

	it("returns null (not throw) on corrupt JSON — losing one entry is better than wedging sync", () => {
		const backend = createInMemoryBackend();
		backend.setItem("test:kv:mangled", "{ not json");
		const kv = new LocalKV<Sample>({ namespace: "test:kv", schema: SampleSchema, backend });

		expect(kv.get("mangled")).toBeNull();
		// A subsequent write recovers the entry.
		kv.set("mangled", { token: "fresh" });
		expect(kv.get("mangled")).toEqual({ token: "fresh" });
	});

	it("returns null on schema-incompatible entries so old builds can't poison new readers", () => {
		const backend = createInMemoryBackend();
		backend.setItem("test:kv:legacy", JSON.stringify({ token: 42, extra: "ignored" })); // token must be string
		const kv = new LocalKV<Sample>({ namespace: "test:kv", schema: SampleSchema, backend });

		expect(kv.get("legacy")).toBeNull();
	});

	it("merge() preserves prior fields the patch doesn't mention", () => {
		const backend = createInMemoryBackend();
		const kv = new LocalKV<Sample>({ namespace: "test:kv", schema: SampleSchema, backend });

		kv.set("scope-1", { token: "initial", updatedAt: 1_000 });
		kv.merge("scope-1", { updatedAt: 2_000 });

		expect(kv.get("scope-1")).toEqual({ token: "initial", updatedAt: 2_000 });
	});

	it("merge() treats an explicit `undefined` in the patch as a deletion of that field", () => {
		const backend = createInMemoryBackend();
		const kv = new LocalKV<Sample>({ namespace: "test:kv", schema: SampleSchema, backend });

		kv.set("scope-1", { token: "about-to-clear", updatedAt: 1_000 });
		kv.merge("scope-1", { token: undefined });

		const after = kv.get("scope-1")!;
		expect(after.token).toBeUndefined();
		// Other fields survive.
		expect(after.updatedAt).toBe(1_000);
	});

	it("merge() on an empty scope initialises with the patch as the stored value", () => {
		const backend = createInMemoryBackend();
		const kv = new LocalKV<Sample>({ namespace: "test:kv", schema: SampleSchema, backend });

		kv.merge("brand-new", { token: "first-write" });

		expect(kv.get("brand-new")).toEqual({ token: "first-write" });
	});

	it("delete() removes the entry from the backend", () => {
		const backend = createInMemoryBackend();
		const kv = new LocalKV<Sample>({ namespace: "test:kv", schema: SampleSchema, backend });

		kv.set("scope-1", { token: "t" });
		kv.delete("scope-1");

		expect(kv.get("scope-1")).toBeNull();
		expect(Array.from(backend.snapshot().keys())).toHaveLength(0);
	});

	it("separate scopes under the same namespace are independent", () => {
		const backend = createInMemoryBackend();
		const kv = new LocalKV<Sample>({ namespace: "test:kv", schema: SampleSchema, backend });

		kv.set("a", { token: "alpha" });
		kv.set("b", { token: "beta" });

		expect(kv.get("a")).toEqual({ token: "alpha" });
		expect(kv.get("b")).toEqual({ token: "beta" });
		kv.delete("a");
		expect(kv.get("a")).toBeNull();
		expect(kv.get("b")).toEqual({ token: "beta" });
	});

	it("two LocalKV instances with different namespaces can't see each other's entries", () => {
		const backend = createInMemoryBackend();
		const kvA = new LocalKV<Sample>({ namespace: "ns-a", schema: SampleSchema, backend });
		const kvB = new LocalKV<Sample>({ namespace: "ns-b", schema: SampleSchema, backend });

		kvA.set("shared-scope", { token: "from-a" });
		kvB.set("shared-scope", { token: "from-b" });

		expect(kvA.get("shared-scope")).toEqual({ token: "from-a" });
		expect(kvB.get("shared-scope")).toEqual({ token: "from-b" });
	});
});
