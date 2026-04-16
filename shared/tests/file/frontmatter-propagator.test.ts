import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Frontmatter, FrontmatterDiff } from "../../src/core/frontmatter/frontmatter-diff";
import {
	filterExcludedPropsFromDiff,
	FrontmatterPropagator,
	type FrontmatterPropagatorConfig,
} from "../../src/core/frontmatter/frontmatter-propagator";

function createDiff(overrides: Partial<FrontmatterDiff> = {}): FrontmatterDiff {
	return {
		hasChanges: true,
		changes: [],
		added: [],
		modified: [{ key: "status", oldValue: "pending", newValue: "done" }],
		deleted: [],
		...overrides,
	};
}

function createConfig(overrides: Partial<FrontmatterPropagatorConfig> = {}): FrontmatterPropagatorConfig {
	return {
		debounceMs: 0,
		debounceKeyPrefix: "test",
		isEnabled: () => true,
		isAskBefore: () => false,
		getExcludedProps: () => new Set<string>(),
		resolveTargets: () => ["target-1.md", "target-2.md"],
		getModalTitle: (key) => `Test: ${key}`,
		applyChanges: vi.fn().mockResolvedValue(undefined),
		showModal: vi.fn(),
		...overrides,
	};
}

const mockApp = {} as any;

describe("FrontmatterPropagator", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// ─── Auto-propagation ────────────────────────────────────────

	describe("auto-propagation (isEnabled=true)", () => {
		it("should call applyChanges for each target after debounce", async () => {
			const applyChanges = vi.fn().mockResolvedValue(undefined);
			const config = createConfig({ applyChanges });
			const propagator = new FrontmatterPropagator(mockApp, config);

			const fm: Frontmatter = { status: "done" };
			propagator.handleDiff("source.md", fm, createDiff(), "group-1");

			await vi.advanceTimersByTimeAsync(10);

			expect(applyChanges).toHaveBeenCalledTimes(2);
			expect(applyChanges).toHaveBeenCalledWith(mockApp, "target-1.md", fm, expect.any(Object));
			expect(applyChanges).toHaveBeenCalledWith(mockApp, "target-2.md", fm, expect.any(Object));

			propagator.destroy();
		});

		it("should not propagate when both isEnabled and isAskBefore are false", async () => {
			const applyChanges = vi.fn().mockResolvedValue(undefined);
			const config = createConfig({
				isEnabled: () => false,
				isAskBefore: () => false,
				applyChanges,
			});
			const propagator = new FrontmatterPropagator(mockApp, config);

			propagator.handleDiff("source.md", {}, createDiff(), "group-1");

			await vi.advanceTimersByTimeAsync(10);

			expect(applyChanges).not.toHaveBeenCalled();

			propagator.destroy();
		});

		it("should not propagate when resolveTargets returns empty", async () => {
			const applyChanges = vi.fn().mockResolvedValue(undefined);
			const config = createConfig({
				resolveTargets: () => [],
				applyChanges,
			});
			const propagator = new FrontmatterPropagator(mockApp, config);

			propagator.handleDiff("source.md", {}, createDiff(), "group-1");

			await vi.advanceTimersByTimeAsync(10);

			expect(applyChanges).not.toHaveBeenCalled();

			propagator.destroy();
		});

		it("should not propagate when diff has no changes", async () => {
			const applyChanges = vi.fn().mockResolvedValue(undefined);
			const config = createConfig({ applyChanges });
			const propagator = new FrontmatterPropagator(mockApp, config);

			propagator.handleDiff("source.md", {}, createDiff({ hasChanges: false, modified: [] }), "group-1");

			await vi.advanceTimersByTimeAsync(10);

			expect(applyChanges).not.toHaveBeenCalled();

			propagator.destroy();
		});
	});

	// ─── Confirmation modal ──────────────────────────────────────

	describe("ask-before mode (isAskBefore=true)", () => {
		it("should show modal instead of auto-propagating", async () => {
			const applyChanges = vi.fn().mockResolvedValue(undefined);
			const showModal = vi.fn();
			const config = createConfig({
				isEnabled: () => false,
				isAskBefore: () => true,
				applyChanges,
				showModal,
			});
			const propagator = new FrontmatterPropagator(mockApp, config);

			propagator.handleDiff("source.md", { status: "done" }, createDiff(), "work");

			await vi.advanceTimersByTimeAsync(10);

			expect(applyChanges).not.toHaveBeenCalled();
			expect(showModal).toHaveBeenCalledTimes(1);
			expect(showModal).toHaveBeenCalledWith(mockApp, {
				eventTitle: "Test: work",
				diff: expect.any(Object),
				instanceCount: 2,
				onConfirm: expect.any(Function),
			});

			propagator.destroy();
		});

		it("should propagate when modal onConfirm is called", async () => {
			const applyChanges = vi.fn().mockResolvedValue(undefined);
			const showModal = vi.fn();
			const config = createConfig({
				isEnabled: () => false,
				isAskBefore: () => true,
				applyChanges,
				showModal,
			});
			const propagator = new FrontmatterPropagator(mockApp, config);

			propagator.handleDiff("source.md", { status: "done" }, createDiff(), "work");

			await vi.advanceTimersByTimeAsync(10);

			// Simulate user clicking confirm
			const modalCall = showModal.mock.calls[0][1];
			modalCall.onConfirm();

			await vi.advanceTimersByTimeAsync(10);

			expect(applyChanges).toHaveBeenCalledTimes(2);

			propagator.destroy();
		});
	});

	// ─── Loop prevention ─────────────────────────────────────────

	describe("loop prevention", () => {
		it("should mark targets as propagating during propagation", async () => {
			const applyChanges = vi.fn().mockResolvedValue(undefined);
			const config = createConfig({ applyChanges });
			const propagator = new FrontmatterPropagator(mockApp, config);

			expect(propagator.isPropagating("target-1.md")).toBe(false);

			propagator.handleDiff("source.md", {}, createDiff(), "group-1");

			await vi.advanceTimersByTimeAsync(10);

			// Targets should be marked as propagating
			expect(propagator.isPropagating("target-1.md")).toBe(true);
			expect(propagator.isPropagating("target-2.md")).toBe(true);
			expect(propagator.isPropagating("source.md")).toBe(false);

			propagator.destroy();
		});

		it("should clear propagation flags after cleanup delay", async () => {
			const applyChanges = vi.fn().mockResolvedValue(undefined);
			const config = createConfig({ applyChanges });
			const propagator = new FrontmatterPropagator(mockApp, config);

			propagator.handleDiff("source.md", {}, createDiff(), "group-1");

			await vi.advanceTimersByTimeAsync(10);

			expect(propagator.isPropagating("target-1.md")).toBe(true);

			// Advance past the 2000ms cleanup delay
			await vi.advanceTimersByTimeAsync(2100);

			expect(propagator.isPropagating("target-1.md")).toBe(false);
			expect(propagator.isPropagating("target-2.md")).toBe(false);

			propagator.destroy();
		});

		it("should allow manual acknowledgement of propagation", () => {
			const config = createConfig();
			const propagator = new FrontmatterPropagator(mockApp, config);

			propagator.propagatingFilePaths.add("child.md");
			expect(propagator.isPropagating("child.md")).toBe(true);

			propagator.acknowledgePropagation("child.md");
			expect(propagator.isPropagating("child.md")).toBe(false);

			propagator.destroy();
		});
	});

	// ─── Excluded props filtering ────────────────────────────────

	describe("excluded props filtering", () => {
		it("should filter out excluded properties from the diff before propagation", async () => {
			const applyChanges = vi.fn().mockResolvedValue(undefined);
			const config = createConfig({
				getExcludedProps: () => new Set(["secret", "internal"]),
				applyChanges,
			});
			const propagator = new FrontmatterPropagator(mockApp, config);

			const diff = createDiff({
				modified: [
					{ key: "status", oldValue: "pending", newValue: "done" },
					{ key: "secret", oldValue: "old", newValue: "new" },
				],
				added: [{ key: "internal", newValue: "x" }],
			});

			propagator.handleDiff("source.md", { status: "done", secret: "new" }, diff, "group");

			await vi.advanceTimersByTimeAsync(10);

			// applyChanges should receive a filtered diff without "secret" and "internal"
			const passedDiff = applyChanges.mock.calls[0][3] as FrontmatterDiff;
			expect(passedDiff.modified).toHaveLength(1);
			expect(passedDiff.modified[0].key).toBe("status");
			expect(passedDiff.added).toHaveLength(0);

			propagator.destroy();
		});

		it("should not propagate if all changes are excluded", async () => {
			const applyChanges = vi.fn().mockResolvedValue(undefined);
			const config = createConfig({
				getExcludedProps: () => new Set(["status"]),
				applyChanges,
			});
			const propagator = new FrontmatterPropagator(mockApp, config);

			propagator.handleDiff("source.md", {}, createDiff(), "group");

			await vi.advanceTimersByTimeAsync(10);

			expect(applyChanges).not.toHaveBeenCalled();

			propagator.destroy();
		});
	});

	// ─── Debouncing ──────────────────────────────────────────────

	describe("debouncing", () => {
		it("should handle different groups independently", async () => {
			const applyChanges = vi.fn().mockResolvedValue(undefined);
			const config = createConfig({ applyChanges });
			const propagator = new FrontmatterPropagator(mockApp, config);

			propagator.handleDiff("source.md", {}, createDiff(), "group-A");
			propagator.handleDiff("source.md", {}, createDiff(), "group-B");

			await vi.advanceTimersByTimeAsync(10);

			// Each group fires independently → 2 targets each → 4 total
			expect(applyChanges).toHaveBeenCalledTimes(4);

			propagator.destroy();
		});
	});

	// ─── Destroy ─────────────────────────────────────────────────

	describe("destroy", () => {
		it("should clear propagation flags and debounce timers", async () => {
			const config = createConfig({ debounceMs: 1000 });
			const propagator = new FrontmatterPropagator(mockApp, config);

			propagator.propagatingFilePaths.add("file-1.md");
			propagator.handleDiff("source.md", {}, createDiff(), "group-1");

			propagator.destroy();

			expect(propagator.isPropagating("file-1.md")).toBe(false);
			expect(propagator.propagatingFilePaths.size).toBe(0);
		});
	});
});

// ─── filterExcludedPropsFromDiff ─────────────────────────────

describe("filterExcludedPropsFromDiff", () => {
	it("should remove excluded properties from all change types", () => {
		const diff: FrontmatterDiff = {
			hasChanges: true,
			changes: [],
			added: [
				{ key: "public", newValue: "yes" },
				{ key: "secret", newValue: "hidden" },
			],
			modified: [
				{ key: "status", oldValue: "a", newValue: "b" },
				{ key: "internal", oldValue: "x", newValue: "y" },
			],
			deleted: [
				{ key: "old", oldValue: "val" },
				{ key: "secret", oldValue: "was-hidden" },
			],
		};

		const result = filterExcludedPropsFromDiff(diff, new Set(["secret", "internal"]));

		expect(result.added).toHaveLength(1);
		expect(result.added[0].key).toBe("public");
		expect(result.modified).toHaveLength(1);
		expect(result.modified[0].key).toBe("status");
		expect(result.deleted).toHaveLength(1);
		expect(result.deleted[0].key).toBe("old");
		expect(result.hasChanges).toBe(true);
	});

	it("should return hasChanges=false when all changes are excluded", () => {
		const diff: FrontmatterDiff = {
			hasChanges: true,
			changes: [],
			added: [],
			modified: [{ key: "secret", oldValue: "a", newValue: "b" }],
			deleted: [],
		};

		const result = filterExcludedPropsFromDiff(diff, new Set(["secret"]));

		expect(result.hasChanges).toBe(false);
		expect(result.modified).toHaveLength(0);
	});

	it("should pass through all changes when excluded set is empty", () => {
		const diff: FrontmatterDiff = {
			hasChanges: true,
			changes: [],
			added: [{ key: "a", newValue: 1 }],
			modified: [{ key: "b", oldValue: 1, newValue: 2 }],
			deleted: [{ key: "c", oldValue: 3 }],
		};

		const result = filterExcludedPropsFromDiff(diff, new Set());

		expect(result.added).toHaveLength(1);
		expect(result.modified).toHaveLength(1);
		expect(result.deleted).toHaveLength(1);
		expect(result.hasChanges).toBe(true);
	});
});
