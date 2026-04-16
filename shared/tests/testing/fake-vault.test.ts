import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FakeAppResult } from "../../src/testing/fakes/fake-vault";
import { createFakeApp } from "../../src/testing/fakes/fake-vault";
import { TFile } from "../../src/testing/mocks/obsidian";

describe("FakeVault", () => {
	let app: FakeAppResult;

	beforeEach(() => {
		app = createFakeApp();
	});

	// ─── File Seeding ────────────────────────────────────────────

	describe("seeding", () => {
		it("should seed files from string content", () => {
			app = createFakeApp({
				files: {
					"Events/meeting.md": "---\nTitle: Team Meeting\n---\nNotes",
				},
			});

			const files = app.vault.getFiles();
			expect(files).toHaveLength(1);
			expect(files[0].path).toBe("Events/meeting.md");
		});

		it("should seed files from content+frontmatter objects", () => {
			app = createFakeApp({
				files: {
					"Events/workout.md": {
						content: "# Workout",
						frontmatter: { Title: "Workout", allDay: true },
					},
				},
			});

			const cache = app.metadataCache.getFileCache(app.vault.getFiles()[0]);
			expect(cache?.frontmatter?.Title).toBe("Workout");
			expect(cache?.frontmatter?.allDay).toBe(true);
		});

		it("should parse frontmatter from content when no explicit frontmatter is provided", () => {
			app = createFakeApp({
				files: {
					"note.md": "---\nTitle: Weekly Review\nPriority: 1\n---\nBody",
				},
			});

			const cache = app.metadataCache.getFileCache(app.vault.getFiles()[0]);
			expect(cache?.frontmatter?.Title).toBe("Weekly Review");
			expect(cache?.frontmatter?.Priority).toBe(1);
		});

		it("should create parent folders automatically", () => {
			app = createFakeApp({
				files: { "a/b/c/file.md": "" },
			});

			expect(app.vault.getFolderByPath("a")).not.toBeNull();
			expect(app.vault.getFolderByPath("a/b")).not.toBeNull();
			expect(app.vault.getFolderByPath("a/b/c")).not.toBeNull();
		});
	});

	// ─── Read Operations ─────────────────────────────────────────

	describe("read operations", () => {
		beforeEach(() => {
			app = createFakeApp({
				files: {
					"Events/meeting.md": "---\nTitle: Team Meeting\n---\nNotes here",
					"Events/workout.md": "# Workout log",
					"daily/2026-01-15.md": "Daily note",
				},
			});
		});

		it("should return file by path via getAbstractFileByPath", () => {
			const file = app.vault.getAbstractFileByPath("Events/meeting.md");
			expect(file).not.toBeNull();
			expect(file!.path).toBe("Events/meeting.md");
		});

		it("should return null for non-existent path", () => {
			expect(app.vault.getAbstractFileByPath("nope.md")).toBeNull();
		});

		it("should return folder via getAbstractFileByPath", () => {
			const folder = app.vault.getAbstractFileByPath("Events");
			expect(folder).not.toBeNull();
		});

		it("should return file via getFileByPath", () => {
			const file = app.vault.getFileByPath("Events/meeting.md");
			expect(file).not.toBeNull();
			expect(file!.basename).toBe("meeting");
		});

		it("should return null from getFileByPath for folders", () => {
			expect(app.vault.getFileByPath("Events")).toBeNull();
		});

		it("should list all files", () => {
			expect(app.vault.getFiles()).toHaveLength(3);
		});

		it("should list only markdown files", () => {
			app = createFakeApp({
				files: {
					"note.md": "markdown",
					"image.png": "binary",
				},
			});

			const mdFiles = app.vault.getMarkdownFiles();
			expect(mdFiles).toHaveLength(1);
			expect(mdFiles[0].path).toBe("note.md");
		});

		it("should read file content", async () => {
			const file = app.vault.getFileByPath("Events/meeting.md")!;
			const content = await app.vault.read(file);
			expect(content).toBe("---\nTitle: Team Meeting\n---\nNotes here");
		});

		it("should cachedRead file content", async () => {
			const file = app.vault.getFileByPath("Events/meeting.md")!;
			const content = await app.vault.cachedRead(file);
			expect(content).toBe("---\nTitle: Team Meeting\n---\nNotes here");
		});

		it("should throw when reading non-existent file", async () => {
			const ghost = new TFile("ghost.md");
			await expect(app.vault.read(ghost)).rejects.toThrow("file not found");
		});
	});

	// ─── Write Operations ────────────────────────────────────────

	describe("write operations", () => {
		it("should create a new file and return it", async () => {
			const file = await app.vault.create("new-note.md", "Hello world");

			expect(file.path).toBe("new-note.md");
			expect(file.basename).toBe("new-note");
			expect(await app.vault.read(file)).toBe("Hello world");
		});

		it("should throw when creating a file that already exists", async () => {
			await app.vault.create("exists.md", "");
			await expect(app.vault.create("exists.md", "again")).rejects.toThrow("already exists");
		});

		it("should modify file content and update subsequent reads", async () => {
			const file = await app.vault.create("note.md", "original");

			await app.vault.modify(file, "updated");

			expect(await app.vault.read(file)).toBe("updated");
		});

		it("should update frontmatter cache after modify", async () => {
			const file = await app.vault.create("note.md", "---\nTitle: Old\n---\nBody");

			await app.vault.modify(file, "---\nTitle: New\n---\nBody");

			const cache = app.metadataCache.getFileCache(file);
			expect(cache?.frontmatter?.Title).toBe("New");
		});

		it("should delete a file", async () => {
			const file = await app.vault.create("delete-me.md", "");
			await app.vault.delete(file);

			expect(app.vault.getFileByPath("delete-me.md")).toBeNull();
			expect(app.vault.getFiles()).toHaveLength(0);
		});

		it("should throw when deleting non-existent file", async () => {
			const ghost = new TFile("ghost.md");
			await expect(app.vault.delete(ghost)).rejects.toThrow("file not found");
		});

		it("should rename a file and update path properties", async () => {
			const file = await app.vault.create("old-name.md", "content");

			await app.vault.rename(file, "new-name.md");

			expect(file.path).toBe("new-name.md");
			expect(file.name).toBe("new-name.md");
			expect(file.basename).toBe("new-name");
			expect(app.vault.getFileByPath("old-name.md")).toBeNull();
			expect(app.vault.getFileByPath("new-name.md")).not.toBeNull();
			expect(await app.vault.read(file)).toBe("content");
		});

		it("should create a folder", async () => {
			const folder = await app.vault.createFolder("New Folder");
			expect(folder.path).toBe("New Folder");
			expect(app.vault.getFolderByPath("New Folder")).not.toBeNull();
		});
	});

	// ─── Event Dispatching ───────────────────────────────────────

	describe("vault events", () => {
		it("should fire create event when a file is created", async () => {
			const spy = vi.fn();
			app.vault.on("create", spy);

			const file = await app.vault.create("note.md", "");

			expect(spy).toHaveBeenCalledOnce();
			expect(spy).toHaveBeenCalledWith(file);
		});

		it("should fire modify event when a file is modified", async () => {
			const spy = vi.fn();
			const file = await app.vault.create("note.md", "old");
			app.vault.on("modify", spy);

			await app.vault.modify(file, "new");

			expect(spy).toHaveBeenCalledOnce();
			expect(spy).toHaveBeenCalledWith(file);
		});

		it("should fire delete event when a file is deleted", async () => {
			const spy = vi.fn();
			const file = await app.vault.create("note.md", "");
			app.vault.on("delete", spy);

			await app.vault.delete(file);

			expect(spy).toHaveBeenCalledOnce();
			expect(spy).toHaveBeenCalledWith(file);
		});

		it("should fire rename event with old path", async () => {
			const spy = vi.fn();
			const file = await app.vault.create("old.md", "");
			app.vault.on("rename", spy);

			await app.vault.rename(file, "new.md");

			expect(spy).toHaveBeenCalledOnce();
			expect(spy).toHaveBeenCalledWith(file, "old.md");
		});

		it("should remove listener via offref", async () => {
			const spy = vi.fn();
			const ref = app.vault.on("create", spy);
			app.vault.offref(ref);

			await app.vault.create("note.md", "");

			expect(spy).not.toHaveBeenCalled();
		});
	});

	// ─── MetadataCache ───────────────────────────────────────────

	describe("metadataCache", () => {
		it("should return cache entry for seeded file", () => {
			app = createFakeApp({
				files: {
					"note.md": { content: "", frontmatter: { Title: "Test", Tags: "work" } },
				},
			});

			const file = app.vault.getFiles()[0];
			const cache = app.metadataCache.getFileCache(file);

			expect(cache).not.toBeNull();
			expect(cache?.frontmatter?.Title).toBe("Test");
			expect(cache?.frontmatter?.Tags).toBe("work");
		});

		it("should return null for unknown file", () => {
			const ghost = new TFile("ghost.md");
			expect(app.metadataCache.getFileCache(ghost)).toBeNull();
		});

		it("should fire changed event on vault.modify", async () => {
			const spy = vi.fn();
			const file = await app.vault.create("note.md", "---\nTitle: Old\n---\n");
			app.metadataCache.on("changed", spy);

			await app.vault.modify(file, "---\nTitle: New\n---\n");

			expect(spy).toHaveBeenCalledOnce();
			expect(spy.mock.calls[0][0]).toBe(file);
		});

		it("should fire changed event on vault.create", async () => {
			const spy = vi.fn();
			app.metadataCache.on("changed", spy);

			await app.vault.create("note.md", "---\nTitle: Created\n---\n");

			expect(spy).toHaveBeenCalledOnce();
		});
	});

	// ─── FileManager ─────────────────────────────────────────────

	describe("fileManager.processFrontMatter", () => {
		it("should mutate frontmatter and update file content", async () => {
			app = createFakeApp({
				files: {
					"note.md": "---\nTitle: Old\n---\nBody text",
				},
			});

			const file = app.vault.getFiles()[0];
			await app.fileManager.processFrontMatter(file, (fm) => {
				fm.Title = "Updated";
				fm.NewField = "added";
			});

			const cache = app.metadataCache.getFileCache(file);
			expect(cache?.frontmatter?.Title).toBe("Updated");
			expect(cache?.frontmatter?.NewField).toBe("added");

			const content = await app.vault.read(file);
			expect(content).toContain("Title: Updated");
			expect(content).toContain("NewField: added");
			expect(content).toContain("Body text");
		});

		it("should fire metadataCache changed event", async () => {
			app = createFakeApp({
				files: { "note.md": "---\nTitle: Test\n---\n" },
			});

			const spy = vi.fn();
			app.metadataCache.on("changed", spy);
			const file = app.vault.getFiles()[0];

			await app.fileManager.processFrontMatter(file, (fm) => {
				fm.Title = "Modified";
			});

			expect(spy).toHaveBeenCalledOnce();
		});

		it("should add frontmatter to a file that had none", async () => {
			app = createFakeApp({
				files: { "plain.md": "Just body text" },
			});

			const file = app.vault.getFiles()[0];
			await app.fileManager.processFrontMatter(file, (fm) => {
				fm.Title = "Now has frontmatter";
			});

			const content = await app.vault.read(file);
			expect(content).toContain("Title: Now has frontmatter");
			expect(content).toContain("Just body text");
		});
	});

	// ─── Multi-Step Sequences ────────────────────────────────────

	describe("multi-step sequences", () => {
		it("should support create → modify → read round-trip", async () => {
			const file = await app.vault.create("note.md", "v1");
			await app.vault.modify(file, "v2");
			await app.vault.modify(file, "v3");

			expect(await app.vault.read(file)).toBe("v3");
		});

		it("should support create → rename → read", async () => {
			const file = await app.vault.create("original.md", "content");
			await app.vault.rename(file, "renamed.md");

			expect(await app.vault.read(file)).toBe("content");
			expect(app.vault.getFileByPath("original.md")).toBeNull();
			expect(app.vault.getFileByPath("renamed.md")).not.toBeNull();
		});

		it("should support create → processFrontMatter → read back with updated content", async () => {
			const file = await app.vault.create("note.md", "---\nStatus: draft\n---\nBody");

			await app.fileManager.processFrontMatter(file, (fm) => {
				fm.Status = "published";
			});

			const content = await app.vault.read(file);
			expect(content).toContain("Status: published");
			expect(content).toContain("Body");
		});

		it("should track files correctly after multiple creates and deletes", async () => {
			const a = await app.vault.create("a.md", "");
			const b = await app.vault.create("b.md", "");
			await app.vault.create("c.md", "");

			expect(app.vault.getFiles()).toHaveLength(3);

			await app.vault.delete(b);
			expect(app.vault.getFiles()).toHaveLength(2);

			await app.vault.delete(a);
			expect(app.vault.getFiles()).toHaveLength(1);
			expect(app.vault.getFiles()[0].path).toBe("c.md");
		});
	});

	// ─── Workspace ───────────────────────────────────────────────

	describe("workspace", () => {
		it("should call onLayoutReady callback immediately", () => {
			const spy = vi.fn();
			app.workspace.onLayoutReady(spy);
			expect(spy).toHaveBeenCalledOnce();
		});

		it("should support event subscription", () => {
			const spy = vi.fn();
			app.workspace.on("file-open", spy);
			app.workspace.trigger("file-open", { path: "note.md" });
			expect(spy).toHaveBeenCalledOnce();
		});
	});
});
