import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FrontmatterDiff } from "../../src/core/frontmatter/frontmatter-diff";
import { FrontmatterPropagationDebouncer } from "../../src/core/frontmatter/frontmatter-propagation-debouncer";

function makeDiff(changes: FrontmatterDiff["changes"] = [], hasChanges = true): FrontmatterDiff {
	return {
		hasChanges,
		changes,
		added: changes.filter((c) => c.changeType === "added"),
		modified: changes.filter((c) => c.changeType === "modified"),
		deleted: changes.filter((c) => c.changeType === "deleted"),
	};
}

const DEBOUNCE_MS = 200;

describe("FrontmatterPropagationDebouncer", () => {
	let debouncer: FrontmatterPropagationDebouncer<string>;

	beforeEach(() => {
		vi.useFakeTimers();
		debouncer = new FrontmatterPropagationDebouncer({ debounceMs: DEBOUNCE_MS });
	});

	afterEach(() => {
		debouncer.destroy();
		vi.useRealTimers();
	});

	describe("single call", () => {
		it("should fire onFlush after the debounce period", () => {
			const onFlush = vi.fn();
			const diff = makeDiff([{ key: "status", oldValue: "draft", newValue: "active", changeType: "modified" }]);

			debouncer.schedule("file-a", diff, "ctx-a", onFlush);

			expect(onFlush).not.toHaveBeenCalled();

			vi.advanceTimersByTime(DEBOUNCE_MS);

			expect(onFlush).toHaveBeenCalledOnce();
		});

		it("should pass the merged diff and latest context to onFlush", () => {
			const onFlush = vi.fn();
			const diff = makeDiff([{ key: "title", oldValue: "Old", newValue: "New", changeType: "modified" }]);

			debouncer.schedule("file-a", diff, "context-1", onFlush);
			vi.advanceTimersByTime(DEBOUNCE_MS);

			expect(onFlush).toHaveBeenCalledWith(expect.objectContaining({ hasChanges: true }), "context-1");
		});
	});

	describe("debouncing rapid calls", () => {
		it("should only fire once when scheduled multiple times within the debounce window", () => {
			const onFlush = vi.fn();
			const diff1 = makeDiff([{ key: "status", oldValue: "draft", newValue: "active", changeType: "modified" }]);
			const diff2 = makeDiff([{ key: "priority", oldValue: 0, newValue: 1, changeType: "modified" }]);

			debouncer.schedule("file-a", diff1, "ctx-1", onFlush);
			vi.advanceTimersByTime(100);

			debouncer.schedule("file-a", diff2, "ctx-2", onFlush);
			vi.advanceTimersByTime(DEBOUNCE_MS);

			expect(onFlush).toHaveBeenCalledOnce();
		});

		it("should use the latest context from the most recent schedule call", () => {
			const onFlush = vi.fn();
			const diff1 = makeDiff([{ key: "a", oldValue: 1, newValue: 2, changeType: "modified" }]);
			const diff2 = makeDiff([{ key: "b", oldValue: 3, newValue: 4, changeType: "modified" }]);

			debouncer.schedule("file-a", diff1, "first-context", onFlush);
			vi.advanceTimersByTime(50);
			debouncer.schedule("file-a", diff2, "latest-context", onFlush);
			vi.advanceTimersByTime(DEBOUNCE_MS);

			expect(onFlush).toHaveBeenCalledWith(expect.anything(), "latest-context");
		});

		it("should merge diffs from rapid calls", () => {
			const onFlush = vi.fn();
			const diff1 = makeDiff([{ key: "status", oldValue: "draft", newValue: "active", changeType: "modified" }]);
			const diff2 = makeDiff([{ key: "priority", oldValue: undefined, newValue: 5, changeType: "added" }]);

			debouncer.schedule("file-a", diff1, "ctx", onFlush);
			debouncer.schedule("file-a", diff2, "ctx", onFlush);
			vi.advanceTimersByTime(DEBOUNCE_MS);

			const mergedDiff = onFlush.mock.calls[0][0] as FrontmatterDiff;
			expect(mergedDiff.hasChanges).toBe(true);
			expect(mergedDiff.changes.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("independent keys", () => {
		it("should debounce different keys independently", () => {
			const onFlushA = vi.fn();
			const onFlushB = vi.fn();
			const diffA = makeDiff([{ key: "title", oldValue: "A", newValue: "B", changeType: "modified" }]);
			const diffB = makeDiff([{ key: "title", oldValue: "X", newValue: "Y", changeType: "modified" }]);

			debouncer.schedule("file-a", diffA, "ctx-a", onFlushA);
			vi.advanceTimersByTime(100);
			debouncer.schedule("file-b", diffB, "ctx-b", onFlushB);

			vi.advanceTimersByTime(100);
			expect(onFlushA).toHaveBeenCalledOnce();
			expect(onFlushB).not.toHaveBeenCalled();

			vi.advanceTimersByTime(100);
			expect(onFlushB).toHaveBeenCalledOnce();
		});

		it("should not interfere when scheduling different keys at the same time", () => {
			const onFlushA = vi.fn();
			const onFlushB = vi.fn();
			const diffA = makeDiff([{ key: "status", oldValue: "a", newValue: "b", changeType: "modified" }]);
			const diffB = makeDiff([{ key: "status", oldValue: "x", newValue: "y", changeType: "modified" }]);

			debouncer.schedule("file-a", diffA, "ctx-a", onFlushA);
			debouncer.schedule("file-b", diffB, "ctx-b", onFlushB);

			vi.advanceTimersByTime(DEBOUNCE_MS);

			expect(onFlushA).toHaveBeenCalledOnce();
			expect(onFlushB).toHaveBeenCalledOnce();
		});
	});

	describe("filterDiff option", () => {
		it("should apply filterDiff before invoking onFlush", () => {
			const filterDiff = vi.fn((diff: FrontmatterDiff) => ({
				...diff,
				changes: diff.changes.filter((c) => c.key !== "ignored"),
				modified: diff.modified.filter((c) => c.key !== "ignored"),
			}));

			const filteredDebouncer = new FrontmatterPropagationDebouncer<string>({
				debounceMs: DEBOUNCE_MS,
				filterDiff,
			});

			const onFlush = vi.fn();
			const diff = makeDiff([
				{ key: "title", oldValue: "A", newValue: "B", changeType: "modified" },
				{ key: "ignored", oldValue: "x", newValue: "y", changeType: "modified" },
			]);

			filteredDebouncer.schedule("file-a", diff, "ctx", onFlush);
			vi.advanceTimersByTime(DEBOUNCE_MS);

			expect(filterDiff).toHaveBeenCalledOnce();
			expect(onFlush).toHaveBeenCalledOnce();

			const flushedDiff = onFlush.mock.calls[0][0] as FrontmatterDiff;
			expect(flushedDiff.changes).toHaveLength(1);
			expect(flushedDiff.changes[0].key).toBe("title");

			filteredDebouncer.destroy();
		});

		it("should not invoke onFlush when filtered diff has no changes", () => {
			const filterDiff = vi.fn(
				(): FrontmatterDiff => ({
					hasChanges: false,
					changes: [],
					added: [],
					modified: [],
					deleted: [],
				})
			);

			const filteredDebouncer = new FrontmatterPropagationDebouncer<string>({
				debounceMs: DEBOUNCE_MS,
				filterDiff,
			});

			const onFlush = vi.fn();
			const diff = makeDiff([{ key: "title", oldValue: "A", newValue: "B", changeType: "modified" }]);

			filteredDebouncer.schedule("file-a", diff, "ctx", onFlush);
			vi.advanceTimersByTime(DEBOUNCE_MS);

			expect(filterDiff).toHaveBeenCalledOnce();
			expect(onFlush).not.toHaveBeenCalled();

			filteredDebouncer.destroy();
		});
	});

	describe("destroy", () => {
		it("should cancel all pending timers", () => {
			const onFlush = vi.fn();
			const diff = makeDiff([{ key: "a", oldValue: 1, newValue: 2, changeType: "modified" }]);

			debouncer.schedule("file-a", diff, "ctx", onFlush);
			debouncer.schedule("file-b", diff, "ctx", onFlush);

			debouncer.destroy();
			vi.advanceTimersByTime(DEBOUNCE_MS * 2);

			expect(onFlush).not.toHaveBeenCalled();
		});

		it("should clear accumulated entries", () => {
			const onFlush = vi.fn();
			const diff = makeDiff([{ key: "title", oldValue: "A", newValue: "B", changeType: "modified" }]);

			debouncer.schedule("file-a", diff, "ctx", onFlush);
			debouncer.destroy();

			debouncer.schedule("file-a", diff, "new-ctx", onFlush);
			vi.advanceTimersByTime(DEBOUNCE_MS);

			expect(onFlush).toHaveBeenCalledOnce();
			expect(onFlush).toHaveBeenCalledWith(expect.anything(), "new-ctx");
		});
	});

	describe("void context type", () => {
		it("should work with void context (no context needed)", () => {
			const voidDebouncer = new FrontmatterPropagationDebouncer({ debounceMs: DEBOUNCE_MS });
			const onFlush = vi.fn();
			const diff = makeDiff([{ key: "title", oldValue: "A", newValue: "B", changeType: "modified" }]);

			voidDebouncer.schedule("file-a", diff, undefined as never, onFlush);
			vi.advanceTimersByTime(DEBOUNCE_MS);

			expect(onFlush).toHaveBeenCalledOnce();
			voidDebouncer.destroy();
		});
	});
});
