import { describe, expect, it } from "vitest";
import { normalizeDirectoryPath, sanitizeForFilename } from "../../src/utils/file-utils";

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
});
