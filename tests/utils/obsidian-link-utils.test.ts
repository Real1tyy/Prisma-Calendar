import { describe, expect, it } from "vitest";
import {
	getObsidianLinkAlias,
	getObsidianLinkPath,
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
				alias: "Page Name",
			});
		});

		it("should handle whitespace", () => {
			const result = parseObsidianLink("  [[  Page Name  ]]  ");
			expect(result).toEqual({
				raw: "[[  Page Name  ]]",
				path: "Page Name",
				alias: "Page Name",
			});
		});

		it("should handle paths with slashes", () => {
			const result = parseObsidianLink("[[Projects/Travel/Paris]]");
			expect(result).toEqual({
				raw: "[[Projects/Travel/Paris]]",
				path: "Projects/Travel/Paris",
				alias: "Projects/Travel/Paris",
			});
		});
	});

	describe("Links with pipe syntax", () => {
		it("should parse pipe syntax correctly", () => {
			const result = parseObsidianLink("[[Path/To/Page|Display Name]]");
			expect(result).toEqual({
				raw: "[[Path/To/Page|Display Name]]",
				path: "Path/To/Page",
				alias: "Display Name",
			});
		});

		it("should handle complex pipe syntax", () => {
			const result = parseObsidianLink(
				"[[Projects/Travel Around The World – Paris Visit|Travel Around The World – Paris Visit]]"
			);
			expect(result).toEqual({
				raw: "[[Projects/Travel Around The World – Paris Visit|Travel Around The World – Paris Visit]]",
				path: "Projects/Travel Around The World – Paris Visit",
				alias: "Travel Around The World – Paris Visit",
			});
		});

		it("should handle multiple pipes (keep all after first as display)", () => {
			const result = parseObsidianLink("[[Path|Display|Extra]]");
			expect(result).toEqual({
				raw: "[[Path|Display|Extra]]",
				path: "Path",
				alias: "Display|Extra",
			});
		});

		it("should trim whitespace around pipe", () => {
			const result = parseObsidianLink("[[  Path  |  Display  ]]");
			expect(result).toEqual({
				raw: "[[  Path  |  Display  ]]",
				path: "Path",
				alias: "Display",
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
		expect(getObsidianLinkAlias("[[Page Name]]")).toBe("Page Name");
		expect(getObsidianLinkAlias("[[Travel Around The World]]")).toBe("Travel Around The World");
	});

	it("should extract display text from pipe syntax", () => {
		expect(getObsidianLinkAlias("[[Path/To/Page|Display Name]]")).toBe("Display Name");
		expect(getObsidianLinkAlias("[[Projects/Travel|Travel Around The World – Paris Visit]]")).toBe(
			"Travel Around The World – Paris Visit"
		);
	});

	it("should return original string for invalid links", () => {
		expect(getObsidianLinkAlias("Not a link")).toBe("Not a link");
		expect(getObsidianLinkAlias("[Page Name]")).toBe("[Page Name]");
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

describe("Integration scenarios", () => {
	it("should correctly differentiate between links and file paths", () => {
		const obsidianLink = "[[Projects/Travel Around The World|Travel]]";
		const filePath = "Projects/Travel.md";

		expect(isObsidianLink(obsidianLink)).toBe(true);

		expect(isObsidianLink(filePath)).toBe(false);
	});

	it("should handle arrays of mixed values", () => {
		const values = [
			"[[Travel Around The World]]",
			"[[Projects/Paris|Paris Visit]]",
			"Projects/Travel.md",
			"Regular text",
		];

		const links = values.filter(isObsidianLink);

		expect(links).toHaveLength(2);
	});

	it("should extract correct information from real-world examples", () => {
		const goalLink = "[[Travel Around The World]]";
		const projectLink = "[[Projects/Travel Around The World – Paris Visit|Travel Around The World – Paris Visit]]";

		const goalParsed = parseObsidianLink(goalLink);
		expect(goalParsed?.path).toBe("Travel Around The World");
		expect(goalParsed?.alias).toBe("Travel Around The World");

		const projectParsed = parseObsidianLink(projectLink);
		expect(projectParsed?.path).toBe("Projects/Travel Around The World – Paris Visit");
		expect(projectParsed?.alias).toBe("Travel Around The World – Paris Visit");
	});
});
