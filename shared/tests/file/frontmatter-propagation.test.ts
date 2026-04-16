import type { App } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Frontmatter, FrontmatterDiff } from "../../src/core/frontmatter/frontmatter-diff";
import { applyFrontmatterChanges } from "../../src/core/frontmatter/frontmatter-propagation";
import { createMockApp, TFile } from "../../src/testing/mocks/obsidian";

describe("applyFrontmatterChanges", () => {
	let mockApp: App;
	let mockFile: TFile;
	let processFrontMatterMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		processFrontMatterMock = vi.fn();

		mockFile = new TFile("test-file.md");

		mockApp = createMockApp({
			vault: {
				getAbstractFileByPath: vi.fn().mockReturnValue(mockFile),
			},
			fileManager: {
				processFrontMatter: processFrontMatterMock,
			},
		}) as unknown as App;
	});

	it("should apply added properties from diff", async () => {
		const sourceFrontmatter: Frontmatter = {
			title: "Test",
			category: "work",
			priority: 1,
		};

		const diff: FrontmatterDiff = {
			hasChanges: true,
			changes: [
				{
					key: "category",
					oldValue: undefined,
					newValue: "work",
					changeType: "added",
				},
				{
					key: "priority",
					oldValue: undefined,
					newValue: 1,
					changeType: "added",
				},
			],
			added: [
				{
					key: "category",
					oldValue: undefined,
					newValue: "work",
					changeType: "added",
				},
				{
					key: "priority",
					oldValue: undefined,
					newValue: 1,
					changeType: "added",
				},
			],
			modified: [],
			deleted: [],
		};

		await applyFrontmatterChanges(mockApp, "test-file.md", sourceFrontmatter, diff);

		expect(processFrontMatterMock).toHaveBeenCalledTimes(1);
		expect(processFrontMatterMock).toHaveBeenCalledWith(mockFile, expect.any(Function));

		const updateFn = processFrontMatterMock.mock.calls[0][1];
		const mockFm = { title: "Test" };
		updateFn(mockFm);

		expect(mockFm).toEqual({
			title: "Test",
			category: "work",
			priority: 1,
		});
	});

	it("should apply modified properties from diff", async () => {
		const sourceFrontmatter: Frontmatter = {
			title: "Updated Title",
			category: "personal",
			priority: 2,
		};

		const diff: FrontmatterDiff = {
			hasChanges: true,
			changes: [
				{
					key: "title",
					oldValue: "Old Title",
					newValue: "Updated Title",
					changeType: "modified",
				},
				{
					key: "category",
					oldValue: "work",
					newValue: "personal",
					changeType: "modified",
				},
			],
			added: [],
			modified: [
				{
					key: "title",
					oldValue: "Old Title",
					newValue: "Updated Title",
					changeType: "modified",
				},
				{
					key: "category",
					oldValue: "work",
					newValue: "personal",
					changeType: "modified",
				},
			],
			deleted: [],
		};

		await applyFrontmatterChanges(mockApp, "test-file.md", sourceFrontmatter, diff);

		expect(processFrontMatterMock).toHaveBeenCalledTimes(1);

		const updateFn = processFrontMatterMock.mock.calls[0][1];
		const mockFm = {
			title: "Old Title",
			category: "work",
			priority: 2,
		};
		updateFn(mockFm);

		expect(mockFm.title).toBe("Updated Title");
		expect(mockFm.category).toBe("personal");
		expect(mockFm.priority).toBe(2);
	});

	it("should delete properties from diff", async () => {
		const sourceFrontmatter: Frontmatter = {
			title: "Test",
		};

		const diff: FrontmatterDiff = {
			hasChanges: true,
			changes: [
				{
					key: "category",
					oldValue: "work",
					newValue: undefined,
					changeType: "deleted",
				},
				{
					key: "priority",
					oldValue: 1,
					newValue: undefined,
					changeType: "deleted",
				},
			],
			added: [],
			modified: [],
			deleted: [
				{
					key: "category",
					oldValue: "work",
					newValue: undefined,
					changeType: "deleted",
				},
				{
					key: "priority",
					oldValue: 1,
					newValue: undefined,
					changeType: "deleted",
				},
			],
		};

		await applyFrontmatterChanges(mockApp, "test-file.md", sourceFrontmatter, diff);

		expect(processFrontMatterMock).toHaveBeenCalledTimes(1);

		const updateFn = processFrontMatterMock.mock.calls[0][1];
		const mockFm = {
			title: "Test",
			category: "work",
			priority: 1,
		};
		updateFn(mockFm);

		expect(mockFm).toEqual({ title: "Test" });
		expect(mockFm).not.toHaveProperty("category");
		expect(mockFm).not.toHaveProperty("priority");
	});

	it("should apply mixed changes (added, modified, deleted)", async () => {
		const sourceFrontmatter: Frontmatter = {
			title: "Updated",
			newProp: "added",
		};

		const diff: FrontmatterDiff = {
			hasChanges: true,
			changes: [
				{
					key: "newProp",
					oldValue: undefined,
					newValue: "added",
					changeType: "added",
				},
				{
					key: "title",
					oldValue: "Old",
					newValue: "Updated",
					changeType: "modified",
				},
				{
					key: "oldProp",
					oldValue: "remove",
					newValue: undefined,
					changeType: "deleted",
				},
			],
			added: [
				{
					key: "newProp",
					oldValue: undefined,
					newValue: "added",
					changeType: "added",
				},
			],
			modified: [
				{
					key: "title",
					oldValue: "Old",
					newValue: "Updated",
					changeType: "modified",
				},
			],
			deleted: [
				{
					key: "oldProp",
					oldValue: "remove",
					newValue: undefined,
					changeType: "deleted",
				},
			],
		};

		await applyFrontmatterChanges(mockApp, "test-file.md", sourceFrontmatter, diff);

		expect(processFrontMatterMock).toHaveBeenCalledTimes(1);

		const updateFn = processFrontMatterMock.mock.calls[0][1];
		const mockFm = {
			title: "Old",
			oldProp: "remove",
		};
		updateFn(mockFm);

		expect(mockFm).toEqual({
			title: "Updated",
			newProp: "added",
		});
	});

	it("should handle file not found gracefully", async () => {
		const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		mockApp.vault.getAbstractFileByPath = vi.fn().mockReturnValue(null);

		const sourceFrontmatter: Frontmatter = { title: "Test" };
		const diff: FrontmatterDiff = {
			hasChanges: false,
			changes: [],
			added: [],
			modified: [],
			deleted: [],
		};

		await applyFrontmatterChanges(mockApp, "nonexistent.md", sourceFrontmatter, diff);

		expect(consoleWarnSpy).toHaveBeenCalledWith("Target file not found: nonexistent.md");
		expect(processFrontMatterMock).not.toHaveBeenCalled();

		consoleWarnSpy.mockRestore();
	});

	it("should handle non-TFile abstract file gracefully", async () => {
		const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		const mockFolder = {
			path: "folder",
			name: "folder",
		};

		mockApp.vault.getAbstractFileByPath = vi.fn().mockReturnValue(mockFolder);

		const sourceFrontmatter: Frontmatter = { title: "Test" };
		const diff: FrontmatterDiff = {
			hasChanges: false,
			changes: [],
			added: [],
			modified: [],
			deleted: [],
		};

		await applyFrontmatterChanges(mockApp, "folder", sourceFrontmatter, diff);

		expect(consoleWarnSpy).toHaveBeenCalledWith("Target file not found: folder");
		expect(processFrontMatterMock).not.toHaveBeenCalled();

		consoleWarnSpy.mockRestore();
	});

	it("should handle processFrontMatter errors gracefully", async () => {
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const error = new Error("processFrontMatter failed");
		processFrontMatterMock.mockRejectedValue(error);

		const sourceFrontmatter: Frontmatter = { title: "Test" };
		const diff: FrontmatterDiff = {
			hasChanges: true,
			changes: [
				{
					key: "title",
					oldValue: "Old",
					newValue: "Test",
					changeType: "modified",
				},
			],
			added: [],
			modified: [
				{
					key: "title",
					oldValue: "Old",
					newValue: "Test",
					changeType: "modified",
				},
			],
			deleted: [],
		};

		await applyFrontmatterChanges(mockApp, "test-file.md", sourceFrontmatter, diff);

		expect(consoleErrorSpy).toHaveBeenCalledWith("Error applying frontmatter changes to test-file.md:", error);

		consoleErrorSpy.mockRestore();
	});

	it("should handle empty diff gracefully", async () => {
		const sourceFrontmatter: Frontmatter = { title: "Test" };
		const diff: FrontmatterDiff = {
			hasChanges: false,
			changes: [],
			added: [],
			modified: [],
			deleted: [],
		};

		await applyFrontmatterChanges(mockApp, "test-file.md", sourceFrontmatter, diff);

		expect(processFrontMatterMock).toHaveBeenCalledTimes(1);

		const updateFn = processFrontMatterMock.mock.calls[0][1];
		const mockFm = { title: "Test" };
		updateFn(mockFm);

		expect(mockFm).toEqual({ title: "Test" });
	});

	it("should handle array values in frontmatter", async () => {
		const sourceFrontmatter: Frontmatter = {
			tags: ["work", "important"],
		};

		const diff: FrontmatterDiff = {
			hasChanges: true,
			changes: [
				{
					key: "tags",
					oldValue: ["old"],
					newValue: ["work", "important"],
					changeType: "modified",
				},
			],
			added: [],
			modified: [
				{
					key: "tags",
					oldValue: ["old"],
					newValue: ["work", "important"],
					changeType: "modified",
				},
			],
			deleted: [],
		};

		await applyFrontmatterChanges(mockApp, "test-file.md", sourceFrontmatter, diff);

		expect(processFrontMatterMock).toHaveBeenCalledTimes(1);

		const updateFn = processFrontMatterMock.mock.calls[0][1];
		const mockFm = { tags: ["old"] };
		updateFn(mockFm);

		expect(mockFm.tags).toEqual(["work", "important"]);
	});

	it("should handle nested object values in frontmatter", async () => {
		const sourceFrontmatter: Frontmatter = {
			metadata: { author: "Jane", version: 2 },
		};

		const diff: FrontmatterDiff = {
			hasChanges: true,
			changes: [
				{
					key: "metadata",
					oldValue: { author: "John", version: 1 },
					newValue: { author: "Jane", version: 2 },
					changeType: "modified",
				},
			],
			added: [],
			modified: [
				{
					key: "metadata",
					oldValue: { author: "John", version: 1 },
					newValue: { author: "Jane", version: 2 },
					changeType: "modified",
				},
			],
			deleted: [],
		};

		await applyFrontmatterChanges(mockApp, "test-file.md", sourceFrontmatter, diff);

		expect(processFrontMatterMock).toHaveBeenCalledTimes(1);

		const updateFn = processFrontMatterMock.mock.calls[0][1];
		const mockFm = { metadata: { author: "John", version: 1 } };
		updateFn(mockFm);

		expect(mockFm.metadata).toEqual({ author: "Jane", version: 2 });
	});

	it("should preserve properties not in diff", async () => {
		const sourceFrontmatter: Frontmatter = {
			title: "Updated",
			category: "work",
		};

		const diff: FrontmatterDiff = {
			hasChanges: true,
			changes: [
				{
					key: "title",
					oldValue: "Old",
					newValue: "Updated",
					changeType: "modified",
				},
			],
			added: [],
			modified: [
				{
					key: "title",
					oldValue: "Old",
					newValue: "Updated",
					changeType: "modified",
				},
			],
			deleted: [],
		};

		await applyFrontmatterChanges(mockApp, "test-file.md", sourceFrontmatter, diff);

		expect(processFrontMatterMock).toHaveBeenCalledTimes(1);

		const updateFn = processFrontMatterMock.mock.calls[0][1];
		const mockFm = {
			title: "Old",
			preservedProp: "should remain",
			anotherProp: 123,
		};
		updateFn(mockFm);

		expect(mockFm).toEqual({
			title: "Updated",
			preservedProp: "should remain",
			anotherProp: 123,
		});
	});
});
