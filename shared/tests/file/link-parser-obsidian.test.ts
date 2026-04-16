import { describe, expect, it } from "vitest";

import {
	getObsidianLinkAlias,
	getObsidianLinkPath,
	isObsidianLink,
	parseObsidianLink,
} from "../../src/core/file/link-parser";

describe("isObsidianLink", () => {
	it("should return true for simple link", () => {
		expect(isObsidianLink("[[Page Name]]")).toBe(true);
	});

	it("should return true for link with alias", () => {
		expect(isObsidianLink("[[Path/To/Page|Display Name]]")).toBe(true);
	});

	it("should return true for link with path", () => {
		expect(isObsidianLink("[[Folder/Subfolder/File]]")).toBe(true);
	});

	it("should return false for non-string values", () => {
		expect(isObsidianLink(123)).toBe(false);
		expect(isObsidianLink(null)).toBe(false);
		expect(isObsidianLink(undefined)).toBe(false);
		expect(isObsidianLink({})).toBe(false);
		expect(isObsidianLink([])).toBe(false);
	});

	it("should return false for empty string", () => {
		expect(isObsidianLink("")).toBe(false);
	});

	it("should return false for string without brackets", () => {
		expect(isObsidianLink("Page Name")).toBe(false);
	});

	it("should return false for single brackets", () => {
		expect(isObsidianLink("[Page Name]")).toBe(false);
	});

	it("should return false for incomplete brackets", () => {
		expect(isObsidianLink("[[Page Name]")).toBe(false);
		expect(isObsidianLink("[Page Name]]")).toBe(false);
	});

	it("should return false for empty brackets", () => {
		expect(isObsidianLink("[[]]")).toBe(false);
	});

	it("should handle whitespace correctly", () => {
		expect(isObsidianLink("  [[Page Name]]  ")).toBe(true);
		expect(isObsidianLink("[[  ]]")).toBe(true); // Has content (spaces)
	});
});

describe("parseObsidianLink", () => {
	it("should parse simple link", () => {
		const result = parseObsidianLink("[[Page Name]]");
		expect(result).toEqual({
			raw: "[[Page Name]]",
			path: "Page Name",
			alias: "Page Name",
		});
	});

	it("should parse link with alias", () => {
		const result = parseObsidianLink("[[Path/To/Page|Display Name]]");
		expect(result).toEqual({
			raw: "[[Path/To/Page|Display Name]]",
			path: "Path/To/Page",
			alias: "Display Name",
		});
	});

	it("should parse link with path", () => {
		const result = parseObsidianLink("[[Folder/Subfolder/File]]");
		expect(result).toEqual({
			raw: "[[Folder/Subfolder/File]]",
			path: "Folder/Subfolder/File",
			alias: "Folder/Subfolder/File",
		});
	});

	it("should handle multiple pipes", () => {
		const result = parseObsidianLink("[[Path|Display|Extra]]");
		expect(result).toEqual({
			raw: "[[Path|Display|Extra]]",
			path: "Path",
			alias: "Display|Extra",
		});
	});

	it("should trim whitespace", () => {
		const result = parseObsidianLink("  [[Page Name]]  ");
		expect(result).toEqual({
			raw: "[[Page Name]]",
			path: "Page Name",
			alias: "Page Name",
		});
	});

	it("should trim whitespace in path and alias", () => {
		const result = parseObsidianLink("[[ Path | Alias ]]");
		expect(result).toEqual({
			raw: "[[ Path | Alias ]]",
			path: "Path",
			alias: "Alias",
		});
	});

	it("should return null for invalid formats", () => {
		expect(parseObsidianLink("Page Name")).toBeNull();
		expect(parseObsidianLink("[Page Name]")).toBeNull();
		expect(parseObsidianLink("[[Page Name]")).toBeNull();
		expect(parseObsidianLink("[Page Name]]")).toBeNull();
		expect(parseObsidianLink("[[]]")).toBeNull();
		expect(parseObsidianLink("")).toBeNull();
	});

	it("should return null for non-string values", () => {
		expect(parseObsidianLink(123 as any)).toBeNull();
		expect(parseObsidianLink(null as any)).toBeNull();
		expect(parseObsidianLink(undefined as any)).toBeNull();
	});

	it("should handle special characters in path", () => {
		const result = parseObsidianLink("[[My-Note_2023.01]]");
		expect(result).toEqual({
			raw: "[[My-Note_2023.01]]",
			path: "My-Note_2023.01",
			alias: "My-Note_2023.01",
		});
	});

	it("should handle special characters in alias", () => {
		const result = parseObsidianLink("[[Path|Display: Name (v2)]]");
		expect(result).toEqual({
			raw: "[[Path|Display: Name (v2)]]",
			path: "Path",
			alias: "Display: Name (v2)",
		});
	});

	it("should handle empty alias", () => {
		const result = parseObsidianLink("[[Path|]]");
		expect(result).toEqual({
			raw: "[[Path|]]",
			path: "Path",
			alias: "",
		});
	});
});

describe("getObsidianLinkAlias", () => {
	it("should return alias from link with alias", () => {
		expect(getObsidianLinkAlias("[[Path|Display]]")).toBe("Display");
	});

	it("should return path when no alias", () => {
		expect(getObsidianLinkAlias("[[Page Name]]")).toBe("Page Name");
	});

	it("should return original string for invalid link", () => {
		expect(getObsidianLinkAlias("Not a link")).toBe("Not a link");
	});

	it("should handle whitespace", () => {
		expect(getObsidianLinkAlias("  [[Path|Alias]]  ")).toBe("Alias");
	});

	it("should handle multiple pipes", () => {
		expect(getObsidianLinkAlias("[[Path|Display|Extra]]")).toBe("Display|Extra");
	});
});

describe("getObsidianLinkPath", () => {
	it("should return path from link", () => {
		expect(getObsidianLinkPath("[[Folder/File]]")).toBe("Folder/File");
	});

	it("should return path ignoring alias", () => {
		expect(getObsidianLinkPath("[[Path/To/File|Display]]")).toBe("Path/To/File");
	});

	it("should return original string for invalid link", () => {
		expect(getObsidianLinkPath("Not a link")).toBe("Not a link");
	});

	it("should handle whitespace", () => {
		expect(getObsidianLinkPath("  [[Folder/File]]  ")).toBe("Folder/File");
	});

	it("should trim path", () => {
		expect(getObsidianLinkPath("[[ Path/File | Alias ]]")).toBe("Path/File");
	});
});

describe("integration: obsidian link parsing workflow", () => {
	it("should parse and extract components correctly", () => {
		const link = "[[Projects/2024/MyProject|My Project]]";

		expect(isObsidianLink(link)).toBe(true);

		const parsed = parseObsidianLink(link);
		expect(parsed).not.toBeNull();
		expect(parsed?.path).toBe("Projects/2024/MyProject");
		expect(parsed?.alias).toBe("My Project");

		expect(getObsidianLinkPath(link)).toBe("Projects/2024/MyProject");
		expect(getObsidianLinkAlias(link)).toBe("My Project");
	});

	it("should handle simple links consistently", () => {
		const link = "[[Simple Note]]";

		expect(isObsidianLink(link)).toBe(true);

		const parsed = parseObsidianLink(link);
		expect(parsed?.path).toBe("Simple Note");
		expect(parsed?.alias).toBe("Simple Note");

		expect(getObsidianLinkPath(link)).toBe("Simple Note");
		expect(getObsidianLinkAlias(link)).toBe("Simple Note");
	});

	it("should handle invalid inputs gracefully", () => {
		const notALink = "Regular text";

		expect(isObsidianLink(notALink)).toBe(false);
		expect(parseObsidianLink(notALink)).toBeNull();
		expect(getObsidianLinkPath(notALink)).toBe(notALink);
		expect(getObsidianLinkAlias(notALink)).toBe(notALink);
	});
});
