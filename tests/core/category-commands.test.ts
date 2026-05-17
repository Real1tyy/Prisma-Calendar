import { describe, expect, it } from "vitest";

import { deleteCategoryCommand, renameCategoryCommand } from "../../src/core/commands/category-commands";
import type { EventFileRepository, FrontmatterSnapshot } from "../../src/core/event-file-repository";
import type { Frontmatter } from "../../src/types";

// Minimal in-memory stub of `EventFileRepository` that exposes only the trio
// of methods `FrontmatterUpdateCommand` actually needs. The full repo wires
// up VaultTable + indexer cache; for these tests we only care that the
// snapshot/restore round-trip preserves frontmatter exactly.
function makeRepoStub(initial: Record<string, Frontmatter>) {
	const store = new Map<string, Frontmatter>(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));

	const repo = {
		async updateFrontmatterByPath(filePath: string, updater: (fm: Frontmatter) => void): Promise<Frontmatter> {
			const current = store.get(filePath);
			if (!current) throw new Error(`not found: ${filePath}`);
			const next = structuredClone(current);
			updater(next);
			store.set(filePath, next);
			return next;
		},
		async snapshotByPath(filePath: string): Promise<FrontmatterSnapshot> {
			const current = store.get(filePath);
			if (!current) throw new Error(`not found: ${filePath}`);
			return {
				key: filePath,
				data: structuredClone(current),
				content: JSON.stringify(current),
				filePath,
				file: { path: filePath } as FrontmatterSnapshot["file"],
			};
		},
		async restoreSnapshot(snapshot: FrontmatterSnapshot): Promise<void> {
			store.set(snapshot.filePath, structuredClone(snapshot.data));
		},
		read(filePath: string): Frontmatter | undefined {
			return store.get(filePath);
		},
	};

	return repo as unknown as EventFileRepository & { read(filePath: string): Frontmatter | undefined };
}

describe("renameCategoryCommand", () => {
	it("rewrites the matched category and leaves siblings untouched", async () => {
		const repo = makeRepoStub({ "Events/A.md": { Category: ["Work", "Personal"] } });
		const cmd = renameCategoryCommand(repo, "Events/A.md", "Work", "Office", "Category");

		await cmd.execute();

		expect(repo.read("Events/A.md")).toEqual({ Category: ["Office", "Personal"] });
	});

	it("preserves scalar string values when renaming", async () => {
		const repo = makeRepoStub({ "Events/A.md": { Category: "Work" } });
		const cmd = renameCategoryCommand(repo, "Events/A.md", "Work", "Office", "Category");

		await cmd.execute();

		expect(repo.read("Events/A.md")).toEqual({ Category: "Office" });
	});

	it("restores the original frontmatter on undo", async () => {
		const repo = makeRepoStub({ "Events/A.md": { Category: ["Work", "Personal"], Title: "Standup" } });
		const cmd = renameCategoryCommand(repo, "Events/A.md", "Work", "Office", "Category");

		await cmd.execute();
		await cmd.undo();

		expect(repo.read("Events/A.md")).toEqual({ Category: ["Work", "Personal"], Title: "Standup" });
	});

	it("re-applies the rename on redo (second execute)", async () => {
		const repo = makeRepoStub({ "Events/A.md": { Category: ["Work"] } });
		const cmd = renameCategoryCommand(repo, "Events/A.md", "Work", "Office", "Category");

		await cmd.execute();
		await cmd.undo();
		await cmd.execute();

		expect(repo.read("Events/A.md")).toEqual({ Category: ["Office"] });
	});

	it("is a no-op when the file lacks the category prop", async () => {
		const repo = makeRepoStub({ "Events/A.md": { Title: "No category" } });
		const cmd = renameCategoryCommand(repo, "Events/A.md", "Work", "Office", "Category");

		await cmd.execute();

		expect(repo.read("Events/A.md")).toEqual({ Title: "No category" });
	});
});

describe("deleteCategoryCommand", () => {
	it("removes the category from a multi-value list and keeps the rest", async () => {
		const repo = makeRepoStub({ "Events/A.md": { Category: ["Work", "Personal"] } });
		const cmd = deleteCategoryCommand(repo, "Events/A.md", "Work", "Category");

		await cmd.execute();

		expect(repo.read("Events/A.md")).toEqual({ Category: ["Personal"] });
	});

	it("deletes the property entirely when the category is the only value", async () => {
		const repo = makeRepoStub({ "Events/A.md": { Category: ["Work"], Title: "Meeting" } });
		const cmd = deleteCategoryCommand(repo, "Events/A.md", "Work", "Category");

		await cmd.execute();

		expect(repo.read("Events/A.md")).toEqual({ Title: "Meeting" });
	});

	it("deletes the property when the value was a scalar matching the category", async () => {
		const repo = makeRepoStub({ "Events/A.md": { Category: "Work" } });
		const cmd = deleteCategoryCommand(repo, "Events/A.md", "Work", "Category");

		await cmd.execute();

		expect(repo.read("Events/A.md")).toEqual({});
	});

	it("restores the original frontmatter on undo, including a deleted property", async () => {
		const repo = makeRepoStub({ "Events/A.md": { Category: ["Work"], Title: "Meeting" } });
		const cmd = deleteCategoryCommand(repo, "Events/A.md", "Work", "Category");

		await cmd.execute();
		await cmd.undo();

		expect(repo.read("Events/A.md")).toEqual({ Category: ["Work"], Title: "Meeting" });
	});

	it("re-applies the delete on redo (second execute)", async () => {
		const repo = makeRepoStub({ "Events/A.md": { Category: ["Work"] } });
		const cmd = deleteCategoryCommand(repo, "Events/A.md", "Work", "Category");

		await cmd.execute();
		await cmd.undo();
		await cmd.execute();

		expect(repo.read("Events/A.md")).toEqual({});
	});
});
