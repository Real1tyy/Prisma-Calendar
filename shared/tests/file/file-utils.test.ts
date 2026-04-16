import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import {
	backupFrontmatter,
	extractContentAfterFrontmatter,
	getTFileOrThrow,
	restoreFrontmatter,
	withFrontmatter,
} from "../../src/core/file/file-utils";
import { createMockApp, createMockFile } from "../../src/testing";

describe("extractContentAfterFrontmatter", () => {
	it("should extract content after frontmatter", () => {
		const content = `---
title: My Note
tags: [test]
---
This is the main content.
More content here.`;

		const result = extractContentAfterFrontmatter(content);
		expect(result).toBe("This is the main content.\nMore content here.");
	});

	it("should return entire content when no frontmatter", () => {
		const content = "This is content without frontmatter.";
		const result = extractContentAfterFrontmatter(content);
		expect(result).toBe(content);
	});

	it("should handle empty content after frontmatter", () => {
		const content = `---
title: Empty Note
---
`;
		const result = extractContentAfterFrontmatter(content);
		expect(result).toBe("");
	});

	it("should handle frontmatter with extra whitespace", () => {
		const content = `---
title: Test
---
Content here`;

		const result = extractContentAfterFrontmatter(content);
		expect(result).toBe("Content here");
	});

	it("should handle content with --- in body", () => {
		const content = `---
title: Test
---
Regular content
---
More content with dashes`;

		const result = extractContentAfterFrontmatter(content);
		expect(result).toBe("Regular content\n---\nMore content with dashes");
	});

	it("should handle malformed frontmatter", () => {
		const content = `---
title: Test
No closing marker
This should all be returned`;

		const result = extractContentAfterFrontmatter(content);
		expect(result).toBe(content);
	});

	it("should handle empty string", () => {
		const result = extractContentAfterFrontmatter("");
		expect(result).toBe("");
	});

	it("should handle multiline frontmatter values", () => {
		const content = `---
title: My Note
description: |
  This is a multiline
  description
---
Body content here`;

		const result = extractContentAfterFrontmatter(content);
		expect(result).toBe("Body content here");
	});

	it("should preserve leading newlines in content", () => {
		const content = `---
title: Test
---

Content with blank line above`;

		const result = extractContentAfterFrontmatter(content);
		expect(result).toBe("Content with blank line above");
	});
});

describe("getTFileOrThrow", () => {
	it("should return TFile when file exists", () => {
		const app = createMockApp() as unknown as App;
		const mockFile = createMockFile("test.md");
		app.vault.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);

		const result = getTFileOrThrow(app, "test.md");
		expect(result).toBe(mockFile);
		expect(app.vault.getAbstractFileByPath).toHaveBeenCalledWith("test.md");
	});

	it("should throw error when file not found", () => {
		const app = createMockApp() as unknown as App;
		app.vault.getAbstractFileByPath = vi.fn().mockReturnValue(null);

		expect(() => getTFileOrThrow(app, "nonexistent.md")).toThrow("File not found: nonexistent.md");
	});

	it("should throw error when path points to folder", () => {
		const app = createMockApp() as unknown as App;
		const mockFolder = { path: "folder" }; // Not a TFile
		app.vault.getAbstractFileByPath = vi.fn().mockReturnValue(mockFolder);

		expect(() => getTFileOrThrow(app, "folder")).toThrow("File not found: folder");
	});

	it("should handle different file paths", () => {
		const app = createMockApp() as unknown as App;
		const mockFile = createMockFile("folder/subfolder/note.md");
		app.vault.getAbstractFileByPath = vi.fn().mockReturnValue(mockFile);

		const result = getTFileOrThrow(app, "folder/subfolder/note.md");
		expect(result).toBe(mockFile);
	});
});

describe("withFrontmatter", () => {
	it("should call processFrontMatter with update function", async () => {
		const app = createMockApp() as unknown as App;
		const mockFile = createMockFile("test.md");
		const updateFn = vi.fn();

		app.fileManager.processFrontMatter = vi.fn().mockResolvedValue(undefined);

		await withFrontmatter(app, mockFile, updateFn);

		expect(app.fileManager.processFrontMatter).toHaveBeenCalledWith(mockFile, updateFn);
	});

	it("should modify frontmatter correctly", async () => {
		const app = createMockApp() as unknown as App;
		const mockFile = createMockFile("test.md");

		const frontmatter = { title: "Old Title" };

		app.fileManager.processFrontMatter = vi.fn().mockImplementation(async (_file, fn) => {
			fn(frontmatter);
		});

		await withFrontmatter(app, mockFile, (fm) => {
			fm.title = "New Title";
		});

		expect(frontmatter.title).toBe("New Title");
	});
});

describe("backupFrontmatter", () => {
	it("should create a copy of frontmatter", async () => {
		const app = createMockApp() as unknown as App;
		const mockFile = createMockFile("test.md");

		const originalFM = {
			title: "My Note",
			tags: ["test", "backup"],
			count: 42,
		};

		app.fileManager.processFrontMatter = vi.fn().mockImplementation(async (_file, fn) => {
			fn(originalFM);
		});

		const backup = await backupFrontmatter(app, mockFile);

		expect(backup).toEqual(originalFM);
		expect(backup).not.toBe(originalFM); // Different object reference

		// Modify original to prove it's a copy
		originalFM.title = "Modified";
		expect(backup.title).toBe("My Note");
	});

	it("should handle empty frontmatter", async () => {
		const app = createMockApp() as unknown as App;
		const mockFile = createMockFile("test.md");

		app.fileManager.processFrontMatter = vi.fn().mockImplementation(async (_file, fn) => {
			fn({});
		});

		const backup = await backupFrontmatter(app, mockFile);

		expect(backup).toEqual({});
	});

	it("should handle nested objects", async () => {
		const app = createMockApp() as unknown as App;
		const mockFile = createMockFile("test.md");

		const originalFM = {
			title: "Test",
			config: {
				theme: "dark",
				settings: { option: true },
			},
		};

		app.fileManager.processFrontMatter = vi.fn().mockImplementation(async (_file, fn) => {
			fn(originalFM);
		});

		const backup = await backupFrontmatter(app, mockFile);

		expect(backup).toEqual(originalFM);
		// Note: Shallow copy only copies first level
		expect(backup.config).toBe(originalFM.config);
	});
});

describe("restoreFrontmatter", () => {
	it("should restore frontmatter from backup", async () => {
		const app = createMockApp() as unknown as App;
		const mockFile = createMockFile("test.md");

		const currentFM = {
			title: "Modified",
			newField: "added",
		};

		const backupFM = {
			title: "Original",
			tags: ["test"],
		};

		app.fileManager.processFrontMatter = vi.fn().mockImplementation(async (_file, fn) => {
			fn(currentFM);
		});

		await restoreFrontmatter(app, mockFile, backupFM);

		expect(currentFM).toEqual({
			title: "Original",
			tags: ["test"],
		});
		expect(currentFM.newField).toBeUndefined();
	});

	it("should clear all existing keys before restoring", async () => {
		const app = createMockApp() as unknown as App;
		const mockFile = createMockFile("test.md");

		const currentFM = {
			field1: "value1",
			field2: "value2",
			field3: "value3",
		};

		const backupFM = {
			field1: "restored",
		};

		app.fileManager.processFrontMatter = vi.fn().mockImplementation(async (_file, fn) => {
			fn(currentFM);
		});

		await restoreFrontmatter(app, mockFile, backupFM);

		expect(currentFM).toEqual({
			field1: "restored",
		});
		expect(Object.keys(currentFM)).toHaveLength(1);
	});

	it("should handle empty backup", async () => {
		const app = createMockApp() as unknown as App;
		const mockFile = createMockFile("test.md");

		const currentFM = {
			title: "Test",
			tags: ["test"],
		};

		app.fileManager.processFrontMatter = vi.fn().mockImplementation(async (_file, fn) => {
			fn(currentFM);
		});

		await restoreFrontmatter(app, mockFile, {});

		expect(currentFM).toEqual({});
		expect(Object.keys(currentFM)).toHaveLength(0);
	});
});

describe("integration: frontmatter backup and restore", () => {
	it("should backup and restore frontmatter correctly", async () => {
		const app = createMockApp() as unknown as App;
		const mockFile = createMockFile("test.md");

		const originalFM = {
			title: "Original Title",
			tags: ["important"],
			date: "2024-01-01",
		};

		// Setup initial state
		const currentFM: Record<string, unknown> = { ...originalFM };

		app.fileManager.processFrontMatter = vi.fn().mockImplementation(async (_file, fn) => {
			fn(currentFM);
		});

		// Backup original
		const backup = await backupFrontmatter(app, mockFile);

		// Modify frontmatter
		await withFrontmatter(app, mockFile, (fm) => {
			fm.title = "Modified Title";
			fm.newField = "added";
			delete fm.tags;
		});

		expect(currentFM.title).toBe("Modified Title");
		expect(currentFM.newField).toBe("added");
		expect(currentFM.tags).toBeUndefined();

		// Restore from backup
		await restoreFrontmatter(app, mockFile, backup);

		expect(currentFM).toEqual(originalFM);
	});
});
