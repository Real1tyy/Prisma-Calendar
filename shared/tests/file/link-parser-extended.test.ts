import { describe, expect, it } from "vitest";

import {
	getObsidianLinkAlias,
	getObsidianLinkPath,
	isObsidianLink,
	parseObsidianLink,
} from "../../src/core/file/link-parser";

describe("isObsidianLink", () => {
	it("returns true for simple wiki link", () => {
		expect(isObsidianLink("[[Page Name]]")).toBe(true);
	});

	it("returns true for link with alias", () => {
		expect(isObsidianLink("[[Path/To/Page|Display Name]]")).toBe(true);
	});

	it("returns true for trimmed link with whitespace", () => {
		expect(isObsidianLink("  [[Page]]  ")).toBe(true);
	});

	it("returns false for empty string", () => {
		expect(isObsidianLink("")).toBe(false);
	});

	it("returns false for plain text", () => {
		expect(isObsidianLink("just text")).toBe(false);
	});

	it("returns false for single brackets", () => {
		expect(isObsidianLink("[Page]")).toBe(false);
	});

	it("returns false for empty brackets", () => {
		expect(isObsidianLink("[[]]")).toBe(false);
	});

	it("returns false for non-string inputs", () => {
		expect(isObsidianLink(42)).toBe(false);
		expect(isObsidianLink(null)).toBe(false);
		expect(isObsidianLink(undefined)).toBe(false);
		expect(isObsidianLink(true)).toBe(false);
		expect(isObsidianLink({})).toBe(false);
		expect(isObsidianLink([])).toBe(false);
	});

	it("returns false for incomplete brackets", () => {
		expect(isObsidianLink("[[Page")).toBe(false);
		expect(isObsidianLink("Page]]")).toBe(false);
	});
});

describe("parseObsidianLink", () => {
	it("parses simple link", () => {
		const result = parseObsidianLink("[[Page Name]]");
		expect(result).toEqual({
			raw: "[[Page Name]]",
			path: "Page Name",
			alias: "Page Name",
		});
	});

	it("parses link with alias", () => {
		const result = parseObsidianLink("[[Projects/My Project|My Project]]");
		expect(result).toEqual({
			raw: "[[Projects/My Project|My Project]]",
			path: "Projects/My Project",
			alias: "My Project",
		});
	});

	it("parses link with multiple pipes (joins remaining as alias)", () => {
		const result = parseObsidianLink("[[Path|Alias|Extra]]");
		expect(result).toEqual({
			raw: "[[Path|Alias|Extra]]",
			path: "Path",
			alias: "Alias|Extra",
		});
	});

	it("returns null for non-link string", () => {
		expect(parseObsidianLink("not a link")).toBeNull();
	});

	it("returns null for empty brackets", () => {
		expect(parseObsidianLink("[[]]")).toBeNull();
	});

	it("handles trimming whitespace around link", () => {
		const result = parseObsidianLink("  [[Page]]  ");
		expect(result).toEqual({
			raw: "[[Page]]",
			path: "Page",
			alias: "Page",
		});
	});

	it("handles link with folder path and no alias", () => {
		const result = parseObsidianLink("[[Folder/SubFolder/File]]");
		expect(result).toEqual({
			raw: "[[Folder/SubFolder/File]]",
			path: "Folder/SubFolder/File",
			alias: "Folder/SubFolder/File",
		});
	});

	it("trims path and alias", () => {
		const result = parseObsidianLink("[[ Path | Alias ]]");
		expect(result).toEqual({
			raw: "[[ Path | Alias ]]",
			path: "Path",
			alias: "Alias",
		});
	});

	it("handles unicode in links", () => {
		const result = parseObsidianLink("[[文件夹/文件|显示名]]");
		expect(result).toEqual({
			raw: "[[文件夹/文件|显示名]]",
			path: "文件夹/文件",
			alias: "显示名",
		});
	});
});

describe("getObsidianLinkAlias", () => {
	it("returns alias for link with pipe", () => {
		expect(getObsidianLinkAlias("[[Projects/MyProject|MyProject]]")).toBe("MyProject");
	});

	it("returns path as alias for simple link", () => {
		expect(getObsidianLinkAlias("[[Page Name]]")).toBe("Page Name");
	});

	it("returns original string for non-link", () => {
		expect(getObsidianLinkAlias("not a link")).toBe("not a link");
	});

	it("returns original string for empty brackets", () => {
		expect(getObsidianLinkAlias("[[]]")).toBe("[[]]");
	});
});

describe("getObsidianLinkPath", () => {
	it("returns path for link with alias", () => {
		expect(getObsidianLinkPath("[[Projects/MyProject|MyProject]]")).toBe("Projects/MyProject");
	});

	it("returns path for simple link", () => {
		expect(getObsidianLinkPath("[[Page Name]]")).toBe("Page Name");
	});

	it("returns original string for non-link", () => {
		expect(getObsidianLinkPath("plain text")).toBe("plain text");
	});

	it("returns original string for empty brackets", () => {
		expect(getObsidianLinkPath("[[]]")).toBe("[[]]");
	});

	it("returns path with folder structure", () => {
		expect(getObsidianLinkPath("[[Folder/Sub/File|Display]]")).toBe("Folder/Sub/File");
	});
});
