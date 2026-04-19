/**
 * Race-condition tests for `EventFileRepository.enqueueFrontmatterWrite`.
 *
 * `fmLocks` is the per-file promise queue that serializes processFrontMatter
 * calls to prevent interleaved writes. Races we pin:
 *
 * 1. **Same-file concurrent writes run strictly in order.** Three writes to
 *    /Events/foo.md fired in quick succession must not call processFrontMatter
 *    in parallel — the fileManager API is not re-entrant and interleaving
 *    would silently drop mutations.
 *
 * 2. **Different-file concurrent writes do NOT serialize.** The lock is per
 *    file path; two unrelated files must be able to run at the same time.
 *
 * 3. **One write rejecting does not poison the chain.** If write #1 throws,
 *    writes #2 and #3 queued behind it must still run — the fmLocks chain
 *    uses `.finally()` cleanup so later writes can't be trapped behind a
 *    rejected promise.
 *
 * 4. **Lock map cleans up when the last write completes.** After all writes
 *    drain, `fmLocks.get(path)` is undefined — otherwise the Map grows
 *    unbounded across a long session.
 */
import { createDeferredVoid } from "@real1ty-obsidian-plugins/testing";
import type { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRepoSettingsStore, TestableEventFileRepository } from "../fixtures/event-file-repository-fixtures";
import { createMockApp, createMockFile } from "../setup";

type DeferredFrontmatterCall = {
	filePath: string;
	fn: (fm: Record<string, unknown>) => void;
	gate: ReturnType<typeof createDeferredVoid>;
	applied: boolean;
};

async function flushMicrotasks(): Promise<void> {
	for (let i = 0; i < 8; i++) await Promise.resolve();
}

function installGatedProcessFrontmatter(mockApp: any): {
	calls: DeferredFrontmatterCall[];
	frontmatterByPath: Map<string, Record<string, unknown>>;
} {
	const calls: DeferredFrontmatterCall[] = [];
	const frontmatterByPath = new Map<string, Record<string, unknown>>();

	mockApp.fileManager.processFrontMatter.mockImplementation(
		async (file: { path: string }, fn: (fm: Record<string, unknown>) => void) => {
			const gate = createDeferredVoid();
			const entry: DeferredFrontmatterCall = { filePath: file.path, fn, gate, applied: false };
			calls.push(entry);
			await gate.promise;
			const fm = frontmatterByPath.get(file.path) ?? {};
			fn(fm);
			frontmatterByPath.set(file.path, fm);
			entry.applied = true;
		}
	);

	return { calls, frontmatterByPath };
}

function registerFile(mockApp: any, path: string): void {
	const file = createMockFile(path);
	mockApp.vault.getAbstractFileByPath.mockImplementation((p: string) => (p === path ? file : null));
}

function registerFiles(mockApp: any, paths: string[]): void {
	const files = new Map(paths.map((p) => [p, createMockFile(p)] as const));
	mockApp.vault.getAbstractFileByPath.mockImplementation((p: string) => files.get(p) ?? null);
}

describe("EventFileRepository.enqueueFrontmatterWrite — race conditions", () => {
	let mockApp: any;
	let settingsStore: BehaviorSubject<any>;
	let repo: TestableEventFileRepository;

	beforeEach(() => {
		mockApp = createMockApp();
		settingsStore = createRepoSettingsStore();
		repo = new TestableEventFileRepository(mockApp, settingsStore);
	});

	afterEach(() => {
		repo.destroy();
	});

	it("serializes concurrent writes to the same file", async () => {
		registerFile(mockApp, "Events/foo.md");
		const { calls, frontmatterByPath } = installGatedProcessFrontmatter(mockApp);

		// Fire three markFileAsDone against foo.md before any gate opens.
		const a = repo.markFileAsDone("Events/foo.md");
		const b = repo.markFileAsDone("Events/foo.md");
		const c = repo.markFileAsDone("Events/foo.md");

		// With serialization, only ONE processFrontMatter has been invoked
		// so far — the second and third are queued behind the first's lock.
		await flushMicrotasks();
		expect(calls).toHaveLength(1);
		expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalledTimes(1);

		// Resolve in order. After each gate opens, the next queued call runs.
		calls[0].gate.resolve();
		await flushMicrotasks();
		expect(calls).toHaveLength(2);

		calls[1].gate.resolve();
		await flushMicrotasks();
		expect(calls).toHaveLength(3);

		calls[2].gate.resolve();
		await Promise.all([a, b, c]);

		// All three writes landed, strictly in order.
		expect(calls.map((c) => c.applied)).toEqual([true, true, true]);
		expect(frontmatterByPath.get("Events/foo.md")).toEqual({ Status: "done" });
	});

	it("runs writes to DIFFERENT files in parallel", async () => {
		registerFiles(mockApp, ["Events/foo.md", "Events/bar.md", "Events/baz.md"]);
		const { calls } = installGatedProcessFrontmatter(mockApp);

		const a = repo.markFileAsDone("Events/foo.md");
		const b = repo.markFileAsDone("Events/bar.md");
		const c = repo.markFileAsDone("Events/baz.md");

		// Each file has its own lock chain, so all three processFrontMatter
		// calls should be in flight simultaneously.
		await flushMicrotasks();
		expect(calls).toHaveLength(3);
		expect(new Set(calls.map((c) => c.filePath))).toEqual(new Set(["Events/foo.md", "Events/bar.md", "Events/baz.md"]));

		calls.forEach((call) => call.gate.resolve());
		await Promise.all([a, b, c]);
	});

	it("a rejected write does not block subsequent writes to the same file", async () => {
		const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		registerFile(mockApp, "Events/foo.md");
		const calls: Array<{ gate: ReturnType<typeof createDeferredVoid>; fail: boolean }> = [];

		mockApp.fileManager.processFrontMatter.mockImplementation(async () => {
			const gate = createDeferredVoid();
			const entry = { gate, fail: calls.length === 0 };
			calls.push(entry);
			await gate.promise;
			if (entry.fail) throw new Error("processFrontMatter exploded");
		});

		// Fire 3 writes; the FIRST will throw.
		const a = repo.markFileAsDone("Events/foo.md");
		const b = repo.markFileAsDone("Events/foo.md");
		const c = repo.markFileAsDone("Events/foo.md");

		await flushMicrotasks();
		expect(calls).toHaveLength(1);

		calls[0].gate.resolve();
		await flushMicrotasks();

		// Write #2 must have started despite write #1 throwing.
		expect(calls).toHaveLength(2);

		calls[1].gate.resolve();
		await flushMicrotasks();
		calls[2].gate.resolve();

		// markFileAsDone swallows the error internally, so none of these reject.
		await Promise.all([a, b, c]);
		expect(calls).toHaveLength(3);
		errSpy.mockRestore();
	});

	it("clears fmLocks map entry after the last write drains", async () => {
		registerFile(mockApp, "Events/foo.md");
		installGatedProcessFrontmatter(mockApp);

		const locks = (repo as unknown as { fmLocks: Map<string, Promise<void>> }).fmLocks;

		// Auto-resolve the gate so each write completes promptly.
		mockApp.fileManager.processFrontMatter.mockImplementation(
			async (_file: { path: string }, fn: (fm: Record<string, unknown>) => void) => {
				fn({});
			}
		);

		const a = repo.markFileAsDone("Events/foo.md");
		// While the write is in flight, the lock entry exists.
		expect(locks.has("Events/foo.md")).toBe(true);

		await a;
		// Flush the .finally cleanup microtask.
		await flushMicrotasks();

		// Map is empty after drain — prevents unbounded Map growth over time.
		expect(locks.has("Events/foo.md")).toBe(false);
	});

	it("a second write arriving after the first drained starts a fresh chain", async () => {
		registerFile(mockApp, "Events/foo.md");
		const locks = (repo as unknown as { fmLocks: Map<string, Promise<void>> }).fmLocks;

		mockApp.fileManager.processFrontMatter.mockImplementation(
			async (_file: { path: string }, fn: (fm: Record<string, unknown>) => void) => {
				fn({});
			}
		);

		await repo.markFileAsDone("Events/foo.md");
		await Promise.resolve();
		expect(locks.has("Events/foo.md")).toBe(false);

		await repo.markFileAsDone("Events/foo.md");
		await Promise.resolve();
		expect(locks.has("Events/foo.md")).toBe(false);

		expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalledTimes(2);
	});
});
