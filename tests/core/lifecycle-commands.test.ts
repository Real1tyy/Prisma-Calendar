import { describe, expect, it, vi } from "vitest";

import { DeleteEventCommand } from "../../src/core/commands/lifecycle-commands";
import type { EventFileRepository, FrontmatterSnapshot } from "../../src/core/event-file-repository";
import type { Frontmatter } from "../../src/types";

// `DeleteEventCommand` lives at the boundary of the redo race documented in
// docs-site/docs/changelog.md (2.16.x) — re-execute must reuse the snapshot
// captured on first execute. Re-snapshotting after `undo()` restored the file
// is racy: the file exists on disk but the VaultTable indexer (debounceMs)
// has not ingested it yet, so `snapshotByPath` throws and the redo silently
// drops. These tests pin the contract so the regression cannot recur.
function makeDeleteRepoStub(initial: Record<string, Frontmatter>) {
	const store = new Map<string, Frontmatter>(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
	const indexed = new Set<string>(store.keys());

	const snapshotByPath = vi.fn(async (filePath: string): Promise<FrontmatterSnapshot> => {
		// Mirror the real repo: only files present in the indexer are
		// snapshot-able. The redo race is born from this check tripping on
		// a freshly-restored file the indexer has not yet picked up.
		if (!indexed.has(filePath)) throw new Error(`Event file not found: ${filePath}`);
		const current = store.get(filePath)!;
		return {
			key: filePath,
			data: structuredClone(current),
			content: JSON.stringify(current),
			filePath,
			file: { path: filePath } as FrontmatterSnapshot["file"],
		};
	});

	const deleteByPath = vi.fn(async (filePath: string): Promise<void> => {
		store.delete(filePath);
		indexed.delete(filePath);
	});

	const restoreSnapshot = vi.fn(async (snapshot: FrontmatterSnapshot): Promise<void> => {
		store.set(snapshot.filePath, structuredClone(snapshot.data));
		// Indexer lag is the caller's concern — tests opt into "restored but
		// not yet indexed" by mutating `indexed` after this call.
	});

	const repo = {
		snapshotByPath,
		deleteByPath,
		restoreSnapshot,
		// Test-only handles.
		markIndexed(filePath: string): void {
			indexed.add(filePath);
		},
		markUnindexed(filePath: string): void {
			indexed.delete(filePath);
		},
		exists(filePath: string): boolean {
			return store.has(filePath);
		},
	};

	return repo as unknown as EventFileRepository & {
		markIndexed(filePath: string): void;
		markUnindexed(filePath: string): void;
		exists(filePath: string): boolean;
		snapshotByPath: typeof snapshotByPath;
		deleteByPath: typeof deleteByPath;
		restoreSnapshot: typeof restoreSnapshot;
	};
}

describe("DeleteEventCommand", () => {
	const path = "Events/Workout.md";

	it("snapshots on first execute, deletes the file, and restores on undo", async () => {
		const repo = makeDeleteRepoStub({ [path]: { Title: "Workout", "Start Date": "2026-05-18T07:00" } });
		const cmd = new DeleteEventCommand(repo, path);

		await cmd.execute();
		expect(repo.exists(path)).toBe(false);
		expect(cmd.canUndo()).toBe(true);

		await cmd.undo();
		expect(repo.exists(path)).toBe(true);
	});

	it("redo reuses the snapshot taken on first execute (does not re-snapshot)", async () => {
		const repo = makeDeleteRepoStub({ [path]: { Title: "Workout" } });
		const cmd = new DeleteEventCommand(repo, path);

		await cmd.execute();
		await cmd.undo();

		expect(repo.snapshotByPath).toHaveBeenCalledTimes(1);

		// Redo.
		await cmd.execute();
		expect(repo.snapshotByPath).toHaveBeenCalledTimes(1);
		expect(repo.exists(path)).toBe(false);
	});

	it("redo succeeds even when the indexer has not yet caught up to the restored file", async () => {
		// The exact race that produced flake #2: undo restores the file, the
		// disk write resolves, but the indexer's debounce window has not fired
		// — so `snapshotByPath` would still throw if redo re-snapshotted.
		const repo = makeDeleteRepoStub({ [path]: { Title: "Workout" } });
		const cmd = new DeleteEventCommand(repo, path);

		await cmd.execute();
		await cmd.undo();
		repo.markUnindexed(path);

		await expect(cmd.execute()).resolves.toBeUndefined();
		expect(repo.exists(path)).toBe(false);
	});

	it("throws on undo when no snapshot was ever taken (defensive)", async () => {
		const repo = makeDeleteRepoStub({ [path]: { Title: "Workout" } });
		const cmd = new DeleteEventCommand(repo, path);

		await expect(cmd.undo()).rejects.toThrow("Cannot undo: no snapshot stored");
		expect(cmd.canUndo()).toBe(false);
	});
});
