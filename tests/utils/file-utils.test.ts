import { describe, expect, it } from "vitest";
import {
	extractDateAndSuffix,
	normalizeDirectoryPath,
	rebuildPhysicalInstanceFilename,
	sanitizeForFilename,
} from "../../src/utils/file-utils";

describe("File Utilities", () => {
	describe("sanitizeForFilename", () => {
		it("should remove invalid filename characters", () => {
			expect(sanitizeForFilename("file<name>test")).toBe("filenametest");
			expect(sanitizeForFilename("test:file")).toBe("testfile");
			expect(sanitizeForFilename('test"file')).toBe("testfile");
			expect(sanitizeForFilename("test/file")).toBe("testfile");
			expect(sanitizeForFilename("test\\file")).toBe("testfile");
			expect(sanitizeForFilename("test|file")).toBe("testfile");
			expect(sanitizeForFilename("test?file")).toBe("testfile");
			expect(sanitizeForFilename("test*file")).toBe("testfile");
		});

		it("should remove trailing dots", () => {
			expect(sanitizeForFilename("filename...")).toBe("filename");
			expect(sanitizeForFilename("filename.")).toBe("filename");
		});

		it("should trim whitespace", () => {
			expect(sanitizeForFilename("  filename  ")).toBe("filename");
			expect(sanitizeForFilename("\tfilename\t")).toBe("filename");
		});

		it("should preserve spaces and case", () => {
			expect(sanitizeForFilename("My File Name")).toBe("My File Name");
			expect(sanitizeForFilename("CamelCase File")).toBe("CamelCase File");
		});

		it("should handle empty strings", () => {
			expect(sanitizeForFilename("")).toBe("");
			expect(sanitizeForFilename("   ")).toBe("");
		});

		it("should handle multiple invalid characters", () => {
			expect(sanitizeForFilename('test<>:"|file')).toBe("testfile");
		});
	});

	describe("normalizeDirectoryPath", () => {
		it("should remove trailing slashes", () => {
			expect(normalizeDirectoryPath("tasks/")).toBe("tasks");
			expect(normalizeDirectoryPath("tasks///")).toBe("tasks");
		});

		it("should remove leading slashes", () => {
			expect(normalizeDirectoryPath("/tasks")).toBe("tasks");
			expect(normalizeDirectoryPath("///tasks")).toBe("tasks");
		});

		it("should remove both leading and trailing slashes", () => {
			expect(normalizeDirectoryPath("/tasks/")).toBe("tasks");
			expect(normalizeDirectoryPath("///tasks///")).toBe("tasks");
		});

		it("should trim whitespace", () => {
			expect(normalizeDirectoryPath("  tasks  ")).toBe("tasks");
			expect(normalizeDirectoryPath("\ttasks\t")).toBe("tasks");
			expect(normalizeDirectoryPath("  /tasks/  ")).toBe("tasks");
		});

		it("should handle empty strings", () => {
			expect(normalizeDirectoryPath("")).toBe("");
			expect(normalizeDirectoryPath("   ")).toBe("");
			expect(normalizeDirectoryPath("/")).toBe("");
			expect(normalizeDirectoryPath("///")).toBe("");
		});

		it("should preserve internal slashes", () => {
			expect(normalizeDirectoryPath("tasks/homework")).toBe("tasks/homework");
			expect(normalizeDirectoryPath("/tasks/homework/")).toBe("tasks/homework");
			expect(normalizeDirectoryPath("work/projects/2024")).toBe("work/projects/2024");
		});

		it("should handle complex paths", () => {
			expect(normalizeDirectoryPath("  /work/projects/calendar/  ")).toBe("work/projects/calendar");
			expect(normalizeDirectoryPath("///vault/daily notes///")).toBe("vault/daily notes");
		});

		it("should be idempotent", () => {
			const normalized = normalizeDirectoryPath("/tasks/");
			expect(normalizeDirectoryPath(normalized)).toBe(normalized);
			expect(normalizeDirectoryPath(normalized)).toBe("tasks");
		});

		it("should handle paths with spaces", () => {
			expect(normalizeDirectoryPath("my tasks/")).toBe("my tasks");
			expect(normalizeDirectoryPath("/work notes/projects")).toBe("work notes/projects");
		});

		it("should normalize paths consistently for comparison", () => {
			const paths = ["tasks", "/tasks", "tasks/", "/tasks/", "  tasks  ", "///tasks///"];

			const normalized = paths.map((p) => normalizeDirectoryPath(p));
			const allSame = normalized.every((p) => p === "tasks");
			expect(allSame).toBe(true);
		});
	});

	describe("extractDateAndSuffix", () => {
		it("should extract date and suffix from physical instance filename with deterministic zettel hash", () => {
			const result = extractDateAndSuffix("My Event 2025-01-15-12345678901234");
			expect(result).toEqual({
				dateStr: "2025-01-15",
				suffix: "-12345678901234",
			});
		});

		it("should handle filenames with spaces in title", () => {
			const result = extractDateAndSuffix("Team Meeting Notes 2024-12-25-98765432109876");
			expect(result).toEqual({
				dateStr: "2024-12-25",
				suffix: "-98765432109876",
			});
		});

		it("should handle legacy zettel ID format", () => {
			const result = extractDateAndSuffix("My Event 2025-01-15-20251102180628");
			expect(result).toEqual({
				dateStr: "2025-01-15",
				suffix: "-20251102180628",
			});
		});

		it("should handle filenames with multiple dates (uses first match)", () => {
			const result = extractDateAndSuffix("Event from 2024-01-01 scheduled 2024-12-25-12345678901234");
			expect(result).toEqual({
				dateStr: "2024-01-01",
				suffix: " scheduled 2024-12-25-12345678901234",
			});
		});

		it("should return null for filenames without dates", () => {
			expect(extractDateAndSuffix("No Date Here")).toBeNull();
			expect(extractDateAndSuffix("Event-12345678901234")).toBeNull();
			expect(extractDateAndSuffix("")).toBeNull();
		});

		it("should return null for invalid date formats", () => {
			expect(extractDateAndSuffix("Event 2024-1-5-12345678901234")).toBeNull();
			expect(extractDateAndSuffix("Event 24-01-15-12345678901234")).toBeNull();
			expect(extractDateAndSuffix("Event 2024/01/15-12345678901234")).toBeNull();
		});

		it("should handle suffix with no zettel hash", () => {
			const result = extractDateAndSuffix("Simple Event 2025-06-15");
			expect(result).toEqual({
				dateStr: "2025-06-15",
				suffix: "",
			});
		});

		it("should handle suffix with extra content after zettel hash", () => {
			const result = extractDateAndSuffix("Event 2025-03-20-12345678901234 extra content");
			expect(result).toEqual({
				dateStr: "2025-03-20",
				suffix: "-12345678901234 extra content",
			});
		});

		it("should handle dates at different positions in filename", () => {
			const result1 = extractDateAndSuffix("2025-01-15-12345678901234");
			expect(result1).toEqual({
				dateStr: "2025-01-15",
				suffix: "-12345678901234",
			});

			const result2 = extractDateAndSuffix("Event Title 2025-01-15-12345678901234");
			expect(result2).toEqual({
				dateStr: "2025-01-15",
				suffix: "-12345678901234",
			});
		});

		it("should handle edge year values", () => {
			const result1 = extractDateAndSuffix("Event 1999-12-31-12345678901234");
			expect(result1).toEqual({
				dateStr: "1999-12-31",
				suffix: "-12345678901234",
			});

			const result2 = extractDateAndSuffix("Event 2099-01-01-12345678901234");
			expect(result2).toEqual({
				dateStr: "2099-01-01",
				suffix: "-12345678901234",
			});
		});
	});

	describe("rebuildPhysicalInstanceFilename", () => {
		it("should rebuild filename with new title while preserving date and zettel hash suffix", () => {
			const result = rebuildPhysicalInstanceFilename("Old Title 2025-01-15-12345678901234", "New Title");
			expect(result).toBe("New Title 2025-01-15-12345678901234");
		});

		it("should handle legacy timestamp zettel ID format", () => {
			const result = rebuildPhysicalInstanceFilename("Old Title 2025-01-15-20251102180628", "New Title");
			expect(result).toBe("New Title 2025-01-15-20251102180628");
		});

		it("should sanitize new title for filename", () => {
			const result = rebuildPhysicalInstanceFilename("Old Title 2025-01-15-12345678901234", "New<Title>:Test");
			expect(result).toBe("NewTitleTest 2025-01-15-12345678901234");
		});

		it("should preserve deterministic zettel hash suffix", () => {
			const result = rebuildPhysicalInstanceFilename("Old 2025-01-15-98765432109876", "New");
			expect(result).toBe("New 2025-01-15-98765432109876");
		});

		it("should handle titles with spaces", () => {
			const result = rebuildPhysicalInstanceFilename(
				"Old Multi Word Title 2025-06-15-12345678901234",
				"New Multi Word Title"
			);
			expect(result).toBe("New Multi Word Title 2025-06-15-12345678901234");
		});

		it("should return null for invalid current basename (no date)", () => {
			const result = rebuildPhysicalInstanceFilename("No Date Here", "New Title");
			expect(result).toBeNull();
		});

		it("should return null for empty current basename", () => {
			const result = rebuildPhysicalInstanceFilename("", "New Title");
			expect(result).toBeNull();
		});

		it("should handle new title with special characters", () => {
			const result = rebuildPhysicalInstanceFilename("Old Title 2025-01-15-12345678901234", 'New "Title" with/slashes');
			expect(result).toBe("New Title withslashes 2025-01-15-12345678901234");
		});

		it("should preserve suffix without zettel hash", () => {
			const result = rebuildPhysicalInstanceFilename("Old Title 2025-01-15", "New Title");
			expect(result).toBe("New Title 2025-01-15");
		});

		it("should handle suffix with extra content", () => {
			const result = rebuildPhysicalInstanceFilename("Old Title 2025-01-15-12345678901234 extra", "New Title");
			expect(result).toBe("New Title 2025-01-15-12345678901234 extra");
		});

		it("should handle multiple dates in current filename (uses first)", () => {
			const result = rebuildPhysicalInstanceFilename("Event 2024-01-01 and 2024-12-25-12345678901234", "New");
			expect(result).toBe("New 2024-01-01 and 2024-12-25-12345678901234");
		});

		it("should trim whitespace from new title", () => {
			const result = rebuildPhysicalInstanceFilename("Old Title 2025-01-15-12345678901234", "  New Title  ");
			expect(result).toBe("New Title 2025-01-15-12345678901234");
		});

		it("should handle new title with trailing dots", () => {
			const result = rebuildPhysicalInstanceFilename("Old Title 2025-01-15-12345678901234", "New Title...");
			expect(result).toBe("New Title 2025-01-15-12345678901234");
		});

		it("should handle new title matching old title", () => {
			const result = rebuildPhysicalInstanceFilename("Same Title 2025-01-15-12345678901234", "Same Title");
			expect(result).toBe("Same Title 2025-01-15-12345678901234");
		});

		it("should handle complex real-world examples with deterministic zettel format", () => {
			const result1 = rebuildPhysicalInstanceFilename(
				"Team Meeting Weekly 2025-01-15-11111111111111",
				"Team Meeting Bi-Weekly"
			);
			expect(result1).toBe("Team Meeting Bi-Weekly 2025-01-15-11111111111111");

			const result2 = rebuildPhysicalInstanceFilename(
				"Project Review Q1 2025-03-20-22222222222222",
				"Project Review Q2"
			);
			expect(result2).toBe("Project Review Q2 2025-03-20-22222222222222");

			const result3 = rebuildPhysicalInstanceFilename(
				"Daily Standup @ 9AM 2025-06-15-33333333333333",
				"Daily Standup @ 10AM"
			);
			expect(result3).toBe("Daily Standup @ 10AM 2025-06-15-33333333333333");
		});
	});
});
