import { describe, expect, it, vi } from "vitest";

import {
	extractRelativePath,
	findRootNodesInFolder,
	getChildrenByFolder,
	getFileContext,
	getFolderPath,
	getParentByFolder,
	getUniqueFilePath,
	getUniqueFilePathFromFull,
	isDirectChildOrFolderNote,
	isFolderNote,
	toDisplayLink,
	withFileContext,
} from "../../src/core/file";
import { TFile } from "../../src/testing/mocks/obsidian";

describe("getUniqueFilePath", () => {
	describe("basic functionality", () => {
		it("should return base name with .md extension when file doesn't exist", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
				},
			} as any;

			const result = getUniqueFilePath(mockApp, "", "MyNote");

			expect(result).toBe("MyNote.md");

			expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith("MyNote.md");
		});

		it("should append counter when file exists", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi
						.fn()
						.mockReturnValueOnce({ path: "MyNote.md" }) // First check: file exists
						.mockReturnValueOnce(null), // Second check: MyNote 1.md doesn't exist
				},
			} as any;

			const result = getUniqueFilePath(mockApp, "", "MyNote");

			expect(result).toBe("MyNote 1.md");

			expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith("MyNote.md");

			expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith("MyNote 1.md");
		});

		it("should increment counter until finding unique name", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi
						.fn()
						.mockReturnValueOnce({ path: "MyNote.md" }) // MyNote.md exists
						.mockReturnValueOnce({ path: "MyNote 1.md" }) // MyNote 1.md exists
						.mockReturnValueOnce({ path: "MyNote 2.md" }) // MyNote 2.md exists
						.mockReturnValueOnce(null), // MyNote 3.md doesn't exist
				},
			} as any;

			const result = getUniqueFilePath(mockApp, "", "MyNote");

			expect(result).toBe("MyNote 3.md");
		});
	});

	describe("folder handling", () => {
		it("should handle folder paths correctly", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
				},
			} as any;

			const result = getUniqueFilePath(mockApp, "Projects", "Task");

			expect(result).toBe("Projects/Task.md");

			expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith("Projects/Task.md");
		});

		it("should handle nested folder paths", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
				},
			} as any;

			const result = getUniqueFilePath(mockApp, "Projects/Work/Active", "Task");

			expect(result).toBe("Projects/Work/Active/Task.md");
		});

		it("should handle root folder (empty string)", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
				},
			} as any;

			const result = getUniqueFilePath(mockApp, "", "Note");

			expect(result).toBe("Note.md");
		});

		it("should handle root folder (slash)", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
				},
			} as any;

			const result = getUniqueFilePath(mockApp, "/", "Note");

			expect(result).toBe("Note.md");
		});

		it("should append counter in folder when file exists", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValueOnce({ path: "Projects/Task.md" }).mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePath(mockApp, "Projects", "Task");

			expect(result).toBe("Projects/Task 1.md");
		});
	});

	describe("edge cases", () => {
		it("should handle base names with spaces", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
				},
			} as any;

			const result = getUniqueFilePath(mockApp, "", "My Long Note Name");

			expect(result).toBe("My Long Note Name.md");
		});

		it("should handle base names with special characters", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
				},
			} as any;

			const result = getUniqueFilePath(mockApp, "", "Note (Draft)");

			expect(result).toBe("Note (Draft).md");
		});

		it("should handle base names with numbers", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValueOnce({ path: "Task 123.md" }).mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePath(mockApp, "", "Task 123");

			expect(result).toBe("Task 123 1.md");
		});

		it("should handle high counter values", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn((path) => {
						// Return existing file for counters 0-99, null for 100
						if (path === "Note.md") return { path };

						const match = path.match(/Note (\d+)\.md/);

						if (match) {
							const counter = Number.parseInt(match[1], 10);

							return counter < 100 ? { path } : null;
						}

						return null;
					}),
				},
			} as any;

			const result = getUniqueFilePath(mockApp, "", "Note");

			expect(result).toBe("Note 100.md");
		});
	});

	describe("real-world scenarios", () => {
		it("should handle creating child node from parent", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
				},
			} as any;

			const result = getUniqueFilePath(mockApp, "Notes", "Prisma Child");

			expect(result).toBe("Notes/Prisma Child.md");
		});

		it("should handle multiple child nodes from same parent", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi
						.fn()
						.mockReturnValueOnce({ path: "Notes/Prisma Child.md" })
						.mockReturnValueOnce({ path: "Notes/Prisma Child 1.md" })
						.mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePath(mockApp, "Notes", "Prisma Child");

			expect(result).toBe("Notes/Prisma Child 2.md");
		});
	});
});

describe("getUniqueFilePathFromFull", () => {
	describe("basic functionality", () => {
		it("should return path as-is when file doesn't exist", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "folder/note.md");

			expect(result).toBe("folder/note.md");
			expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith("folder/note.md");
		});

		it("should append counter when file exists", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi
						.fn()
						.mockReturnValueOnce({ path: "folder/note.md" }) // First check: file exists
						.mockReturnValueOnce(null), // Second check: note 1.md doesn't exist
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "folder/note.md");

			expect(result).toBe("folder/note 1.md");
			expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith("folder/note.md");
			expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith("folder/note 1.md");
		});

		it("should increment counter until finding unique name", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi
						.fn()
						.mockReturnValueOnce({ path: "note.md" }) // note.md exists
						.mockReturnValueOnce({ path: "note 1.md" }) // note 1.md exists
						.mockReturnValueOnce({ path: "note 2.md" }) // note 2.md exists
						.mockReturnValueOnce(null), // note 3.md doesn't exist
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "note.md");

			expect(result).toBe("note 3.md");
		});
	});

	describe("extension handling", () => {
		it("should work with .md extension", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValueOnce({ path: "note.md" }).mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "note.md");

			expect(result).toBe("note 1.md");
		});

		it("should work with .png extension", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValueOnce({ path: "image.png" }).mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "image.png");

			expect(result).toBe("image 1.png");
		});

		it("should work with .pdf extension", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValueOnce({ path: "document.pdf" }).mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "document.pdf");

			expect(result).toBe("document 1.pdf");
		});

		it("should work with files without extension", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValueOnce({ path: "README" }).mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "README");

			expect(result).toBe("README 1");
		});

		it("should work with multiple dots in filename", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValueOnce({ path: "file.backup.md" }).mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "file.backup.md");

			expect(result).toBe("file.backup 1.md");
		});
	});

	describe("folder path handling", () => {
		it("should handle root level files", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValueOnce({ path: "note.md" }).mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "note.md");

			expect(result).toBe("note 1.md");
		});

		it("should handle single folder depth", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValueOnce({ path: "folder/note.md" }).mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "folder/note.md");

			expect(result).toBe("folder/note 1.md");
		});

		it("should handle nested folder paths", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi
						.fn()
						.mockReturnValueOnce({ path: "projects/work/active/task.md" })
						.mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "projects/work/active/task.md");

			expect(result).toBe("projects/work/active/task 1.md");
		});

		it("should handle deeply nested paths", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValueOnce({ path: "a/b/c/d/e/f/file.md" }).mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "a/b/c/d/e/f/file.md");

			expect(result).toBe("a/b/c/d/e/f/file 1.md");
		});
	});

	describe("edge cases", () => {
		it("should handle filenames with spaces", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi
						.fn()
						.mockReturnValueOnce({ path: "My Long Note Name.md" })
						.mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "My Long Note Name.md");

			expect(result).toBe("My Long Note Name 1.md");
		});

		it("should handle filenames with special characters", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValueOnce({ path: "Note (Draft).md" }).mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "Note (Draft).md");

			expect(result).toBe("Note (Draft) 1.md");
		});

		it("should handle filenames already containing numbers", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValueOnce({ path: "Task 123.md" }).mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "Task 123.md");

			expect(result).toBe("Task 123 1.md");
		});

		it("should handle filenames already with counter suffix", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValueOnce({ path: "Note 5.md" }).mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "Note 5.md");

			expect(result).toBe("Note 5 1.md");
		});

		it("should handle high counter values", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn((path) => {
						// Return existing file for counters 0-99, null for 100
						if (path === "note.md") return { path };

						const match = path.match(/note (\d+)\.md/);
						if (match) {
							const counter = Number.parseInt(match[1], 10);
							return counter < 100 ? { path } : null;
						}

						return null;
					}),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "note.md");

			expect(result).toBe("note 100.md");
		});

		it("should handle empty filename (edge case)", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValueOnce({ path: ".md" }).mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, ".md");

			expect(result).toBe(" 1.md");
		});

		it("should handle filename with only extension", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, ".gitignore");

			expect(result).toBe(".gitignore");
		});
	});

	describe("integration with generateUniqueFilePath", () => {
		it("should produce same result as generateUniqueFilePath for simple case", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValueOnce({ path: "note.md" }).mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "note.md");

			expect(result).toBe("note 1.md");
		});

		it("should produce same result as generateUniqueFilePath with folder", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValueOnce({ path: "folder/note.md" }).mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "folder/note.md");

			expect(result).toBe("folder/note 1.md");
		});
	});

	describe("real-world scenarios", () => {
		it("should handle image file in assets folder", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi
						.fn()
						.mockReturnValueOnce({ path: "assets/screenshot.png" })
						.mockReturnValueOnce({ path: "assets/screenshot 1.png" })
						.mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "assets/screenshot.png");

			expect(result).toBe("assets/screenshot 2.png");
		});

		it("should handle attachment file with various extensions", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi
						.fn()
						.mockReturnValueOnce({ path: "attachments/document.pdf" })
						.mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "attachments/document.pdf");

			expect(result).toBe("attachments/document 1.pdf");
		});

		it("should handle recurring event note creation", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi
						.fn()
						.mockReturnValueOnce({ path: "Calendar/2024-01-15 Meeting.md" })
						.mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "Calendar/2024-01-15 Meeting.md");

			expect(result).toBe("Calendar/2024-01-15 Meeting 1.md");
		});

		it("should handle duplicate file import scenario", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn((path) => {
						// Simulate 5 existing files
						if (path === "imports/data.json") return { path };
						const match = path.match(/imports\/data (\d+)\.json/);
						if (match) {
							const counter = Number.parseInt(match[1], 10);
							return counter <= 5 ? { path } : null;
						}
						return null;
					}),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "imports/data.json");

			expect(result).toBe("imports/data 6.json");
		});
	});

	describe("performance considerations", () => {
		it("should efficiently handle sequential checks", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi
						.fn()
						.mockReturnValueOnce({ path: "note.md" })
						.mockReturnValueOnce({ path: "note 1.md" })
						.mockReturnValueOnce({ path: "note 2.md" })
						.mockReturnValueOnce(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "note.md");

			expect(result).toBe("note 3.md");
			// Should have called exactly 4 times (original + 3 counters)
			expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledTimes(4);
		});

		it("should return immediately when file doesn't exist", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
				},
			} as any;

			const result = getUniqueFilePathFromFull(mockApp, "unique-file.md");

			expect(result).toBe("unique-file.md");
			// Should only call once
			expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledTimes(1);
		});
	});
});

describe("isFolderNote", () => {
	describe("folder note detection", () => {
		it("should return true for folder note (folder/folder.md)", () => {
			expect(isFolderNote("tasks/tasks.md")).toBe(true);
		});

		it("should return true for nested folder note", () => {
			expect(isFolderNote("projects/docs/docs.md")).toBe(true);
		});

		it("should return true for deeply nested folder note", () => {
			expect(isFolderNote("a/b/c/d/d.md")).toBe(true);
		});

		it("should return false for non-folder note", () => {
			expect(isFolderNote("tasks/subtask.md")).toBe(false);
		});

		it("should return false for root level file", () => {
			expect(isFolderNote("note.md")).toBe(false);
		});

		it("should return false for empty path", () => {
			expect(isFolderNote("")).toBe(false);
		});
	});

	describe("edge cases", () => {
		it("should handle path without extension", () => {
			expect(isFolderNote("tasks/tasks")).toBe(true);
		});

		it("should handle case-sensitive folder names", () => {
			expect(isFolderNote("Tasks/tasks.md")).toBe(false);

			expect(isFolderNote("Tasks/Tasks.md")).toBe(true);
		});
	});
});

describe("getFolderPath", () => {
	describe("basic functionality", () => {
		it("should extract folder path from file path", () => {
			expect(getFolderPath("tasks/subtask.md")).toBe("tasks");
		});

		it("should extract nested folder path", () => {
			expect(getFolderPath("projects/docs/notes.md")).toBe("projects/docs");
		});

		it("should return empty string for root level file", () => {
			expect(getFolderPath("note.md")).toBe("");
		});

		it("should return empty string for empty path", () => {
			expect(getFolderPath("")).toBe("");
		});
	});

	describe("edge cases", () => {
		it("should handle paths with multiple slashes", () => {
			expect(getFolderPath("a/b/c/d/file.md")).toBe("a/b/c/d");
		});

		it("should handle paths without extension", () => {
			expect(getFolderPath("folder/file")).toBe("folder");
		});
	});
});

describe("getParentByFolder", () => {
	describe("basic functionality", () => {
		it("should return parent folder note if it exists", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn((path) => {
						return path === "tasks/tasks.md" ? new TFile("tasks/tasks.md") : null;
					}),
				},
			} as any;

			expect(getParentByFolder(mockApp, "tasks/subtask.md")).toBe("tasks/tasks.md");
		});

		it("should return null if parent folder note doesn't exist", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
				},
			} as any;

			expect(getParentByFolder(mockApp, "tasks/subtask.md")).toBe(null);
		});

		it("should return null for root level file", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn(),
				},
			} as any;

			expect(getParentByFolder(mockApp, "note.md")).toBe(null);
		});
	});

	describe("nested folders", () => {
		it("should find parent in nested folder structure", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn((path) => {
						return path === "projects/docs/docs.md" ? new TFile("projects/docs/docs.md") : null;
					}),
				},
			} as any;

			expect(getParentByFolder(mockApp, "projects/docs/readme.md")).toBe("projects/docs/docs.md");
		});

		it("should return null if nested parent doesn't exist", () => {
			const mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
				},
			} as any;

			expect(getParentByFolder(mockApp, "projects/docs/readme.md")).toBe(null);
		});
	});
});

describe("getChildrenByFolder", () => {
	describe("folder note children", () => {
		it("should return children of folder note", () => {
			const mockFiles = [
				{ path: "tasks/tasks.md" },
				{ path: "tasks/task1.md" },
				{ path: "tasks/task2.md" },
				{ path: "tasks/subtasks/subtask1.md" },
			];

			const mockApp = {
				vault: {
					getMarkdownFiles: vi.fn(() => mockFiles),
				},
			} as any;

			const children = getChildrenByFolder(mockApp, "tasks/tasks.md");

			expect(children).toContain("tasks/task1.md");

			expect(children).toContain("tasks/task2.md");

			expect(children).not.toContain("tasks/tasks.md"); // Exclude self

			expect(children).not.toContain("tasks/subtasks/subtask1.md"); // Exclude files in subfolders
		});

		it("should include subfolder notes as children", () => {
			const mockFiles = [
				{ path: "tasks/tasks.md" },
				{ path: "tasks/task1.md" },
				{ path: "tasks/subtasks/subtasks.md" },
				{ path: "tasks/subtasks/subtask1.md" },
			];

			const mockApp = {
				vault: {
					getMarkdownFiles: vi.fn(() => mockFiles),
				},
			} as any;

			const children = getChildrenByFolder(mockApp, "tasks/tasks.md");

			expect(children).toContain("tasks/task1.md");

			expect(children).toContain("tasks/subtasks/subtasks.md"); // Include subfolder note

			expect(children).not.toContain("tasks/subtasks/subtask1.md"); // Exclude files inside subfolder
		});

		it("should return empty array if folder is empty", () => {
			const mockFiles = [{ path: "tasks/tasks.md" }];

			const mockApp = {
				vault: {
					getMarkdownFiles: vi.fn(() => mockFiles),
				},
			} as any;

			const children = getChildrenByFolder(mockApp, "tasks/tasks.md");

			expect(children).toEqual([]);
		});
	});

	describe("regular file children", () => {
		it("should return matching subfolder note for regular file", () => {
			const mockApp = {
				vault: {
					getMarkdownFiles: vi.fn(() => []),
					getAbstractFileByPath: vi.fn((path) => {
						return path === "tasks/task1/task1.md" ? new TFile("tasks/task1/task1.md") : null;
					}),
				},
			} as any;

			const children = getChildrenByFolder(mockApp, "tasks/task1.md");

			expect(children).toContain("tasks/task1/task1.md");
		});

		it("should return empty array if no matching subfolder note exists", () => {
			const mockApp = {
				vault: {
					getMarkdownFiles: vi.fn(() => []),
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
				},
			} as any;

			const children = getChildrenByFolder(mockApp, "tasks/task1.md");

			expect(children).toEqual([]);
		});
	});
});

describe("findRootNodesInFolder", () => {
	describe("root node identification", () => {
		it("should find all files at the top level of folder", () => {
			const mockFiles = [
				{ path: "tasks/tasks.md" },
				{ path: "tasks/task1.md" },
				{ path: "tasks/task2.md" },
				{ path: "tasks/subtasks/subtasks.md" },
				{ path: "tasks/subtasks/subtask1.md" },
			];

			const mockApp = {
				vault: {
					getMarkdownFiles: vi.fn(() => mockFiles),
				},
			} as any;

			const roots = findRootNodesInFolder(mockApp, "tasks");

			expect(roots).toHaveLength(3);

			expect(roots).toContain("tasks/tasks.md");

			expect(roots).toContain("tasks/task1.md");

			expect(roots).toContain("tasks/task2.md");

			expect(roots).not.toContain("tasks/subtasks/subtasks.md");

			expect(roots).not.toContain("tasks/subtasks/subtask1.md");
		});

		it("should return empty array if folder has no files", () => {
			const mockFiles = [{ path: "other/file.md" }, { path: "tasks/subfolder/file.md" }];

			const mockApp = {
				vault: {
					getMarkdownFiles: vi.fn(() => mockFiles),
				},
			} as any;

			const roots = findRootNodesInFolder(mockApp, "tasks");

			expect(roots).toEqual([]);
		});

		it("should handle empty vault", () => {
			const mockApp = {
				vault: {
					getMarkdownFiles: vi.fn(() => []),
				},
			} as any;

			const roots = findRootNodesInFolder(mockApp, "tasks");

			expect(roots).toEqual([]);
		});
	});
});

describe("getFileContext", () => {
	describe("basic functionality", () => {
		it("should return file context when file exists at direct path", () => {
			const mockFile = new TFile("folder/note.md");
			const mockCache = { frontmatter: { title: "Test" } };

			const mockApp = {
				vault: {
					getFileByPath: vi.fn().mockReturnValue(mockFile),
				},
				metadataCache: {
					getFileCache: vi.fn().mockReturnValue(mockCache),
					getFirstLinkpathDest: vi.fn(),
				},
			} as any;

			const result = getFileContext(mockApp, "folder/note.md");

			expect(result.file).toBe(mockFile);
			expect(result.pathWithExt).toBe("folder/note.md");
			expect(result.baseName).toBe("note");
			expect(result.frontmatter).toEqual({ title: "Test" });
		});

		it("should return null file when file doesn't exist", () => {
			const mockApp = {
				vault: {
					getFileByPath: vi.fn().mockReturnValue(null),
				},
				metadataCache: {
					getFileCache: vi.fn().mockReturnValue(null),
					getFirstLinkpathDest: vi.fn(),
				},
			} as any;

			const result = getFileContext(mockApp, "nonexistent.md");

			expect(result.file).toBeNull();
			expect(result.pathWithExt).toBe("nonexistent.md");
			expect(result.frontmatter).toBeUndefined();
		});

		it("should add .md extension if not present", () => {
			const mockApp = {
				vault: {
					getFileByPath: vi.fn().mockReturnValue(null),
				},
				metadataCache: {
					getFileCache: vi.fn().mockReturnValue(null),
					getFirstLinkpathDest: vi.fn(),
				},
			} as any;

			const result = getFileContext(mockApp, "note");

			expect(result.pathWithExt).toBe("note.md");
			expect(mockApp.vault.getFileByPath).toHaveBeenCalledWith("note.md");
		});
	});

	describe("link resolution with sourcePath", () => {
		it("should resolve link using getFirstLinkpathDest when sourcePath is provided", () => {
			const mockFile = new TFile("folder/parent-note.md");
			const mockCache = { frontmatter: { title: "Parent" } };

			const mockApp = {
				vault: {
					getFileByPath: vi.fn().mockReturnValue(null), // Direct lookup fails
				},
				metadataCache: {
					getFileCache: vi.fn().mockReturnValue(mockCache),
					getFirstLinkpathDest: vi.fn().mockReturnValue(mockFile), // Link resolution succeeds
				},
			} as any;

			const result = getFileContext(mockApp, "parent-note", { sourcePath: "folder/child.md" });

			expect(mockApp.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith("parent-note", "folder/child.md");
			expect(result.file).toBe(mockFile);
			expect(result.pathWithExt).toBe("folder/parent-note.md"); // Uses resolved path
		});

		it("should fall back to direct lookup when link resolution fails", () => {
			const mockFile = new TFile("parent-note.md");
			const mockCache = { frontmatter: {} };

			const mockApp = {
				vault: {
					getFileByPath: vi.fn().mockReturnValue(mockFile), // Direct lookup succeeds
				},
				metadataCache: {
					getFileCache: vi.fn().mockReturnValue(mockCache),
					getFirstLinkpathDest: vi.fn().mockReturnValue(null), // Link resolution fails
				},
			} as any;

			const result = getFileContext(mockApp, "parent-note", { sourcePath: "folder/child.md" });

			expect(mockApp.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith("parent-note", "folder/child.md");
			expect(mockApp.vault.getFileByPath).toHaveBeenCalledWith("parent-note.md");
			expect(result.file).toBe(mockFile);
		});

		it("should not use link resolution when sourcePath is not provided", () => {
			const mockFile = new TFile("note.md");

			const mockApp = {
				vault: {
					getFileByPath: vi.fn().mockReturnValue(mockFile),
				},
				metadataCache: {
					getFileCache: vi.fn().mockReturnValue(null),
					getFirstLinkpathDest: vi.fn(),
				},
			} as any;

			getFileContext(mockApp, "note");

			expect(mockApp.metadataCache.getFirstLinkpathDest).not.toHaveBeenCalled();
		});

		it("should handle wikilink format in different folders", () => {
			const mockFile = new TFile("projects/tasks/parent.md");

			const mockApp = {
				vault: {
					getFileByPath: vi.fn().mockReturnValue(null),
				},
				metadataCache: {
					getFileCache: vi.fn().mockReturnValue(null),
					getFirstLinkpathDest: vi.fn().mockReturnValue(mockFile),
				},
			} as any;

			const result = getFileContext(mockApp, "parent", { sourcePath: "projects/tasks/child.md" });

			expect(result.file).toBe(mockFile);
			expect(result.pathWithExt).toBe("projects/tasks/parent.md");
		});
	});

	describe("edge cases", () => {
		it("should extract baseName correctly from wikilink path", () => {
			const mockApp = {
				vault: {
					getFileByPath: vi.fn().mockReturnValue(null),
				},
				metadataCache: {
					getFileCache: vi.fn().mockReturnValue(null),
					getFirstLinkpathDest: vi.fn(),
				},
			} as any;

			const result = getFileContext(mockApp, "folder/subfolder/my-note");

			expect(result.baseName).toBe("my-note");
		});

		it("should handle empty options object", () => {
			const mockApp = {
				vault: {
					getFileByPath: vi.fn().mockReturnValue(null),
				},
				metadataCache: {
					getFileCache: vi.fn().mockReturnValue(null),
					getFirstLinkpathDest: vi.fn(),
				},
			} as any;

			const result = getFileContext(mockApp, "note", {});

			expect(result.pathWithExt).toBe("note.md");
			expect(mockApp.metadataCache.getFirstLinkpathDest).not.toHaveBeenCalled();
		});
	});
});

describe("withFileContext", () => {
	describe("basic functionality", () => {
		it("should execute callback when file exists", async () => {
			const mockFile = new TFile("note.md");

			const mockApp = {
				vault: {
					getFileByPath: vi.fn().mockReturnValue(mockFile),
				},
				metadataCache: {
					getFileCache: vi.fn().mockReturnValue({ frontmatter: {} }),
					getFirstLinkpathDest: vi.fn(),
				},
			} as any;

			const callback = vi.fn().mockReturnValue("result");

			const result = await withFileContext(mockApp, "note.md", callback);

			expect(callback).toHaveBeenCalled();
			expect(result).toBe("result");
		});

		it("should return null when file doesn't exist", async () => {
			const mockApp = {
				vault: {
					getFileByPath: vi.fn().mockReturnValue(null),
				},
				metadataCache: {
					getFileCache: vi.fn().mockReturnValue(null),
					getFirstLinkpathDest: vi.fn(),
				},
			} as any;

			const callback = vi.fn();

			const result = await withFileContext(mockApp, "nonexistent.md", callback);

			expect(callback).not.toHaveBeenCalled();
			expect(result).toBeNull();
		});

		it("should handle async callbacks", async () => {
			const mockFile = new TFile("note.md");

			const mockApp = {
				vault: {
					getFileByPath: vi.fn().mockReturnValue(mockFile),
				},
				metadataCache: {
					getFileCache: vi.fn().mockReturnValue({ frontmatter: {} }),
					getFirstLinkpathDest: vi.fn(),
				},
			} as any;

			const callback = vi.fn().mockResolvedValue("async result");

			const result = await withFileContext(mockApp, "note.md", callback);

			expect(result).toBe("async result");
		});
	});

	describe("with link resolution", () => {
		it("should resolve link when sourcePath option is provided", async () => {
			const mockFile = new TFile("folder/parent.md");

			const mockApp = {
				vault: {
					getFileByPath: vi.fn().mockReturnValue(null),
				},
				metadataCache: {
					getFileCache: vi.fn().mockReturnValue({ frontmatter: {} }),
					getFirstLinkpathDest: vi.fn().mockReturnValue(mockFile),
				},
			} as any;

			const callback = vi.fn().mockReturnValue("found");

			const result = await withFileContext(mockApp, "parent", callback, { sourcePath: "folder/child.md" });

			expect(mockApp.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith("parent", "folder/child.md");
			expect(callback).toHaveBeenCalled();
			expect(result).toBe("found");
		});

		it("should return null when link resolution fails and direct lookup fails", async () => {
			const mockApp = {
				vault: {
					getFileByPath: vi.fn().mockReturnValue(null),
				},
				metadataCache: {
					getFileCache: vi.fn().mockReturnValue(null),
					getFirstLinkpathDest: vi.fn().mockReturnValue(null),
				},
			} as any;

			const callback = vi.fn();

			const result = await withFileContext(mockApp, "parent", callback, { sourcePath: "folder/child.md" });

			expect(callback).not.toHaveBeenCalled();
			expect(result).toBeNull();
		});
	});
});

describe("isDirectChildOrFolderNote", () => {
	describe("nodeType: files", () => {
		it("should match a direct child file", () => {
			expect(isDirectChildOrFolderNote("People/Alice.md", "People", "files")).toBe(true);
		});

		it("should reject files in subdirectories", () => {
			expect(isDirectChildOrFolderNote("People/Alice/meeting.md", "People", "files")).toBe(false);
		});

		it("should reject deeply nested files", () => {
			expect(isDirectChildOrFolderNote("People/Alice/sub/deep.md", "People", "files")).toBe(false);
		});

		it("should reject files outside the directory", () => {
			expect(isDirectChildOrFolderNote("Other/Alice.md", "People", "files")).toBe(false);
		});

		it("should reject files in a similarly-named directory", () => {
			expect(isDirectChildOrFolderNote("PeopleExtra/Alice.md", "People", "files")).toBe(false);
		});

		it("should reject folder notes when nodeType is files", () => {
			expect(isDirectChildOrFolderNote("People/Alice/Alice.md", "People", "files")).toBe(false);
		});

		it("should match files in nested directory paths", () => {
			expect(isDirectChildOrFolderNote("Root/Sub/People/note.md", "Root/Sub/People", "files")).toBe(true);
		});

		it("should reject the directory path itself", () => {
			expect(isDirectChildOrFolderNote("People", "People", "files")).toBe(false);
		});
	});

	describe("nodeType: folderNotes", () => {
		it("should match a folder note", () => {
			expect(isDirectChildOrFolderNote("People/Alice/Alice.md", "People", "folderNotes")).toBe(true);
		});

		it("should reject a non-folder-note in a subdirectory", () => {
			expect(isDirectChildOrFolderNote("People/Alice/meeting.md", "People", "folderNotes")).toBe(false);
		});

		it("should reject a direct child file", () => {
			expect(isDirectChildOrFolderNote("People/Alice.md", "People", "folderNotes")).toBe(false);
		});

		it("should reject deeply nested folder notes", () => {
			expect(isDirectChildOrFolderNote("People/Alice/Sub/Sub.md", "People", "folderNotes")).toBe(false);
		});

		it("should reject files outside the directory", () => {
			expect(isDirectChildOrFolderNote("Other/Alice/Alice.md", "People", "folderNotes")).toBe(false);
		});

		it("should reject files in a similarly-named directory", () => {
			expect(isDirectChildOrFolderNote("PeopleExtra/Alice/Alice.md", "People", "folderNotes")).toBe(false);
		});

		it("should match folder notes in nested directory paths", () => {
			expect(isDirectChildOrFolderNote("Root/Sub/People/Bob/Bob.md", "Root/Sub/People", "folderNotes")).toBe(true);
		});

		it("should handle case-sensitive folder/file names", () => {
			expect(isDirectChildOrFolderNote("People/alice/Alice.md", "People", "folderNotes")).toBe(false);
			expect(isDirectChildOrFolderNote("People/Alice/alice.md", "People", "folderNotes")).toBe(false);
		});

		it("should handle folder note without .md extension check", () => {
			expect(isDirectChildOrFolderNote("People/Bob/Bob.md", "People", "folderNotes")).toBe(true);
		});
	});

	describe("edge cases", () => {
		it("should handle empty directory string", () => {
			expect(isDirectChildOrFolderNote("/file.md", "", "files")).toBe(true);
		});

		it("should handle directory with trailing content that looks like a prefix", () => {
			expect(isDirectChildOrFolderNote("People2/Alice.md", "People", "files")).toBe(false);
		});

		it("should handle paths with spaces", () => {
			expect(isDirectChildOrFolderNote("My People/John Doe.md", "My People", "files")).toBe(true);
			expect(isDirectChildOrFolderNote("My People/John Doe/John Doe.md", "My People", "folderNotes")).toBe(true);
		});
	});

	describe("toDisplayLink", () => {
		it("should create a display link from a folder note path", () => {
			expect(toDisplayLink("People/Alice/Alice.md")).toBe("[[People/Alice/Alice|Alice]]");
		});

		it("should create a display link from a simple file path", () => {
			expect(toDisplayLink("Tasks/Build MVP.md")).toBe("[[Tasks/Build MVP|Build MVP]]");
		});

		it("should handle root-level files", () => {
			expect(toDisplayLink("Note.md")).toBe("[[Note|Note]]");
		});

		it("should handle deeply nested paths", () => {
			expect(toDisplayLink("A/B/C/Deep Note.md")).toBe("[[A/B/C/Deep Note|Deep Note]]");
		});
	});

	describe("extractRelativePath", () => {
		it("strips directory prefix and .md extension", () => {
			expect(extractRelativePath("events/meeting.md", "events")).toBe("meeting");
		});

		it("preserves subdirectory structure", () => {
			expect(extractRelativePath("events/courses/CS101/hw1.md", "events")).toBe("courses/CS101/hw1");
		});

		it("handles deeply nested paths", () => {
			expect(extractRelativePath("events/a/b/c/d/deep.md", "events")).toBe("a/b/c/d/deep");
		});

		it("handles nested directory prefix", () => {
			expect(extractRelativePath("vault/my-events/sub/note.md", "vault/my-events")).toBe("sub/note");
		});

		it("handles empty directory", () => {
			expect(extractRelativePath("note.md", "")).toBe("note");
		});

		it("returns full path without extension when prefix does not match", () => {
			expect(extractRelativePath("other/note.md", "events")).toBe("other/note");
		});

		it("handles path without .md extension", () => {
			expect(extractRelativePath("events/note", "events")).toBe("note");
		});
	});
});
