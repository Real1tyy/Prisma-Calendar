import type { TFile, Vault } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { CodeBlockFile } from "../../src/core/data-access/code-block-file";
import { createMockApp, createMockFile } from "../../src/testing";

const TestItemSchema = z.object({
	id: z.string(),
	value: z.number(),
});

type TestItem = z.infer<typeof TestItemSchema>;

const CODE_FENCE = "test-block";

function createFile(): CodeBlockFile<TestItem> {
	return new CodeBlockFile({ codeFence: CODE_FENCE, itemSchema: TestItemSchema });
}

function createMockVault(content: string): Vault {
	return {
		read: vi.fn().mockResolvedValue(content),
		modify: vi.fn().mockResolvedValue(undefined),
	} as unknown as Vault;
}

describe("CodeBlockFile", () => {
	const file = createFile();

	describe("parse", () => {
		it("should parse valid JSON array", () => {
			const raw = '[{"id":"a","value":1},{"id":"b","value":2}]';
			expect(file.parse(raw)).toEqual([
				{ id: "a", value: 1 },
				{ id: "b", value: 2 },
			]);
		});

		it("should return empty array for invalid JSON", () => {
			expect(file.parse("not json")).toEqual([]);
		});

		it("should filter out items that fail validation", () => {
			const raw = '[{"id":"a","value":1},{"id":123,"value":"bad"},{"id":"c","value":3}]';
			expect(file.parse(raw)).toEqual([
				{ id: "a", value: 1 },
				{ id: "c", value: 3 },
			]);
		});

		it("should return empty array for non-array JSON", () => {
			expect(file.parse('{"id":"a","value":1}')).toEqual([]);
		});

		it("should return empty array for empty string", () => {
			expect(file.parse("")).toEqual([]);
		});

		it("should parse empty JSON array", () => {
			expect(file.parse("[]")).toEqual([]);
		});
	});

	describe("serialize", () => {
		it("should serialize empty array", () => {
			expect(file.serialize([])).toBe("[]");
		});

		it("should serialize single item with pretty format", () => {
			expect(file.serialize([{ id: "a", value: 1 }])).toBe('[\n  {"id":"a","value":1}\n]');
		});

		it("should serialize multiple items", () => {
			const result = file.serialize([
				{ id: "a", value: 1 },
				{ id: "b", value: 2 },
			]);
			expect(result).toBe('[\n  {"id":"a","value":1},\n  {"id":"b","value":2}\n]');
		});

		it("should round-trip with parse", () => {
			const items: TestItem[] = [
				{ id: "x", value: 42 },
				{ id: "y", value: 99 },
			];
			expect(file.parse(file.serialize(items))).toEqual(items);
		});
	});

	describe("extractRaw", () => {
		it("should extract content from matching code block", async () => {
			const vault = createMockVault("```test-block\nsome content\n```");
			const result = await file.extractRaw(vault, createMockFile("test.md") as TFile);
			expect(result).toBe("some content\n");
		});

		it("should return null when no matching code block exists", async () => {
			const vault = createMockVault("```other-block\ncontent\n```");
			const result = await file.extractRaw(vault, createMockFile("test.md") as TFile);
			expect(result).toBeNull();
		});

		it("should return empty string for empty code block", async () => {
			const vault = createMockVault("```test-block\n```");
			const result = await file.extractRaw(vault, createMockFile("test.md") as TFile);
			expect(result).toBe("");
		});

		it("should handle vault read errors gracefully", async () => {
			const vault = { read: vi.fn().mockRejectedValue(new Error("read error")) } as unknown as Vault;
			const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
			const result = await file.extractRaw(vault, createMockFile("test.md") as TFile);
			expect(result).toBeNull();
			consoleSpy.mockRestore();
		});

		it("should extract first block when multiple exist", async () => {
			const vault = createMockVault("```test-block\nfirst\n```\n\n```test-block\nsecond\n```");
			const result = await file.extractRaw(vault, createMockFile("test.md") as TFile);
			expect(result).toBe("first\n");
		});
	});

	describe("read", () => {
		it("should extract and parse JSON entries from file", async () => {
			const vault = createMockVault('```test-block\n[{"id":"a","value":1}]\n```');
			const result = await file.read(vault, createMockFile("test.md") as TFile);
			expect(result).toEqual([{ id: "a", value: 1 }]);
		});

		it("should return empty array when no block exists", async () => {
			const vault = createMockVault("no code block");
			expect(await file.read(vault, createMockFile("test.md") as TFile)).toEqual([]);
		});
	});

	describe("resolveFile", () => {
		it("should return file when path resolves", () => {
			const mockFile = createMockFile("test.md");
			const app = createMockApp({
				vault: { getAbstractFileByPath: vi.fn().mockReturnValue(mockFile) },
			});
			expect(file.resolveFile(app as never, "test.md")).toBe(mockFile);
		});

		it("should return null when path resolves to null", () => {
			const app = createMockApp({ vault: { getAbstractFileByPath: vi.fn().mockReturnValue(null) } });
			expect(file.resolveFile(app as never, "missing.md")).toBeNull();
		});
	});

	describe("createBackingFile", () => {
		it("should create file in nested directory", async () => {
			const created = createMockFile("deep/nested/data.md");
			const app = createMockApp({
				vault: {
					createFolder: vi.fn().mockResolvedValue(undefined),
					create: vi.fn().mockResolvedValue(created),
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
				},
			});
			const result = await file.createBackingFile(app as never, "deep/nested/data.md");
			expect(app.vault.createFolder).toHaveBeenCalledWith("deep/nested");
			expect(app.vault.create).toHaveBeenCalledWith("deep/nested/data.md", `\`\`\`${CODE_FENCE}\n[]\n\`\`\`\n`);
			expect(result).toBe(created);
		});

		it("should skip folder creation for root-level file", async () => {
			const created = createMockFile("data.md");
			const app = createMockApp({
				vault: {
					createFolder: vi.fn(),
					create: vi.fn().mockResolvedValue(created),
				},
			});
			await file.createBackingFile(app as never, "data.md");
			expect(app.vault.createFolder).not.toHaveBeenCalled();
			expect(app.vault.create).toHaveBeenCalledWith("data.md", expect.stringContaining(`\`\`\`${CODE_FENCE}`));
		});
	});

	describe("write", () => {
		it("should replace block content in file", async () => {
			const content = '```test-block\n[{"id":"old","value":0}]\n```';
			const mockApp = createMockApp({
				vault: { read: vi.fn().mockResolvedValue(content), modify: vi.fn() },
				workspace: { getActiveViewOfType: vi.fn().mockReturnValue(null) },
			});
			const tfile = createMockFile("test.md");
			await file.write(mockApp as never, tfile as TFile, [{ id: "new", value: 42 }]);
			expect(mockApp.vault.modify).toHaveBeenCalledWith(tfile, '```test-block\n[\n  {"id":"new","value":42}\n]\n```');
		});

		it("should invoke onBeforeWrite callback before vault.modify", async () => {
			const mockApp = createMockApp({
				vault: { read: vi.fn().mockResolvedValue("```test-block\n[]\n```"), modify: vi.fn() },
				workspace: { getActiveViewOfType: vi.fn().mockReturnValue(null) },
			});
			const onBeforeWrite = vi.fn();
			await file.write(mockApp as never, createMockFile("t.md") as TFile, [{ id: "x", value: 1 }], onBeforeWrite);
			expect(onBeforeWrite).toHaveBeenCalledTimes(1);
		});
	});

	describe("writeRaw", () => {
		it("should replace block with raw string", async () => {
			const content = "```test-block\nold content\n```";
			const mockApp = createMockApp({
				vault: { read: vi.fn().mockResolvedValue(content), modify: vi.fn() },
				workspace: { getActiveViewOfType: vi.fn().mockReturnValue(null) },
			});
			const tfile = createMockFile("test.md");
			await file.writeRaw(mockApp as never, tfile as TFile, "new content");
			expect(mockApp.vault.modify).toHaveBeenCalledWith(tfile, "```test-block\nnew content\n```");
		});
	});

	describe("ensureBlock", () => {
		it("should not modify file if block already exists", async () => {
			const mockApp = createMockApp({
				vault: { read: vi.fn().mockResolvedValue("```test-block\n[]\n```"), modify: vi.fn() },
			});
			await file.ensureBlock(mockApp as never, createMockFile("test.md") as TFile);
			expect(mockApp.vault.modify).not.toHaveBeenCalled();
		});

		it("should insert block after frontmatter", async () => {
			const content = "---\ntitle: Test\n---\nSome content";
			const mockApp = createMockApp({
				vault: { read: vi.fn().mockResolvedValue(content), modify: vi.fn() },
			});
			const tfile = createMockFile("test.md");
			await file.ensureBlock(mockApp as never, tfile as TFile);
			expect(mockApp.vault.modify).toHaveBeenCalledWith(
				tfile,
				"---\ntitle: Test\n---\n\n```test-block\n[]\n```\n\nSome content"
			);
		});

		it("should insert block at start when no frontmatter", async () => {
			const mockApp = createMockApp({
				vault: { read: vi.fn().mockResolvedValue("Some content"), modify: vi.fn() },
			});
			const tfile = createMockFile("test.md");
			await file.ensureBlock(mockApp as never, tfile as TFile);
			expect(mockApp.vault.modify).toHaveBeenCalledWith(tfile, "```test-block\n[]\n```\n\nSome content");
		});

		it("should insert block with default entries", async () => {
			const mockApp = createMockApp({
				vault: { read: vi.fn().mockResolvedValue("Some content"), modify: vi.fn() },
			});
			const tfile = createMockFile("test.md");
			await file.ensureBlock(mockApp as never, tfile as TFile, [{ id: "a", value: 1 }]);
			expect(mockApp.vault.modify).toHaveBeenCalledWith(
				tfile,
				'```test-block\n[\n  {"id":"a","value":1}\n]\n```\n\nSome content'
			);
		});
	});
});
