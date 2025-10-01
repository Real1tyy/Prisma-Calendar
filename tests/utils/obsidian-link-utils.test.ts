import { describe, expect, it } from "vitest";
import {
	getObsidianLinkDisplay,
	getObsidianLinkPath,
	isFilePath,
	isObsidianLink,
	parseObsidianLink,
} from "../../src/utils/obsidian-link-utils";

describe("isObsidianLink", () => {
	it("should detect simple Obsidian links", () => {
		expect(isObsidianLink("[[Page Name]]")).toBe(true);
		expect(isObsidianLink("[[Travel Around The World]]")).toBe(true);
	});

	it("should detect links with pipe syntax", () => {
		expect(isObsidianLink("[[Path/To/Page|Display Name]]")).toBe(true);
		expect(isObsidianLink("[[Projects/Travel|Travel Around The World]]")).toBe(true);
	});

	it("should handle whitespace", () => {
		expect(isObsidianLink("  [[Page Name]]  ")).toBe(true);
		expect(isObsidianLink("[[  Spaces Inside  ]]")).toBe(true);
	});

	it("should reject invalid formats", () => {
		expect(isObsidianLink("[Page Name]")).toBe(false);
		expect(isObsidianLink("[[Page Name]")).toBe(false);
		expect(isObsidianLink("[Page Name]]")).toBe(false);
		expect(isObsidianLink("Page Name")).toBe(false);
		expect(isObsidianLink("[[]]")).toBe(false);
	});

	it("should reject non-string values", () => {
		expect(isObsidianLink(null)).toBe(false);
		expect(isObsidianLink(undefined)).toBe(false);
		expect(isObsidianLink(123)).toBe(false);
		expect(isObsidianLink({})).toBe(false);
		expect(isObsidianLink([])).toBe(false);
	});

	it("should reject empty strings", () => {
		expect(isObsidianLink("")).toBe(false);
		expect(isObsidianLink("   ")).toBe(false);
	});
});

describe("parseObsidianLink", () => {
	describe("Simple links", () => {
		it("should parse simple links correctly", () => {
			const result = parseObsidianLink("[[Page Name]]");
			expect(result).toEqual({
				raw: "[[Page Name]]",
				path: "Page Name",
				display: "Page Name",
				hasPipe: false,
			});
		});

		it("should handle whitespace", () => {
			const result = parseObsidianLink("  [[  Page Name  ]]  ");
			expect(result).toEqual({
				raw: "[[  Page Name  ]]",
				path: "Page Name",
				display: "Page Name",
				hasPipe: false,
			});
		});

		it("should handle paths with slashes", () => {
			const result = parseObsidianLink("[[Projects/Travel/Paris]]");
			expect(result).toEqual({
				raw: "[[Projects/Travel/Paris]]",
				path: "Projects/Travel/Paris",
				display: "Projects/Travel/Paris",
				hasPipe: false,
			});
		});
	});

	describe("Links with pipe syntax", () => {
		it("should parse pipe syntax correctly", () => {
			const result = parseObsidianLink("[[Path/To/Page|Display Name]]");
			expect(result).toEqual({
				raw: "[[Path/To/Page|Display Name]]",
				path: "Path/To/Page",
				display: "Display Name",
				hasPipe: true,
			});
		});

		it("should handle complex pipe syntax", () => {
			const result = parseObsidianLink(
				"[[Projects/Travel Around The World – Paris Visit|Travel Around The World – Paris Visit]]"
			);
			expect(result).toEqual({
				raw: "[[Projects/Travel Around The World – Paris Visit|Travel Around The World – Paris Visit]]",
				path: "Projects/Travel Around The World – Paris Visit",
				display: "Travel Around The World – Paris Visit",
				hasPipe: true,
			});
		});

		it("should handle multiple pipes (keep all after first as display)", () => {
			const result = parseObsidianLink("[[Path|Display|Extra]]");
			expect(result).toEqual({
				raw: "[[Path|Display|Extra]]",
				path: "Path",
				display: "Display|Extra",
				hasPipe: true,
			});
		});

		it("should trim whitespace around pipe", () => {
			const result = parseObsidianLink("[[  Path  |  Display  ]]");
			expect(result).toEqual({
				raw: "[[  Path  |  Display  ]]",
				path: "Path",
				display: "Display",
				hasPipe: true,
			});
		});
	});

	describe("Invalid links", () => {
		it("should return null for invalid formats", () => {
			expect(parseObsidianLink("[Page Name]")).toBeNull();
			expect(parseObsidianLink("[[Page Name]")).toBeNull();
			expect(parseObsidianLink("[Page Name]]")).toBeNull();
			expect(parseObsidianLink("Page Name")).toBeNull();
		});

		it("should return null for empty content", () => {
			expect(parseObsidianLink("[[]]")).toBeNull();
		});
	});
});

describe("getObsidianLinkDisplay", () => {
	it("should extract display text from simple links", () => {
		expect(getObsidianLinkDisplay("[[Page Name]]")).toBe("Page Name");
		expect(getObsidianLinkDisplay("[[Travel Around The World]]")).toBe("Travel Around The World");
	});

	it("should extract display text from pipe syntax", () => {
		expect(getObsidianLinkDisplay("[[Path/To/Page|Display Name]]")).toBe("Display Name");
		expect(getObsidianLinkDisplay("[[Projects/Travel|Travel Around The World – Paris Visit]]")).toBe(
			"Travel Around The World – Paris Visit"
		);
	});

	it("should return original string for invalid links", () => {
		expect(getObsidianLinkDisplay("Not a link")).toBe("Not a link");
		expect(getObsidianLinkDisplay("[Page Name]")).toBe("[Page Name]");
	});
});

describe("getObsidianLinkPath", () => {
	it("should extract path from simple links", () => {
		expect(getObsidianLinkPath("[[Page Name]]")).toBe("Page Name");
		expect(getObsidianLinkPath("[[Travel Around The World]]")).toBe("Travel Around The World");
	});

	it("should extract path from pipe syntax", () => {
		expect(getObsidianLinkPath("[[Path/To/Page|Display Name]]")).toBe("Path/To/Page");
		expect(
			getObsidianLinkPath("[[Projects/Travel Around The World – Paris Visit|Travel Around The World – Paris Visit]]")
		).toBe("Projects/Travel Around The World – Paris Visit");
	});

	it("should return original string for invalid links", () => {
		expect(getObsidianLinkPath("Not a link")).toBe("Not a link");
		expect(getObsidianLinkPath("[Page Name]")).toBe("[Page Name]");
	});
});

describe("isFilePath", () => {
	it("should detect .md files", () => {
		expect(isFilePath("file.md")).toBe(true);
		expect(isFilePath("path/to/file.md")).toBe(true);
	});

	it("should detect paths with separators", () => {
		expect(isFilePath("folder/file")).toBe(true);
		expect(isFilePath("folder\\file")).toBe(true);
		expect(isFilePath("a/b/c/d")).toBe(true);
	});

	it("should reject Obsidian links", () => {
		expect(isFilePath("[[Page Name]]")).toBe(false);
		expect(isFilePath("[[Path/To/Page|Display]]")).toBe(false);
	});

	it("should reject URLs", () => {
		expect(isFilePath("http://example.com/file")).toBe(false);
		expect(isFilePath("https://example.com/path/to/file")).toBe(false);
	});

	it("should reject paths with spaces", () => {
		expect(isFilePath("path with spaces/file")).toBe(false);
	});

	it("should reject plain text", () => {
		expect(isFilePath("Just some text")).toBe(false);
		expect(isFilePath("Single word")).toBe(false);
	});

	it("should reject non-string values", () => {
		expect(isFilePath(null)).toBe(false);
		expect(isFilePath(undefined)).toBe(false);
		expect(isFilePath(123)).toBe(false);
		expect(isFilePath({})).toBe(false);
	});

	it("should handle edge cases", () => {
		expect(isFilePath("")).toBe(false);
		expect(isFilePath("   ")).toBe(false);
		expect(isFilePath(".md")).toBe(true);
		expect(isFilePath("/")).toBe(true);
	});
});

describe("Integration scenarios", () => {
	it("should correctly differentiate between links and file paths", () => {
		const obsidianLink = "[[Projects/Travel Around The World|Travel]]";
		const filePath = "Projects/Travel.md";

		expect(isObsidianLink(obsidianLink)).toBe(true);
		expect(isFilePath(obsidianLink)).toBe(false);

		expect(isObsidianLink(filePath)).toBe(false);
		expect(isFilePath(filePath)).toBe(true);
	});

	it("should handle arrays of mixed values", () => {
		const values = [
			"[[Travel Around The World]]",
			"[[Projects/Paris|Paris Visit]]",
			"Projects/Travel.md",
			"Regular text",
		];

		const links = values.filter(isObsidianLink);
		const paths = values.filter(isFilePath);

		expect(links).toHaveLength(2);
		expect(paths).toHaveLength(1);
	});

	it("should extract correct information from real-world examples", () => {
		const goalLink = "[[Travel Around The World]]";
		const projectLink = "[[Projects/Travel Around The World – Paris Visit|Travel Around The World – Paris Visit]]";

		const goalParsed = parseObsidianLink(goalLink);
		expect(goalParsed?.path).toBe("Travel Around The World");
		expect(goalParsed?.display).toBe("Travel Around The World");

		const projectParsed = parseObsidianLink(projectLink);
		expect(projectParsed?.path).toBe("Projects/Travel Around The World – Paris Visit");
		expect(projectParsed?.display).toBe("Travel Around The World – Paris Visit");
	});
});
