import { describe, expect, it } from "vitest";

import type { FrontmatterDiff } from "../../src/core/frontmatter/frontmatter-diff";
import { applyFrontmatterChanges } from "../../src/core/frontmatter/frontmatter-propagation";
import { createFakeApp } from "../../src/testing/fakes/fake-vault";

/**
 * Integration-style tests: exercise `applyFrontmatterChanges` against a FakeApp
 * so every step of the flow runs against realistic vault semantics —
 * `getAbstractFileByPath` → `fileManager.processFrontMatter` → round-trip through
 * the in-memory content map, verified via `vault.read` and `metadataCache.getFileCache`.
 */
describe("applyFrontmatterChanges + FakeApp integration", () => {
	const emptyDiff: FrontmatterDiff = {
		added: [],
		modified: [],
		deleted: [],
		hasChanges: false,
	};

	function diffWith(overrides: Partial<FrontmatterDiff>): FrontmatterDiff {
		const merged = { ...emptyDiff, ...overrides } as FrontmatterDiff;
		merged.hasChanges = merged.added.length + merged.modified.length + merged.deleted.length > 0;
		return merged;
	}

	it("writes added keys through to file content and cache", async () => {
		const app = createFakeApp({
			files: {
				"Events/b.md": "---\nTitle: Existing\n---\nBody",
			},
		});

		await applyFrontmatterChanges(
			app as never,
			"Events/b.md",
			{ Category: "Work", Priority: 1 },
			diffWith({
				added: [
					{ key: "Category", previousValue: undefined, newValue: "Work" },
					{ key: "Priority", previousValue: undefined, newValue: 1 },
				],
			})
		);

		const file = app.vault.getFileByPath("Events/b.md")!;
		const content = await app.vault.read(file);
		expect(content).toContain("Category: Work");
		expect(content).toContain("Priority: 1");

		const cache = app.metadataCache.getFileCache(file);
		expect(cache?.frontmatter?.Category).toBe("Work");
		expect(cache?.frontmatter?.Priority).toBe(1);
		// Pre-existing field stays intact.
		expect(cache?.frontmatter?.Title).toBe("Existing");
	});

	it("overwrites modified keys with source values", async () => {
		const app = createFakeApp({
			files: {
				"Events/b.md": "---\nTitle: Old\nPriority: 1\n---\nBody",
			},
		});

		await applyFrontmatterChanges(
			app as never,
			"Events/b.md",
			{ Title: "New", Priority: 5 },
			diffWith({
				modified: [
					{ key: "Title", previousValue: "Old", newValue: "New" },
					{ key: "Priority", previousValue: 1, newValue: 5 },
				],
			})
		);

		const file = app.vault.getFileByPath("Events/b.md")!;
		const cache = app.metadataCache.getFileCache(file);
		expect(cache?.frontmatter?.Title).toBe("New");
		expect(cache?.frontmatter?.Priority).toBe(5);
	});

	it("removes deleted keys from the final frontmatter", async () => {
		const app = createFakeApp({
			files: {
				"Events/b.md": "---\nTitle: Keep\nStaleProp: remove-me\n---\nBody",
			},
		});

		await applyFrontmatterChanges(
			app as never,
			"Events/b.md",
			{ Title: "Keep" },
			diffWith({
				deleted: [{ key: "StaleProp", previousValue: "remove-me", newValue: undefined }],
			})
		);

		const file = app.vault.getFileByPath("Events/b.md")!;
		const content = await app.vault.read(file);
		expect(content).not.toContain("StaleProp");
		const cache = app.metadataCache.getFileCache(file);
		expect(cache?.frontmatter?.Title).toBe("Keep");
		expect(cache?.frontmatter?.StaleProp).toBeUndefined();
	});

	it("mixes add/modify/delete in a single pass", async () => {
		const app = createFakeApp({
			files: {
				"Events/b.md": "---\nTitle: Old\nOld: gone\n---\nBody",
			},
		});

		await applyFrontmatterChanges(
			app as never,
			"Events/b.md",
			{ Title: "New", Added: "hello" },
			diffWith({
				added: [{ key: "Added", previousValue: undefined, newValue: "hello" }],
				modified: [{ key: "Title", previousValue: "Old", newValue: "New" }],
				deleted: [{ key: "Old", previousValue: "gone", newValue: undefined }],
			})
		);

		const file = app.vault.getFileByPath("Events/b.md")!;
		const cache = app.metadataCache.getFileCache(file);
		expect(cache?.frontmatter?.Title).toBe("New");
		expect(cache?.frontmatter?.Added).toBe("hello");
		expect(cache?.frontmatter?.Old).toBeUndefined();
	});

	it("is a no-op when target file is missing (does not throw)", async () => {
		const app = createFakeApp();

		await expect(
			applyFrontmatterChanges(
				app as never,
				"Events/missing.md",
				{ Category: "X" },
				diffWith({
					added: [{ key: "Category", previousValue: undefined, newValue: "X" }],
				})
			)
		).resolves.toBeUndefined();
	});

	it("preserves body content across propagation", async () => {
		const app = createFakeApp({
			files: {
				"Events/b.md": "---\nTitle: T\n---\nLine one\nLine two\n",
			},
		});

		await applyFrontmatterChanges(
			app as never,
			"Events/b.md",
			{ Title: "T", Extra: "x" },
			diffWith({ added: [{ key: "Extra", previousValue: undefined, newValue: "x" }] })
		);

		const file = app.vault.getFileByPath("Events/b.md")!;
		const content = await app.vault.read(file);
		expect(content).toContain("Line one");
		expect(content).toContain("Line two");
	});

	it("fires a metadataCache changed event after propagation", async () => {
		const app = createFakeApp({
			files: { "Events/b.md": "---\nTitle: T\n---\n" },
		});

		const changes: unknown[] = [];
		app.metadataCache.on("changed", (...args) => changes.push(args));

		await applyFrontmatterChanges(
			app as never,
			"Events/b.md",
			{ Title: "T", Extra: "yes" },
			diffWith({ added: [{ key: "Extra", previousValue: undefined, newValue: "yes" }] })
		);

		expect(changes.length).toBeGreaterThan(0);
	});
});
