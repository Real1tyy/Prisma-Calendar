import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import {
	ensureFileHasZettelId,
	extractZettelId,
	generateUniqueEventPath,
	generateUniqueZettelId,
	removeZettelId,
} from "../../src/utils/calendar-events";
import { createMockApp, createMockFile } from "../mocks/obsidian";

describe("ZettelID Utilities", () => {
	describe("extractZettelId", () => {
		it("should extract ZettelID from filename with ZettelID", () => {
			const result = extractZettelId("Meeting Notes-20250106120000");
			expect(result).toBe("20250106120000");
		});

		it("should extract ZettelID from path with ZettelID", () => {
			const result = extractZettelId("Daily Task-20231225093000");
			expect(result).toBe("20231225093000");
		});

		it("should return null for filename without ZettelID", () => {
			const result = extractZettelId("Meeting Notes");
			expect(result).toBeNull();
		});

		it("should return null for filename with partial ZettelID", () => {
			const result = extractZettelId("Meeting-2025010");
			expect(result).toBeNull();
		});

		it("should return null for empty string", () => {
			const result = extractZettelId("");
			expect(result).toBeNull();
		});

		it("should handle filename with multiple number sequences", () => {
			const result = extractZettelId("2025-Meeting-Notes-20250106120000");
			expect(result).toBe("20250106120000");
		});
	});

	describe("removeZettelId", () => {
		it("should remove ZettelID with hyphen from filename", () => {
			const result = removeZettelId("Meeting Notes-20250106120000");
			expect(result).toBe("Meeting Notes");
		});

		it("should remove space-separated ZettelID from filename", () => {
			const result = removeZettelId("Gym 20250203140530");
			expect(result).toBe("Gym");
		});

		it("should remove ISO date formats", () => {
			const result = removeZettelId("Meeting - 2025-02-03");
			expect(result).toBe("Meeting");
			const result2 = removeZettelId("Event - 2025-02-03 14:00");
			expect(result2).toBe("Event");
		});

		it("should remove trailing timestamps (8+ digits)", () => {
			const result = removeZettelId("Task 20250203");
			expect(result).toBe("Task");
			const result2 = removeZettelId("Event 123456789");
			expect(result2).toBe("Event");
		});

		it("should return original filename if no ZettelID or timestamp", () => {
			const result = removeZettelId("Meeting Notes");
			expect(result).toBe("Meeting Notes");
			const result2 = removeZettelId("Recurring Event");
			expect(result2).toBe("Recurring Event");
		});

		it("should handle multiple hyphens correctly", () => {
			const result = removeZettelId("My-Important-Meeting-20250106120000");
			expect(result).toBe("My-Important-Meeting");
		});

		it("should not remove partial number sequences", () => {
			const result = removeZettelId("Meeting-2025");
			expect(result).toBe("Meeting-2025");
		});

		it("should handle multiple spaces before timestamp", () => {
			const result = removeZettelId("Event   20250203140530");
			expect(result).toBe("Event");
		});

		it("should handle empty string", () => {
			const result = removeZettelId("");
			expect(result).toBe("");
		});

		it("should trim result after stripping", () => {
			const result = removeZettelId("Event  20250203140530");
			expect(result).toBe("Event");
		});

		it("should remove ISO date suffix without dash separator", () => {
			const result = removeZettelId("Go To The Gym 2025-10-29");
			expect(result).toBe("Go To The Gym");
			const result2 = removeZettelId("Go To The Gym 2025-10-31");
			expect(result2).toBe("Go To The Gym");
		});

		it("should handle various date-suffixed event names", () => {
			expect(removeZettelId("Thai Boxing 2025-10-28")).toBe("Thai Boxing");
			expect(removeZettelId("Sauna 2025-11-02")).toBe("Sauna");
			expect(removeZettelId("Mid Week Sprint Sync 2025-10-30")).toBe("Mid Week Sprint Sync");
		});

		it("should not remove date from middle of string", () => {
			const result = removeZettelId("Event 2025-10-29 Important");
			expect(result).toBe("Event 2025-10-29 Important");
		});

		it("should handle edge case with only date", () => {
			const result = removeZettelId("2025-10-29");
			expect(result).toBe("2025-10-29");
		});
	});

	describe("generateUniqueZettelId", () => {
		it("should generate 14-digit ZettelID when path doesn't exist", () => {
			const app = createMockApp() as unknown as App;
			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

			const result = generateUniqueZettelId(app, "notes/", "Meeting");

			// Should be a 14-digit string
			expect(result).toMatch(/^\d{14}$/);
			expect(app.vault.getAbstractFileByPath).toHaveBeenCalledWith(`notes/Meeting-${result}.md`);
		});

		it("should increment ZettelID when path exists", () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("notes/Meeting-20250106120000.md");

			vi.mocked(app.vault.getAbstractFileByPath)
				.mockReturnValueOnce(mockFile) // First call: file exists
				.mockReturnValueOnce(null); // Second call: incremented ID is free

			const result = generateUniqueZettelId(app, "notes/", "Meeting");

			// Should be a 14-digit string
			expect(result).toMatch(/^\d{14}$/);
			// Should have checked twice (once for original, once for incremented)
			expect(app.vault.getAbstractFileByPath).toHaveBeenCalledTimes(2);
		});

		it("should keep incrementing until unique ID found", () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("notes/Meeting-20250106120000.md");

			vi.mocked(app.vault.getAbstractFileByPath)
				.mockReturnValueOnce(mockFile) // First attempt
				.mockReturnValueOnce(mockFile) // Second attempt
				.mockReturnValueOnce(mockFile) // Third attempt
				.mockReturnValueOnce(null); // Fourth attempt: success

			const result = generateUniqueZettelId(app, "notes/", "Meeting");

			// Should be a 14-digit string
			expect(result).toMatch(/^\d{14}$/);
			// Should have checked 4 times
			expect(app.vault.getAbstractFileByPath).toHaveBeenCalledTimes(4);
		});

		it("should handle empty basePath", () => {
			const app = createMockApp() as unknown as App;
			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

			const result = generateUniqueZettelId(app, "", "Meeting");

			expect(result).toMatch(/^\d{14}$/);
			expect(app.vault.getAbstractFileByPath).toHaveBeenCalledWith(`Meeting-${result}.md`);
		});

		it("should use fallback with random suffix after max attempts", () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("notes/Meeting-20250106120000.md");

			// Always return a file to force max attempts
			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(mockFile);

			const result = generateUniqueZettelId(app, "notes/", "Meeting");

			// Should be a 14-digit timestamp + 1-3 digit random suffix
			expect(result).toMatch(/^\d{14}\d{1,3}$/);
		});
	});

	describe("generateUniqueEventPath", () => {
		it("should generate complete event path with unique ZettelID", () => {
			const app = createMockApp() as unknown as App;
			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

			const result = generateUniqueEventPath(app, "events", "Team Meeting");

			expect(result.zettelId).toMatch(/^\d{14}$/);
			expect(result.filename).toBe(`Team Meeting-${result.zettelId}`);
			expect(result.fullPath).toBe(`events/${result.filename}.md`);
		});

		it("should handle empty directory", () => {
			const app = createMockApp() as unknown as App;
			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

			const result = generateUniqueEventPath(app, "", "Meeting");

			expect(result.zettelId).toMatch(/^\d{14}$/);
			expect(result.filename).toBe(`Meeting-${result.zettelId}`);
			expect(result.fullPath).toBe(`${result.filename}.md`);
		});

		it("should generate unique path when collision occurs", () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("events/Meeting-20250106120000.md");

			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValueOnce(mockFile).mockReturnValueOnce(null);

			const result = generateUniqueEventPath(app, "events", "Meeting");

			expect(result.zettelId).toMatch(/^\d{14}$/);
			expect(result.filename).toBe(`Meeting-${result.zettelId}`);
			expect(result.fullPath).toBe(`events/${result.filename}.md`);
			// Should have checked twice due to collision
			expect(app.vault.getAbstractFileByPath).toHaveBeenCalledTimes(2);
		});

		it("should normalize directory with trailing slash", () => {
			const app = createMockApp() as unknown as App;
			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

			const result = generateUniqueEventPath(app, "events/", "Meeting");

			// Should not have double slashes
			expect(result.fullPath).not.toMatch(/\/\//);
			expect(result.fullPath).toMatch(/^events\/Meeting-\d{14}\.md$/);
		});
	});

	describe("ensureFileHasZettelId", () => {
		it("should return existing ZettelID if file already has one", async () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("events/Meeting-20250106120000.md");
			mockFile.basename = "Meeting-20250106120000";

			const result = await ensureFileHasZettelId(app, mockFile);

			expect(result.zettelId).toBe("20250106120000");
			expect(result.file).toBe(mockFile);
			expect(app.fileManager.renameFile).not.toHaveBeenCalled();
		});

		it("should embed ZettelID in frontmatter if it exists but not in frontmatter", async () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("events/Meeting-20250106120000.md");
			mockFile.basename = "Meeting-20250106120000";

			const result = await ensureFileHasZettelId(app, mockFile, "zettelId");

			expect(result.zettelId).toBe("20250106120000");
			// Should update frontmatter
			expect(app.fileManager.processFrontMatter).toHaveBeenCalled();
		});

		it("should generate and embed ZettelID if file doesn't have one", async () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("events/Meeting.md");
			mockFile.basename = "Meeting";
			mockFile.parent = { path: "events" } as any;

			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

			const result = await ensureFileHasZettelId(app, mockFile, "zettelId");

			expect(result.zettelId).toMatch(/^\d{14}$/);
			expect(app.fileManager.renameFile).toHaveBeenCalledWith(mockFile, `events/Meeting-${result.zettelId}.md`);
			expect(app.fileManager.processFrontMatter).toHaveBeenCalled();
		});

		it("should handle file without parent directory", async () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("Meeting.md");
			mockFile.basename = "Meeting";
			mockFile.parent = null;

			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

			const result = await ensureFileHasZettelId(app, mockFile);

			expect(result.zettelId).toMatch(/^\d{14}$/);
			expect(app.fileManager.renameFile).toHaveBeenCalledWith(mockFile, `Meeting-${result.zettelId}.md`);
		});

		it("should generate unique ZettelID when collision occurs", async () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("events/Meeting.md");
			mockFile.basename = "Meeting";
			mockFile.parent = { path: "events" } as any;

			const existingFile = createMockFile("events/Meeting-20250106120000.md");

			vi.mocked(app.vault.getAbstractFileByPath)
				.mockReturnValueOnce(existingFile) // Collision
				.mockReturnValueOnce(null); // Success

			const result = await ensureFileHasZettelId(app, mockFile);

			expect(result.zettelId).toMatch(/^\d{14}$/);
			// Should have checked twice due to collision
			expect(app.vault.getAbstractFileByPath).toHaveBeenCalledTimes(2);
		});

		it("should work without zettelIdProp parameter", async () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("events/Meeting-20250106120000.md");
			mockFile.basename = "Meeting-20250106120000";

			const result = await ensureFileHasZettelId(app, mockFile);

			expect(result.zettelId).toBe("20250106120000");
			expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
		});
	});

	describe("Integration: Batch Clone Scenario", () => {
		it("should handle multiple files with same name getting unique ZettelIDs", () => {
			const app = createMockApp() as unknown as App;

			// First clone - no collision
			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);
			const result1 = generateUniqueEventPath(app, "events", "Meeting");
			expect(result1.zettelId).toMatch(/^\d{14}$/);

			// Simulate first file now exists
			const mockFile1 = createMockFile(`events/Meeting-${result1.zettelId}.md`);

			// Second clone - collision with first
			vi.mocked(app.vault.getAbstractFileByPath)
				.mockReturnValueOnce(mockFile1) // Collision
				.mockReturnValueOnce(null); // Success with incremented ID

			const result2 = generateUniqueEventPath(app, "events", "Meeting");
			expect(result2.zettelId).toMatch(/^\d{14}$/);
			// Should be different from first
			expect(result2.zettelId).not.toBe(result1.zettelId);

			// Third clone - collision with both previous
			const mockFile2 = createMockFile(`events/Meeting-${result2.zettelId}.md`);

			vi.mocked(app.vault.getAbstractFileByPath)
				.mockReturnValueOnce(mockFile1) // First collision
				.mockReturnValueOnce(mockFile2) // Second collision
				.mockReturnValueOnce(null); // Success with doubly-incremented ID

			const result3 = generateUniqueEventPath(app, "events", "Meeting");
			expect(result3.zettelId).toMatch(/^\d{14}$/);
			// Should be different from both previous
			expect(result3.zettelId).not.toBe(result1.zettelId);
			expect(result3.zettelId).not.toBe(result2.zettelId);
		});
	});
});
