import { describe, expect, it } from "vitest";

import {
	sanitizeFilenameKebabCase,
	sanitizeFilenamePreserveSpaces,
	sanitizeForFilename,
} from "../../src/core/file/file";
import {
	extractDateAndSuffix,
	normalizeDirectoryPath,
	rebuildPhysicalInstanceFilename,
} from "../../src/utils/string/filename-utils";

describe("sanitizeForFilename", () => {
	describe("default behavior (kebab-case)", () => {
		it("should use kebab-case by default", () => {
			expect(sanitizeForFilename("My File Name")).toBe("my-file-name");
		});

		it("should convert to kebab-case when no options provided", () => {
			expect(sanitizeForFilename("Travel Around The World")).toBe("travel-around-the-world");
		});
	});

	describe("kebab style", () => {
		it("should convert to kebab-case with explicit option", () => {
			expect(sanitizeForFilename("My File Name", { style: "kebab" })).toBe("my-file-name");
		});

		it("should handle special characters", () => {
			expect(sanitizeForFilename("File<Invalid>Chars", { style: "kebab" })).toBe("fileinvalidchars");
		});
	});

	describe("preserve style", () => {
		it("should preserve spaces and case", () => {
			expect(sanitizeForFilename("My File Name", { style: "preserve" })).toBe("My File Name");
		});

		it("should preserve case and special chars", () => {
			expect(sanitizeForFilename("Travel – Paris Visit", { style: "preserve" })).toBe("Travel – Paris Visit");
		});

		it("should still remove invalid chars", () => {
			expect(sanitizeForFilename("File<Invalid>Chars", { style: "preserve" })).toBe("FileInvalidChars");
		});
	});
});

describe("sanitizeFilenameKebabCase", () => {
	it("should remove invalid filename characters", () => {
		expect(sanitizeFilenameKebabCase("test<file>name")).toBe("testfilename");
		expect(sanitizeFilenameKebabCase('test:file"name')).toBe("testfilename");
		expect(sanitizeFilenameKebabCase("test/file\\name")).toBe("testfilename");
		expect(sanitizeFilenameKebabCase("test|file?name")).toBe("testfilename");
		expect(sanitizeFilenameKebabCase("test*filename")).toBe("testfilename");
	});

	it("should convert spaces to hyphens", () => {
		expect(sanitizeFilenameKebabCase("My File Name")).toBe("my-file-name");
		expect(sanitizeFilenameKebabCase("Travel Around The World")).toBe("travel-around-the-world");
	});

	it("should convert to lowercase", () => {
		expect(sanitizeFilenameKebabCase("CamelCase File")).toBe("camelcase-file");
		expect(sanitizeFilenameKebabCase("UPPERCASE")).toBe("uppercase");
	});

	it("should collapse multiple spaces/hyphens", () => {
		expect(sanitizeFilenameKebabCase("Multiple  Spaces")).toBe("multiple-spaces");
		expect(sanitizeFilenameKebabCase("Already--Has---Hyphens")).toBe("already-has-hyphens");
	});

	it("should remove leading/trailing hyphens", () => {
		expect(sanitizeFilenameKebabCase("-leading")).toBe("leading");
		expect(sanitizeFilenameKebabCase("trailing-")).toBe("trailing");
		expect(sanitizeFilenameKebabCase("-both-")).toBe("both");
	});

	it("should handle special characters", () => {
		// Note: Special chars like en dash (–) and parentheses () are preserved
		expect(sanitizeFilenameKebabCase("Travel – Paris Visit")).toBe("travel-–-paris-visit");
		expect(sanitizeFilenameKebabCase("Project (2024)")).toBe("project-(2024)");
	});

	it("should handle empty string", () => {
		expect(sanitizeFilenameKebabCase("")).toBe("");
	});

	it("should handle string with only invalid characters", () => {
		expect(sanitizeFilenameKebabCase('<>:"/\\|?*')).toBe("");
	});
});

describe("sanitizeFilenamePreserveSpaces", () => {
	it("should remove invalid filename characters", () => {
		expect(sanitizeFilenamePreserveSpaces("test<file>name")).toBe("testfilename");
		expect(sanitizeFilenamePreserveSpaces('test:file"name')).toBe("testfilename");
		expect(sanitizeFilenamePreserveSpaces("test/file\\name")).toBe("testfilename");
		expect(sanitizeFilenamePreserveSpaces("test|file?name")).toBe("testfilename");
		expect(sanitizeFilenamePreserveSpaces("test*filename")).toBe("testfilename");
	});

	it("should preserve spaces and case", () => {
		expect(sanitizeFilenamePreserveSpaces("My File Name")).toBe("My File Name");
		expect(sanitizeFilenamePreserveSpaces("Travel Around The World")).toBe("Travel Around The World");
		expect(sanitizeFilenamePreserveSpaces("CamelCase File")).toBe("CamelCase File");
	});

	it("should remove trailing dots", () => {
		expect(sanitizeFilenamePreserveSpaces("filename.")).toBe("filename");
		expect(sanitizeFilenamePreserveSpaces("filename...")).toBe("filename");
		expect(sanitizeFilenamePreserveSpaces("file.name.")).toBe("file.name");
	});

	it("should preserve dots that are not trailing", () => {
		expect(sanitizeFilenamePreserveSpaces("file.name")).toBe("file.name");
		expect(sanitizeFilenamePreserveSpaces("file.name.txt")).toBe("file.name.txt");
	});

	it("should trim leading and trailing whitespace", () => {
		expect(sanitizeFilenamePreserveSpaces("  filename  ")).toBe("filename");
		expect(sanitizeFilenamePreserveSpaces("\tfilename\n")).toBe("filename");
	});

	it("should handle special characters correctly", () => {
		expect(sanitizeFilenamePreserveSpaces("Travel – Paris Visit")).toBe("Travel – Paris Visit");
		expect(sanitizeFilenamePreserveSpaces("Project (2024)")).toBe("Project (2024)");
		expect(sanitizeFilenamePreserveSpaces("File [draft]")).toBe("File [draft]");
	});

	it("should handle empty string", () => {
		expect(sanitizeFilenamePreserveSpaces("")).toBe("");
	});

	it("should handle string with only invalid characters", () => {
		expect(sanitizeFilenamePreserveSpaces('<>:"/\\|?*')).toBe("");
	});

	it("should handle unicode characters", () => {
		expect(sanitizeFilenamePreserveSpaces("文件名")).toBe("文件名");
		expect(sanitizeFilenamePreserveSpaces("Файл")).toBe("Файл");
		expect(sanitizeFilenamePreserveSpaces("émojis 🎉")).toBe("émojis 🎉");
	});
});

describe("normalizeDirectoryPath", () => {
	it("should remove trailing slash", () => {
		expect(normalizeDirectoryPath("tasks/")).toBe("tasks");
		expect(normalizeDirectoryPath("tasks/homework/")).toBe("tasks/homework");
	});

	it("should remove leading slash", () => {
		expect(normalizeDirectoryPath("/tasks")).toBe("tasks");
		expect(normalizeDirectoryPath("/tasks/homework")).toBe("tasks/homework");
	});

	it("should remove both leading and trailing slashes", () => {
		expect(normalizeDirectoryPath("/tasks/")).toBe("tasks");
		expect(normalizeDirectoryPath("//tasks//")).toBe("tasks");
	});

	it("should trim whitespace", () => {
		expect(normalizeDirectoryPath("  tasks  ")).toBe("tasks");
		expect(normalizeDirectoryPath("\ttasks\n")).toBe("tasks");
	});

	it("should handle empty string", () => {
		expect(normalizeDirectoryPath("")).toBe("");
		expect(normalizeDirectoryPath("   ")).toBe("");
	});

	it("should handle nested paths", () => {
		expect(normalizeDirectoryPath("tasks/homework")).toBe("tasks/homework");
		expect(normalizeDirectoryPath("/projects/2024/travel/")).toBe("projects/2024/travel");
	});

	it("should handle single slash", () => {
		expect(normalizeDirectoryPath("/")).toBe("");
		expect(normalizeDirectoryPath("//")).toBe("");
	});

	it("should preserve internal slashes", () => {
		expect(normalizeDirectoryPath("tasks/homework/math")).toBe("tasks/homework/math");
	});
});

describe("extractDateAndSuffix", () => {
	it("should extract date and suffix from valid filename", () => {
		const result = extractDateAndSuffix("My Event 2025-01-15-ABC123");
		expect(result).toEqual({
			dateStr: "2025-01-15",
			suffix: "-ABC123",
		});
	});

	it("should handle filename with only date", () => {
		const result = extractDateAndSuffix("Event 2025-01-15");
		expect(result).toEqual({
			dateStr: "2025-01-15",
			suffix: "",
		});
	});

	it("should handle complex titles", () => {
		const result = extractDateAndSuffix("Travel Around The World – Paris Visit 2025-12-31-XYZ789");
		expect(result).toEqual({
			dateStr: "2025-12-31",
			suffix: "-XYZ789",
		});
	});

	it("should return null for filename without date", () => {
		expect(extractDateAndSuffix("My Event")).toBeNull();
		expect(extractDateAndSuffix("Random filename")).toBeNull();
	});

	it("should return null for invalid date format", () => {
		expect(extractDateAndSuffix("Event 25-01-2025")).toBeNull();
		expect(extractDateAndSuffix("Event 2025/01/15")).toBeNull();
	});

	it("should use first date if multiple dates present", () => {
		const result = extractDateAndSuffix("Event 2025-01-15 moved from 2025-01-10");
		expect(result).toEqual({
			dateStr: "2025-01-15",
			suffix: " moved from 2025-01-10",
		});
	});

	it("should handle date at beginning of filename", () => {
		const result = extractDateAndSuffix("2025-01-15-ABC123 My Event");
		expect(result).toEqual({
			dateStr: "2025-01-15",
			suffix: "-ABC123 My Event",
		});
	});

	it("should handle long suffix", () => {
		const result = extractDateAndSuffix("Event 2025-01-15-ABC123 with lots of additional information");
		expect(result).toEqual({
			dateStr: "2025-01-15",
			suffix: "-ABC123 with lots of additional information",
		});
	});
});

describe("rebuildPhysicalInstanceFilename", () => {
	it("should rebuild filename with new title", () => {
		const result = rebuildPhysicalInstanceFilename("Old Title 2025-01-15-ABC123", "New Title");
		expect(result).toBe("New Title 2025-01-15-ABC123");
	});

	it("should strip zettel ID from new title (14-digit numeric format)", () => {
		const result = rebuildPhysicalInstanceFilename("Old Title 2025-01-15-ABC123", "New Title-20250203140530");
		expect(result).toBe("New Title 2025-01-15-ABC123");
	});

	it("should strip space-separated zettel ID from new title", () => {
		const result = rebuildPhysicalInstanceFilename("Old Title 2025-01-15-ABC123", "New Title 20250203140530");
		expect(result).toBe("New Title 2025-01-15-ABC123");
	});

	it("should correctly rename when new title is a source event basename with zettel ID", () => {
		// Real scenario: source file "Team Meeting-20250203140530" renamed to "Project Planning-20250203140530"
		// recurringEvent.title = file.basename = "Project Planning-20250203140530"
		const result = rebuildPhysicalInstanceFilename(
			"Team Meeting 2025-01-15-00001125853328",
			"Project Planning-20250203140530"
		);
		expect(result).toBe("Project Planning 2025-01-15-00001125853328");
	});

	it("should sanitize new title", () => {
		const result = rebuildPhysicalInstanceFilename("Old Title 2025-01-15-ABC123", 'New<Title>With:Invalid"Chars');
		expect(result).toBe("NewTitleWithInvalidChars 2025-01-15-ABC123");
	});

	it("should return null for invalid current basename", () => {
		const result = rebuildPhysicalInstanceFilename("No Date Here", "New Title");
		expect(result).toBeNull();
	});

	it("should preserve date and suffix exactly", () => {
		const result = rebuildPhysicalInstanceFilename("Complex Title 2025-12-31-XYZ789", "Simpler Title");
		expect(result).toBe("Simpler Title 2025-12-31-XYZ789");
	});

	it("should handle complex original titles", () => {
		const result = rebuildPhysicalInstanceFilename(
			"Travel Around The World – Paris Visit 2025-06-15-ABC123",
			"Short Trip"
		);
		expect(result).toBe("Short Trip 2025-06-15-ABC123");
	});

	it("should handle new title with spaces and special characters", () => {
		const result = rebuildPhysicalInstanceFilename("Old 2025-01-15-ABC123", "New Title – With Dash");
		expect(result).toBe("New Title – With Dash 2025-01-15-ABC123");
	});

	it("should preserve empty suffix", () => {
		const result = rebuildPhysicalInstanceFilename("Old Title 2025-01-15", "New Title");
		expect(result).toBe("New Title 2025-01-15");
	});

	it("should handle new title with trailing whitespace", () => {
		const result = rebuildPhysicalInstanceFilename("Old 2025-01-15-ABC123", "  New Title  ");
		expect(result).toBe("New Title 2025-01-15-ABC123");
	});

	it("should handle new title with trailing dots", () => {
		const result = rebuildPhysicalInstanceFilename("Old 2025-01-15-ABC123", "New Title...");
		expect(result).toBe("New Title 2025-01-15-ABC123");
	});
});

describe("integration: filename operations", () => {
	it("should rebuild filename after sanitization with preserve style", () => {
		const originalBasename = "Old Title 2025-01-15-ABC123";
		const newUnsanitizedTitle = "Unsafe<Title>:Name";

		const sanitized = sanitizeFilenamePreserveSpaces(newUnsanitizedTitle);
		expect(sanitized).toBe("UnsafeTitleName");

		const rebuilt = rebuildPhysicalInstanceFilename(originalBasename, sanitized);
		expect(rebuilt).toBe("UnsafeTitleName 2025-01-15-ABC123");
	});

	it("should handle directory normalization with filename operations", () => {
		const directory = "/projects/2024/";
		const normalized = normalizeDirectoryPath(directory);
		expect(normalized).toBe("projects/2024");

		const filename = sanitizeFilenamePreserveSpaces("My Project 2025-01-15-ABC123");
		const fullPath = `${normalized}/${filename}`;
		expect(fullPath).toBe("projects/2024/My Project 2025-01-15-ABC123");
	});

	it("should demonstrate kebab-case vs preserve difference", () => {
		const title = "Travel Around The World";

		const kebab = sanitizeFilenameKebabCase(title);
		expect(kebab).toBe("travel-around-the-world");

		const preserved = sanitizeFilenamePreserveSpaces(title);
		expect(preserved).toBe("Travel Around The World");

		// Using the main function
		expect(sanitizeForFilename(title)).toBe("travel-around-the-world"); // default
		expect(sanitizeForFilename(title, { style: "kebab" })).toBe("travel-around-the-world");
		expect(sanitizeForFilename(title, { style: "preserve" })).toBe("Travel Around The World");
	});

	it("should extract and rebuild in sequence", () => {
		const original = "Complex Title – With Special Chars 2025-06-15-XYZ789";

		const extracted = extractDateAndSuffix(original);
		expect(extracted).not.toBeNull();
		expect(extracted?.dateStr).toBe("2025-06-15");
		expect(extracted?.suffix).toBe("-XYZ789");

		const rebuilt = rebuildPhysicalInstanceFilename(original, "Simple Title");
		expect(rebuilt).toBe("Simple Title 2025-06-15-XYZ789");
	});
});
