import { describe, expect, it } from "vitest";

import {
	createFileLink,
	extractFilePathFromLink,
	formatWikiLink,
	parsePropertyLinks,
	parseWikiLink,
} from "../../src/core/file";
import { createMockFile } from "../../src/testing";

describe("extractFilePathFromLink", () => {
	describe("Valid Obsidian link formats", () => {
		it("should extract simple file name and add .md extension", () => {
			expect(extractFilePathFromLink("[[FileName]]")).toBe("FileName.md");
		});

		it("should extract file name with folder path and add .md extension", () => {
			expect(extractFilePathFromLink("[[Folder/FileName]]")).toBe("Folder/FileName.md");
		});

		it("should extract nested folder path and add .md extension", () => {
			expect(extractFilePathFromLink("[[Folder/SubFolder/FileName]]")).toBe("Folder/SubFolder/FileName.md");
		});

		it("should extract file name with display name and add .md extension", () => {
			expect(extractFilePathFromLink("[[FileName|Display Name]]")).toBe("FileName.md");
		});

		it("should extract folder path with display name and add .md extension", () => {
			expect(extractFilePathFromLink("[[Folder/FileName|Display Name]]")).toBe("Folder/FileName.md");
		});

		it("should extract nested folder path with display name and add .md extension", () => {
			expect(extractFilePathFromLink("[[Folder/SubFolder/FileName|Display Name]]")).toBe(
				"Folder/SubFolder/FileName.md"
			);
		});

		it("should preserve .md extension when already present", () => {
			expect(extractFilePathFromLink("[[FileName.md]]")).toBe("FileName.md");
		});

		it("should preserve .md extension in folder path when already present", () => {
			expect(extractFilePathFromLink("[[Folder/FileName.md]]")).toBe("Folder/FileName.md");
		});

		it("should preserve .md extension with display name when already present", () => {
			expect(extractFilePathFromLink("[[FileName.md|Display Name]]")).toBe("FileName.md");
		});

		it("should preserve .md extension in folder path with display name when already present", () => {
			expect(extractFilePathFromLink("[[Folder/FileName.md|Display Name]]")).toBe("Folder/FileName.md");
		});
	});

	describe("Special characters and edge cases", () => {
		it("should handle file names with spaces", () => {
			expect(extractFilePathFromLink("[[File Name With Spaces]]")).toBe("File Name With Spaces.md");
		});

		it("should handle file names with numbers", () => {
			expect(extractFilePathFromLink("[[File123]]")).toBe("File123.md");
		});

		it("should handle file names with hyphens and underscores", () => {
			expect(extractFilePathFromLink("[[File-Name_With-Special_Chars]]")).toBe("File-Name_With-Special_Chars.md");
		});

		it("should handle file names with dots (but not .md)", () => {
			expect(extractFilePathFromLink("[[File.Name.txt]]")).toBe("File.Name.txt.md");
		});

		it("should handle complex display names with special characters", () => {
			expect(extractFilePathFromLink("[[FileName|Display: Name & More!]]")).toBe("FileName.md");
		});

		it("should handle display names with pipes (escaped)", () => {
			expect(extractFilePathFromLink("[[FileName|Display Name]]")).toBe("FileName.md");
		});

		it("should handle folder names with spaces", () => {
			expect(extractFilePathFromLink("[[Folder With Spaces/FileName]]")).toBe("Folder With Spaces/FileName.md");
		});

		it("should handle multiple levels of nested folders with spaces", () => {
			expect(extractFilePathFromLink("[[Parent Folder/Sub Folder/File Name]]")).toBe(
				"Parent Folder/Sub Folder/File Name.md"
			);
		});

		it("should handle empty display name", () => {
			expect(extractFilePathFromLink("[[FileName|]]")).toBe("FileName.md");
		});

		it("should handle display name with only spaces", () => {
			expect(extractFilePathFromLink("[[FileName|   ]]")).toBe("FileName.md");
		});
	});

	describe("Invalid link formats", () => {
		it("should return null for empty string", () => {
			expect(extractFilePathFromLink("")).toBe(null);
		});

		it("should return null for plain text without brackets", () => {
			expect(extractFilePathFromLink("FileName")).toBe(null);
		});

		it("should return null for single bracket", () => {
			expect(extractFilePathFromLink("[FileName]")).toBe(null);
		});

		it("should return null for mismatched brackets", () => {
			expect(extractFilePathFromLink("[[FileName]")).toBe(null);
			expect(extractFilePathFromLink("[FileName]]")).toBe(null);
		});

		it("should return null for empty brackets", () => {
			expect(extractFilePathFromLink("[[]]")).toBe(null);
		});

		it("should return null for brackets with only spaces", () => {
			expect(extractFilePathFromLink("[[   ]]")).toBe(null);
		});

		it("should return null for brackets with only pipe", () => {
			expect(extractFilePathFromLink("[[|]]")).toBe(null);
		});

		it("should return null for brackets with only display name", () => {
			expect(extractFilePathFromLink("[[|Display Name]]")).toBe(null);
		});

		it("should return null for malformed link with multiple pipes", () => {
			expect(extractFilePathFromLink("[[FileName|Display|Extra]]")).toBe("FileName.md");
		});

		it("should return null for nested brackets", () => {
			expect(extractFilePathFromLink("[[File[[Name]]]]")).toBe(null);
		});

		it("should return null for text with brackets but not at start/end", () => {
			expect(extractFilePathFromLink("Some text [[FileName]] more text")).toBe("FileName.md");
		});
	});

	describe("Whitespace handling", () => {
		it("should trim leading and trailing spaces in file name", () => {
			expect(extractFilePathFromLink("[[  FileName  ]]")).toBe("FileName.md");
		});

		it("should trim leading and trailing spaces in folder path", () => {
			expect(extractFilePathFromLink("[[  Folder/FileName  ]]")).toBe("Folder/FileName.md");
		});

		it("should trim spaces around pipe separator", () => {
			expect(extractFilePathFromLink("[[FileName | Display Name]]")).toBe("FileName.md");
		});

		it("should trim tabs and other whitespace characters", () => {
			expect(extractFilePathFromLink("[[\tFileName\t]]")).toBe("FileName.md");
		});
	});

	describe("Real-world examples", () => {
		it("should handle typical goal file link", () => {
			expect(extractFilePathFromLink("[[Goals/Achieve Financial Freedom|Achieve Financial Freedom]]")).toBe(
				"Goals/Achieve Financial Freedom.md"
			);
		});

		it("should handle typical project file link", () => {
			expect(extractFilePathFromLink("[[Projects/SecondBrain Automation]]")).toBe("Projects/SecondBrain Automation.md");
		});

		it("should handle typical task file link", () => {
			expect(extractFilePathFromLink("[[Tasks/(Daily) Review Goals|Review Goals]]")).toBe(
				"Tasks/(Daily) Review Goals.md"
			);
		});

		it("should handle typical note file link with date", () => {
			expect(extractFilePathFromLink("[[Notes/2024-01-15 Meeting Notes]]")).toBe("Notes/2024-01-15 Meeting Notes.md");
		});

		it("should handle information file link", () => {
			expect(extractFilePathFromLink("[[Information/Programming Concepts|Programming Concepts]]")).toBe(
				"Information/Programming Concepts.md"
			);
		});

		it("should handle author file link", () => {
			expect(extractFilePathFromLink("[[Authors/Alex Hormozi]]")).toBe("Authors/Alex Hormozi.md");
		});

		it("should handle book file link", () => {
			expect(extractFilePathFromLink("[[Books/Atomic Habits|Atomic Habits]]")).toBe("Books/Atomic Habits.md");
		});

		it("should handle video file link", () => {
			expect(extractFilePathFromLink("[[Videos/How to Build Wealth in Your 20s]]")).toBe(
				"Videos/How to Build Wealth in Your 20s.md"
			);
		});
	});

	describe("Edge cases with file extensions", () => {
		it("should not double-add .md extension", () => {
			expect(extractFilePathFromLink("[[FileName.md]]")).toBe("FileName.md");
		});

		it("should add .md to files with other extensions", () => {
			expect(extractFilePathFromLink("[[FileName.txt]]")).toBe("FileName.txt.md");
			expect(extractFilePathFromLink("[[FileName.pdf]]")).toBe("FileName.pdf.md");
			expect(extractFilePathFromLink("[[FileName.docx]]")).toBe("FileName.docx.md");
		});

		it("should handle case-insensitive .md extension", () => {
			expect(extractFilePathFromLink("[[FileName.MD]]")).toBe("FileName.MD.md");
			expect(extractFilePathFromLink("[[FileName.Md]]")).toBe("FileName.Md.md");
		});

		it("should handle .md in the middle of filename", () => {
			expect(extractFilePathFromLink("[[File.md.backup]]")).toBe("File.md.backup.md");
		});
	});

	describe("Unicode and international characters", () => {
		it("should handle Unicode characters in file names", () => {
			expect(extractFilePathFromLink("[[Файл]]")).toBe("Файл.md");
		});

		it("should handle emoji in file names", () => {
			expect(extractFilePathFromLink("[[📝 Notes]]")).toBe("📝 Notes.md");
		});

		it("should handle accented characters", () => {
			expect(extractFilePathFromLink("[[Café Notes]]")).toBe("Café Notes.md");
		});

		it("should handle Chinese characters", () => {
			expect(extractFilePathFromLink("[[中文文件]]")).toBe("中文文件.md");
		});

		it("should handle mixed international characters", () => {
			expect(extractFilePathFromLink("[[Folder/文件名-Notes-📝|Display]]")).toBe("Folder/文件名-Notes-📝.md");
		});
	});
});

describe("createFileLink", () => {
	describe("Files in root directory", () => {
		it("should create link for file in root directory", () => {
			const file = createMockFile("TestFile.md", { basename: "TestFile" });
			expect(createFileLink(file)).toBe("[[TestFile]]");
		});

		it("should create link for file with spaces in root directory", () => {
			const file = createMockFile("Test File With Spaces.md", {
				basename: "Test File With Spaces",
			});
			expect(createFileLink(file)).toBe("[[Test File With Spaces]]");
		});

		it("should create link for file with special characters in root directory", () => {
			const file = createMockFile("Test-File_With-Special_Chars.md", {
				basename: "Test-File_With-Special_Chars",
			});
			expect(createFileLink(file)).toBe("[[Test-File_With-Special_Chars]]");
		});

		it("should create link for file with numbers in root directory", () => {
			const file = createMockFile("File123.md", { basename: "File123" });
			expect(createFileLink(file)).toBe("[[File123]]");
		});

		it("should create link for file with dots in root directory", () => {
			const file = createMockFile("File.Name.txt", { basename: "File.Name.txt" });
			expect(createFileLink(file)).toBe("[[File.Name.txt]]");
		});
	});

	describe("Files in subdirectories", () => {
		it("should create link for file in single subdirectory", () => {
			const file = createMockFile("Folder/TestFile.md", {
				basename: "TestFile",
				parentPath: "Folder",
			});
			expect(createFileLink(file)).toBe("[[Folder/TestFile|TestFile]]");
		});

		it("should create link for file in nested subdirectories", () => {
			const file = createMockFile("Folder/SubFolder/TestFile.md", {
				basename: "TestFile",
				parentPath: "Folder/SubFolder",
			});
			expect(createFileLink(file)).toBe("[[Folder/SubFolder/TestFile|TestFile]]");
		});

		it("should create link for file in deeply nested subdirectories", () => {
			const file = createMockFile("Level1/Level2/Level3/Level4/TestFile.md", {
				basename: "TestFile",
				parentPath: "Level1/Level2/Level3/Level4",
			});
			expect(createFileLink(file)).toBe("[[Level1/Level2/Level3/Level4/TestFile|TestFile]]");
		});

		it("should create link for file with spaces in folder with spaces", () => {
			const file = createMockFile("Folder With Spaces/Test File.md", {
				basename: "Test File",
				parentPath: "Folder With Spaces",
			});
			expect(createFileLink(file)).toBe("[[Folder With Spaces/Test File|Test File]]");
		});

		it("should create link for file in folder with special characters", () => {
			const file = createMockFile("Folder-Name_With-Special_Chars/TestFile.md", {
				basename: "TestFile",
				parentPath: "Folder-Name_With-Special_Chars",
			});
			expect(createFileLink(file)).toBe("[[Folder-Name_With-Special_Chars/TestFile|TestFile]]");
		});
	});

	describe("Edge cases with parent paths", () => {
		it("should handle parent path as root slash", () => {
			const file = createMockFile("TestFile.md", { basename: "TestFile", parentPath: "/" });
			expect(createFileLink(file)).toBe("[[TestFile]]");
		});

		it("should handle empty parent path", () => {
			const file = createMockFile("TestFile.md", { basename: "TestFile", parentPath: "" });
			expect(createFileLink(file)).toBe("[[TestFile]]");
		});

		it("should handle null parent", () => {
			const file = createMockFile("TestFile.md", { basename: "TestFile" });
			file.parent = null;
			expect(createFileLink(file)).toBe("[[TestFile]]");
		});

		it("should handle undefined parent", () => {
			const file = createMockFile("TestFile.md", { basename: "TestFile" });
			file.parent = undefined as any;
			expect(createFileLink(file)).toBe("[[TestFile]]");
		});
	});

	describe("Real-world examples", () => {
		it("should create link for goal file", () => {
			const file = createMockFile("Goals/Achieve Financial Freedom.md", {
				basename: "Achieve Financial Freedom",
				parentPath: "Goals",
			});
			expect(createFileLink(file)).toBe("[[Goals/Achieve Financial Freedom|Achieve Financial Freedom]]");
		});

		it("should create link for project file", () => {
			const file = createMockFile("Projects/SecondBrain Automation.md", {
				basename: "SecondBrain Automation",
				parentPath: "Projects",
			});
			expect(createFileLink(file)).toBe("[[Projects/SecondBrain Automation|SecondBrain Automation]]");
		});

		it("should create link for task file with parentheses", () => {
			const file = createMockFile("Tasks/(Daily) Review Goals.md", {
				basename: "(Daily) Review Goals",
				parentPath: "Tasks",
			});
			expect(createFileLink(file)).toBe("[[Tasks/(Daily) Review Goals|(Daily) Review Goals]]");
		});

		it("should create link for note file with date", () => {
			const file = createMockFile("Notes/2024-01-15 Meeting Notes.md", {
				basename: "2024-01-15 Meeting Notes",
				parentPath: "Notes",
			});
			expect(createFileLink(file)).toBe("[[Notes/2024-01-15 Meeting Notes|2024-01-15 Meeting Notes]]");
		});

		it("should create link for information file", () => {
			const file = createMockFile("Information/Programming Concepts.md", {
				basename: "Programming Concepts",
				parentPath: "Information",
			});
			expect(createFileLink(file)).toBe("[[Information/Programming Concepts|Programming Concepts]]");
		});

		it("should create link for author file", () => {
			const file = createMockFile("Authors/Alex Hormozi.md", {
				basename: "Alex Hormozi",
				parentPath: "Authors",
			});
			expect(createFileLink(file)).toBe("[[Authors/Alex Hormozi|Alex Hormozi]]");
		});

		it("should create link for book file", () => {
			const file = createMockFile("Books/Atomic Habits.md", {
				basename: "Atomic Habits",
				parentPath: "Books",
			});
			expect(createFileLink(file)).toBe("[[Books/Atomic Habits|Atomic Habits]]");
		});

		it("should create link for video file", () => {
			const file = createMockFile("Videos/How to Build Wealth in Your 20s.md", {
				basename: "How to Build Wealth in Your 20s",
				parentPath: "Videos",
			});
			expect(createFileLink(file)).toBe("[[Videos/How to Build Wealth in Your 20s|How to Build Wealth in Your 20s]]");
		});

		it("should create link for tag file", () => {
			const file = createMockFile("Tags/Machine Learning/Machine Learning.md", {
				basename: "Machine Learning",
				parentPath: "Tags/Machine Learning",
			});
			expect(createFileLink(file)).toBe("[[Tags/Machine Learning/Machine Learning|Machine Learning]]");
		});
	});

	describe("Unicode and international characters", () => {
		it("should handle Unicode characters in file names", () => {
			const file = createMockFile("Папка/Файл.md", { basename: "Файл", parentPath: "Папка" });
			expect(createFileLink(file)).toBe("[[Папка/Файл|Файл]]");
		});

		it("should handle emoji in file names", () => {
			const file = createMockFile("Folders/📝 Notes.md", {
				basename: "📝 Notes",
				parentPath: "Folders",
			});
			expect(createFileLink(file)).toBe("[[Folders/📝 Notes|📝 Notes]]");
		});

		it("should handle accented characters", () => {
			const file = createMockFile("Français/Café Notes.md", {
				basename: "Café Notes",
				parentPath: "Français",
			});
			expect(createFileLink(file)).toBe("[[Français/Café Notes|Café Notes]]");
		});

		it("should handle Chinese characters", () => {
			const file = createMockFile("中文文件夹/中文文件.md", {
				basename: "中文文件",
				parentPath: "中文文件夹",
			});
			expect(createFileLink(file)).toBe("[[中文文件夹/中文文件|中文文件]]");
		});

		it("should handle mixed international characters", () => {
			const file = createMockFile("Folder/子文件夹/文件名-Notes-📝.md", {
				basename: "文件名-Notes-📝",
				parentPath: "Folder/子文件夹",
			});
			expect(createFileLink(file)).toBe("[[Folder/子文件夹/文件名-Notes-📝|文件名-Notes-📝]]");
		});
	});

	describe("Complex nested structures", () => {
		it("should handle deeply nested journal structure", () => {
			const file = createMockFile("Journal/2024/January/Week1/Daily Reflection.md", {
				basename: "Daily Reflection",
				parentPath: "Journal/2024/January/Week1",
			});
			expect(createFileLink(file)).toBe("[[Journal/2024/January/Week1/Daily Reflection|Daily Reflection]]");
		});

		it("should handle project with subprojects", () => {
			const file = createMockFile("Projects/SecondBrain/Development/Frontend Implementation.md", {
				basename: "Frontend Implementation",
				parentPath: "Projects/SecondBrain/Development",
			});
			expect(createFileLink(file)).toBe(
				"[[Projects/SecondBrain/Development/Frontend Implementation|Frontend Implementation]]"
			);
		});

		it("should handle categorized information", () => {
			const file = createMockFile("Information/Programming/JavaScript/React/React Hooks.md", {
				basename: "React Hooks",
				parentPath: "Information/Programming/JavaScript/React",
			});
			expect(createFileLink(file)).toBe("[[Information/Programming/JavaScript/React/React Hooks|React Hooks]]");
		});
	});

	describe("Edge cases with special file names", () => {
		it("should handle file names with brackets", () => {
			const file = createMockFile("Drafts/File [Version 2].md", {
				basename: "File [Version 2]",
				parentPath: "Drafts",
			});
			expect(createFileLink(file)).toBe("[[Drafts/File [Version 2]|File [Version 2]]]");
		});

		it("should handle file names with pipes", () => {
			const file = createMockFile("Decisions/Option A | Option B.md", {
				basename: "Option A | Option B",
				parentPath: "Decisions",
			});
			expect(createFileLink(file)).toBe("[[Decisions/Option A | Option B|Option A | Option B]]");
		});

		it("should handle file names with colons", () => {
			const file = createMockFile("Notes/Meeting: Project Review.md", {
				basename: "Meeting: Project Review",
				parentPath: "Notes",
			});
			expect(createFileLink(file)).toBe("[[Notes/Meeting: Project Review|Meeting: Project Review]]");
		});

		it("should handle file names with quotes", () => {
			const file = createMockFile('Reviews/Book "The Art of War".md', {
				basename: 'Book "The Art of War"',
				parentPath: "Reviews",
			});
			expect(createFileLink(file)).toBe('[[Reviews/Book "The Art of War"|Book "The Art of War"]]');
		});

		it("should handle very long file names", () => {
			const longName =
				"This is a very long file name that might be used in some edge cases where users create extremely detailed file names with lots of descriptive text";
			const file = createMockFile(`LongNames/${longName}.md`, {
				basename: longName,
				parentPath: "LongNames",
			});
			expect(createFileLink(file)).toBe(`[[LongNames/${longName}|${longName}]]`);
		});
	});
});

describe("parseWikiLink", () => {
	it("should parse simple wiki link", () => {
		expect(parseWikiLink("[[Projects/My Project]]")).toBe("Projects/My Project");
	});

	it("should parse wiki link with display name", () => {
		expect(parseWikiLink("[[Projects/My Project|My Project]]")).toBe("Projects/My Project");
	});

	it("should handle links with spaces", () => {
		expect(parseWikiLink("[[Projects/Some Project Name]]")).toBe("Projects/Some Project Name");
	});

	it("should return null for invalid formats", () => {
		expect(parseWikiLink("not a link")).toBeNull();
		expect(parseWikiLink("[[incomplete")).toBeNull();
		expect(parseWikiLink("incomplete]]")).toBeNull();
		expect(parseWikiLink("")).toBeNull();
	});

	it("should handle trimming whitespace", () => {
		expect(parseWikiLink("  [[Projects/My Project]]  ")).toBe("Projects/My Project");
	});
});

describe("parsePropertyLinks", () => {
	it("should parse single link string", () => {
		expect(parsePropertyLinks("[[Projects/My Project]]")).toEqual(["Projects/My Project"]);
	});

	it("should parse array of links", () => {
		const links = ["[[Projects/Project A]]", "[[Projects/Project B|Project B]]", "[[Projects/Project C]]"];
		expect(parsePropertyLinks(links)).toEqual(["Projects/Project A", "Projects/Project B", "Projects/Project C"]);
	});

	it("should filter out invalid links", () => {
		const links = ["[[Projects/Valid]]", "invalid", "[[Projects/Another Valid]]"];
		expect(parsePropertyLinks(links)).toEqual(["Projects/Valid", "Projects/Another Valid"]);
	});

	it("should return empty array for undefined", () => {
		expect(parsePropertyLinks(undefined)).toEqual([]);
	});

	it("should return empty array for empty string", () => {
		expect(parsePropertyLinks("")).toEqual([]);
	});

	it("should return empty array for empty array", () => {
		expect(parsePropertyLinks([])).toEqual([]);
	});
});

describe("formatWikiLink", () => {
	it("should format nested path with display name alias", () => {
		expect(formatWikiLink("Projects/MyProject")).toBe("[[Projects/MyProject|MyProject]]");
	});

	it("should format path with spaces and display name", () => {
		expect(formatWikiLink("Projects/My Project")).toBe("[[Projects/My Project|My Project]]");
	});

	it("should format deeply nested path", () => {
		expect(formatWikiLink("Projects/Subproject/MyFile")).toBe("[[Projects/Subproject/MyFile|MyFile]]");
	});

	it("should handle simple filename without path", () => {
		expect(formatWikiLink("MyProject")).toBe("[[MyProject]]");
	});

	it("should handle filename with extension", () => {
		expect(formatWikiLink("Projects/document.md")).toBe("[[Projects/document.md|document.md]]");
	});

	it("should handle paths with multiple spaces", () => {
		expect(formatWikiLink("My Folder/My Sub Folder/My File")).toBe("[[My Folder/My Sub Folder/My File|My File]]");
	});

	it("should trim whitespace from input", () => {
		expect(formatWikiLink("  Projects/MyProject  ")).toBe("[[Projects/MyProject|MyProject]]");
	});

	it("should return empty string for empty input", () => {
		expect(formatWikiLink("")).toBe("");
	});

	it("should return empty string for whitespace only", () => {
		expect(formatWikiLink("   ")).toBe("");
	});

	it("should handle paths with special characters", () => {
		expect(formatWikiLink("Projects/My-Project_v2")).toBe("[[Projects/My-Project_v2|My-Project_v2]]");
	});

	it("should handle paths with numbers", () => {
		expect(formatWikiLink("2024/Projects/Project123")).toBe("[[2024/Projects/Project123|Project123]]");
	});

	it("should handle paths with dots", () => {
		expect(formatWikiLink("Projects/My.Project.Name")).toBe("[[Projects/My.Project.Name|My.Project.Name]]");
	});
});
