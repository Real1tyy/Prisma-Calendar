import type { App } from "obsidian";
import type { TFile } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	bulkDeleteCategoryFromFiles,
	bulkRenameCategoryInFiles,
	deleteCategoryFromFile,
	removeCategoryFromProperty,
	renameCategoryInFile,
	renameCategoryInProperty,
} from "../../src/core/frontmatter/category-operations";
import { createMockApp, createMockFile } from "../../src/testing/mocks/obsidian";

describe("removeCategoryFromProperty", () => {
	it("should remove category from array", () => {
		const input = ["work", "personal", "health"];
		const result = removeCategoryFromProperty(input, "personal");
		expect(result).toEqual(["work", "health"]);
	});

	it("should return empty array when removing last category", () => {
		const input = ["work"];
		const result = removeCategoryFromProperty(input, "work");
		expect(result).toEqual([]);
	});

	it("should remove category from comma-separated string", () => {
		const input = "work, personal, health";
		const result = removeCategoryFromProperty(input, "personal");
		expect(result).toBe("work, health");
	});

	it("should return undefined when removing last category from string", () => {
		const input = "work";
		const result = removeCategoryFromProperty(input, "work");
		expect(result).toBeUndefined();
	});

	it("should handle extra spaces in comma-separated string", () => {
		const input = "work,  personal  ,health";
		const result = removeCategoryFromProperty(input, "personal");
		expect(result).toBe("work, health");
	});

	it("should return input unchanged for non-array/non-string", () => {
		const input = 123;
		const result = removeCategoryFromProperty(input, "personal");
		expect(result).toBe(123);
	});

	it("should not remove category if not found", () => {
		const input = ["work", "health"];
		const result = removeCategoryFromProperty(input, "personal");
		expect(result).toEqual(["work", "health"]);
	});
});

describe("renameCategoryInProperty", () => {
	it("should rename category in array", () => {
		const input = ["work", "personal", "health"];
		const result = renameCategoryInProperty(input, "personal", "life");
		expect(result).toEqual(["work", "life", "health"]);
	});

	it("should rename multiple occurrences in array", () => {
		const input = ["work", "personal", "personal"];
		const result = renameCategoryInProperty(input, "personal", "life");
		expect(result).toEqual(["work", "life", "life"]);
	});

	it("should rename category in comma-separated string", () => {
		const input = "work, personal, health";
		const result = renameCategoryInProperty(input, "personal", "life");
		expect(result).toBe("work, life, health");
	});

	it("should handle extra spaces in comma-separated string", () => {
		const input = "work,  personal  ,health";
		const result = renameCategoryInProperty(input, "personal", "life");
		expect(result).toBe("work, life, health");
	});

	it("should return input unchanged for non-array/non-string", () => {
		const input = 123;
		const result = renameCategoryInProperty(input, "personal", "life");
		expect(result).toBe(123);
	});

	it("should not change other categories", () => {
		const input = ["work", "health"];
		const result = renameCategoryInProperty(input, "personal", "life");
		expect(result).toEqual(["work", "health"]);
	});
});

describe("deleteCategoryFromFile", () => {
	let mockApp: App;
	let mockFile: TFile;
	let mockProcessFrontMatter: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockProcessFrontMatter = vi.fn(async (file: TFile, updater: (fm: Record<string, unknown>) => void) => {
			const fm: Record<string, unknown> = {};
			updater(fm);
			return Promise.resolve();
		});

		mockApp = createMockApp() as unknown as App;
		mockApp.fileManager.processFrontMatter = mockProcessFrontMatter;

		mockFile = createMockFile("test.md");
	});

	it("should delete category from array property", async () => {
		mockProcessFrontMatter.mockImplementation(async (file: TFile, updater: (fm: Record<string, unknown>) => void) => {
			const fm: Record<string, unknown> = { categories: ["work", "personal", "health"] };
			updater(fm);
			expect(fm.categories).toEqual(["work", "health"]);
		});

		await deleteCategoryFromFile(mockApp, mockFile, "personal", "categories");
		expect(mockProcessFrontMatter).toHaveBeenCalledWith(mockFile, expect.any(Function));
	});

	it("should delete property when last category is removed", async () => {
		mockProcessFrontMatter.mockImplementation(async (file: TFile, updater: (fm: Record<string, unknown>) => void) => {
			const fm: Record<string, unknown> = { categories: ["work"] };
			updater(fm);
			expect(fm.categories).toBeUndefined();
		});

		await deleteCategoryFromFile(mockApp, mockFile, "work", "categories");
	});

	it("should handle string property", async () => {
		mockProcessFrontMatter.mockImplementation(async (file: TFile, updater: (fm: Record<string, unknown>) => void) => {
			const fm: Record<string, unknown> = { categories: "work, personal, health" };
			updater(fm);
			expect(fm.categories).toBe("work, health");
		});

		await deleteCategoryFromFile(mockApp, mockFile, "personal", "categories");
	});

	it("should not modify if property doesn't exist", async () => {
		mockProcessFrontMatter.mockImplementation(async (file: TFile, updater: (fm: Record<string, unknown>) => void) => {
			const fm: Record<string, unknown> = {};
			updater(fm);
			expect(fm.categories).toBeUndefined();
		});

		await deleteCategoryFromFile(mockApp, mockFile, "personal", "categories");
	});
});

describe("renameCategoryInFile", () => {
	let mockApp: App;
	let mockFile: TFile;
	let mockProcessFrontMatter: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockProcessFrontMatter = vi.fn(async (file: TFile, updater: (fm: Record<string, unknown>) => void) => {
			const fm: Record<string, unknown> = {};
			updater(fm);
			return Promise.resolve();
		});

		mockApp = createMockApp() as unknown as App;
		mockApp.fileManager.processFrontMatter = mockProcessFrontMatter;

		mockFile = createMockFile("test.md");
	});

	it("should rename category in array property", async () => {
		mockProcessFrontMatter.mockImplementation(async (file: TFile, updater: (fm: Record<string, unknown>) => void) => {
			const fm: Record<string, unknown> = { categories: ["work", "personal", "health"] };
			updater(fm);
			expect(fm.categories).toEqual(["work", "life", "health"]);
		});

		await renameCategoryInFile(mockApp, mockFile, "personal", "life", "categories");
		expect(mockProcessFrontMatter).toHaveBeenCalledWith(mockFile, expect.any(Function));
	});

	it("should rename category in string property", async () => {
		mockProcessFrontMatter.mockImplementation(async (file: TFile, updater: (fm: Record<string, unknown>) => void) => {
			const fm: Record<string, unknown> = { categories: "work, personal, health" };
			updater(fm);
			expect(fm.categories).toBe("work, life, health");
		});

		await renameCategoryInFile(mockApp, mockFile, "personal", "life", "categories");
	});

	it("should not modify if property doesn't exist", async () => {
		mockProcessFrontMatter.mockImplementation(async (file: TFile, updater: (fm: Record<string, unknown>) => void) => {
			const fm: Record<string, unknown> = {};
			updater(fm);
			expect(fm.categories).toBeUndefined();
		});

		await renameCategoryInFile(mockApp, mockFile, "personal", "life", "categories");
	});
});

describe("bulkDeleteCategoryFromFiles", () => {
	let mockApp: App;
	let mockFiles: TFile[];
	let mockProcessFrontMatter: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockProcessFrontMatter = vi.fn(async (file: TFile, updater: (fm: Record<string, unknown>) => void) => {
			const fm: Record<string, unknown> = { categories: ["work", "personal", "health"] };
			updater(fm);
			return Promise.resolve();
		});

		mockApp = createMockApp() as unknown as App;
		mockApp.fileManager.processFrontMatter = mockProcessFrontMatter;

		mockFiles = [
			{ path: "test1.md", name: "test1.md" } as TFile,
			{ path: "test2.md", name: "test2.md" } as TFile,
			{ path: "test3.md", name: "test3.md" } as TFile,
		];
	});

	it("should delete category from all files", async () => {
		const result = await bulkDeleteCategoryFromFiles(mockApp, mockFiles, "personal", "categories");

		expect(result.filesModified).toHaveLength(3);
		expect(result.filesWithErrors).toHaveLength(0);
		expect(mockProcessFrontMatter).toHaveBeenCalledTimes(3);
	});

	it("should call onProgress callback", async () => {
		const onProgress = vi.fn();

		await bulkDeleteCategoryFromFiles(mockApp, mockFiles, "personal", "categories", { onProgress });

		expect(onProgress).toHaveBeenCalledTimes(3);
		expect(onProgress).toHaveBeenCalledWith(1, 3);
		expect(onProgress).toHaveBeenCalledWith(2, 3);
		expect(onProgress).toHaveBeenCalledWith(3, 3);
	});

	it("should call onComplete callback", async () => {
		const onComplete = vi.fn();

		await bulkDeleteCategoryFromFiles(mockApp, mockFiles, "personal", "categories", { onComplete });

		expect(onComplete).toHaveBeenCalledTimes(1);
	});

	it("should handle errors gracefully", async () => {
		mockProcessFrontMatter.mockImplementation(async (file: TFile) => {
			if (file.path === "test2.md") {
				throw new Error("Test error");
			}
			return Promise.resolve();
		});

		const result = await bulkDeleteCategoryFromFiles(mockApp, mockFiles, "personal", "categories");

		expect(result.filesModified).toHaveLength(2);
		expect(result.filesWithErrors).toHaveLength(1);
		expect(result.filesWithErrors[0]).toEqual({
			filePath: "test2.md",
			error: "Test error",
		});
	});

	it("should continue processing after error", async () => {
		const onProgress = vi.fn();
		mockProcessFrontMatter.mockImplementation(async (file: TFile) => {
			if (file.path === "test2.md") {
				throw new Error("Test error");
			}
			return Promise.resolve();
		});

		await bulkDeleteCategoryFromFiles(mockApp, mockFiles, "personal", "categories", { onProgress });

		expect(onProgress).toHaveBeenCalledTimes(3);
		expect(onProgress).toHaveBeenLastCalledWith(3, 3);
	});
});

describe("bulkRenameCategoryInFiles", () => {
	let mockApp: App;
	let mockFiles: TFile[];
	let mockProcessFrontMatter: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockProcessFrontMatter = vi.fn(async (file: TFile, updater: (fm: Record<string, unknown>) => void) => {
			const fm: Record<string, unknown> = { categories: ["work", "personal", "health"] };
			updater(fm);
			return Promise.resolve();
		});

		mockApp = createMockApp() as unknown as App;
		mockApp.fileManager.processFrontMatter = mockProcessFrontMatter;

		mockFiles = [{ path: "test1.md", name: "test1.md" } as TFile, { path: "test2.md", name: "test2.md" } as TFile];
	});

	it("should rename category in all files", async () => {
		const result = await bulkRenameCategoryInFiles(mockApp, mockFiles, "personal", "life", "categories");

		expect(result.filesModified).toHaveLength(2);
		expect(result.filesWithErrors).toHaveLength(0);
		expect(mockProcessFrontMatter).toHaveBeenCalledTimes(2);
	});

	it("should call onProgress and onComplete callbacks", async () => {
		const onProgress = vi.fn();
		const onComplete = vi.fn();

		await bulkRenameCategoryInFiles(mockApp, mockFiles, "personal", "life", "categories", {
			onProgress,
			onComplete,
		});

		expect(onProgress).toHaveBeenCalledTimes(2);
		expect(onComplete).toHaveBeenCalledTimes(1);
	});

	it("should handle errors gracefully", async () => {
		mockProcessFrontMatter.mockImplementation(async (file: TFile) => {
			if (file.path === "test1.md") {
				throw new Error("Test error");
			}
			return Promise.resolve();
		});

		const result = await bulkRenameCategoryInFiles(mockApp, mockFiles, "personal", "life", "categories");

		expect(result.filesModified).toHaveLength(1);
		expect(result.filesWithErrors).toHaveLength(1);
		expect(result.filesWithErrors[0]).toEqual({
			filePath: "test1.md",
			error: "Test error",
		});
	});
});
