import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	createFileAtPathAtomic,
	createFromTemplate,
	isTemplaterAvailable,
	renderTemplateContent,
} from "../../src/core/file";
import { PENDING_WRITE_SENTINEL } from "../../src/core/file/templater";

// Mock normalizePath from obsidian
vi.mock("obsidian", async () => {
	const actual = await vi.importActual("obsidian");
	return {
		...actual,
		normalizePath: vi.fn((path: string) => path),
		Notice: vi.fn(),
	};
});

// Mock Templater plugin — exposes both public and internal APIs
const mockTemplaterPlugin = {
	templater: {
		create_new_note_from_template: vi.fn(),
		read_and_parse_template: vi.fn(),
	},
};

// Mock Obsidian app
const mockApp = {
	plugins: {
		getPlugin: vi.fn((id: string) => {
			if (id === "templater-obsidian") {
				return mockTemplaterPlugin;
			}
			return null;
		}),
	},
	vault: {
		getFileByPath: vi.fn(),
		getAbstractFileByPath: vi.fn(),
		create: vi.fn(),
		modify: vi.fn(),
	},
	workspace: {
		onLayoutReady: vi.fn((callback: () => void) => {
			callback();
		}),
	},
	metadataCache: {
		getFileCache: vi.fn(),
	},
	fileManager: {
		processFrontMatter: vi.fn(),
	},
} as any;

const mockTemplateFile = {
	path: "templates/event.md",
	name: "event.md",
	basename: "event",
} as any;

const mockTargetFile = {
	path: "events/new-event.md",
	name: "new-event.md",
	basename: "new-event",
} as any;

describe("Templater Utils", () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		mockApp.fileManager.processFrontMatter.mockReset();
		mockApp.metadataCache.getFileCache.mockReset();
		mockApp.vault.create.mockResolvedValue(mockTargetFile);
		mockApp.vault.modify.mockResolvedValue(undefined);
		mockTemplaterPlugin.templater.read_and_parse_template.mockResolvedValue("# Rendered body");
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	describe("isTemplaterAvailable", () => {
		it("should return true when Templater plugin is available", () => {
			expect(isTemplaterAvailable(mockApp)).toBe(true);
		});

		it("should return false when Templater plugin is not available", () => {
			const appWithoutTemplater = {
				plugins: { getPlugin: vi.fn(() => null) },
			} as any;
			expect(isTemplaterAvailable(appWithoutTemplater)).toBe(false);
		});

		it("should return false when plugins.getPlugin is not available", () => {
			const appWithoutGetPlugin = { plugins: {} } as any;
			expect(isTemplaterAvailable(appWithoutGetPlugin)).toBe(false);
		});
	});

	describe("createFromTemplate (legacy — uses create_new_note_from_template)", () => {
		it("should create file from template successfully", async () => {
			mockApp.vault.getFileByPath.mockReturnValue(mockTemplateFile);
			mockTemplaterPlugin.templater.create_new_note_from_template.mockResolvedValue(mockTargetFile);

			const result = await createFromTemplate(mockApp, "templates/event.md", "events", "new-event", false);

			expect(result).toBe(mockTargetFile);
			expect(mockTemplaterPlugin.templater.create_new_note_from_template).toHaveBeenCalledWith(
				mockTemplateFile,
				"events",
				"new-event",
				false
			);
		});

		it("should return null when Templater is not available", async () => {
			const appWithoutTemplater = {
				plugins: { getPlugin: vi.fn(() => null) },
				workspace: { onLayoutReady: vi.fn((cb: () => void) => cb()) },
				vault: { getFileByPath: vi.fn() },
			} as any;

			vi.useFakeTimers();
			const promise = createFromTemplate(appWithoutTemplater, "templates/event.md", "events", "new-event");
			await vi.advanceTimersByTimeAsync(8500);
			const result = await promise;
			vi.useRealTimers();

			expect(result).toBeNull();
		});

		it("should return null when template file is not found", async () => {
			mockApp.vault.getFileByPath.mockReturnValue(null);

			const result = await createFromTemplate(mockApp, "nonexistent.md", "events", "new-event");
			expect(result).toBeNull();
		});

		it("should handle Templater API errors gracefully", async () => {
			mockApp.vault.getFileByPath.mockReturnValue(mockTemplateFile);
			mockTemplaterPlugin.templater.create_new_note_from_template.mockRejectedValue(new Error("Templater error"));

			const result = await createFromTemplate(mockApp, "templates/event.md", "events", "new-event");
			expect(result).toBeNull();
		});

		it("should handle case when Templater API returns undefined", async () => {
			mockApp.vault.getFileByPath.mockReturnValue(mockTemplateFile);
			mockTemplaterPlugin.templater.create_new_note_from_template.mockResolvedValue(undefined);

			const result = await createFromTemplate(mockApp, "templates/event.md", "events", "new-event");
			expect(result).toBeNull();
		});

		it("should not apply frontmatter if none provided", async () => {
			mockApp.vault.getFileByPath.mockReturnValue(mockTemplateFile);
			mockTemplaterPlugin.templater.create_new_note_from_template.mockResolvedValue(mockTargetFile);

			const result = await createFromTemplate(mockApp, "templates/event.md", "events", "new-event", false);

			expect(result).toBe(mockTargetFile);
			expect(mockApp.fileManager.processFrontMatter).not.toHaveBeenCalled();
		});
	});

	describe("renderTemplateContent (atomic — uses read_and_parse_template)", () => {
		it("should return rendered content without overrides", async () => {
			mockApp.vault.getFileByPath.mockReturnValue(mockTemplateFile);
			mockTemplaterPlugin.templater.read_and_parse_template.mockResolvedValue("# Hello\nBody content");

			const result = await renderTemplateContent(mockApp, "templates/event.md", mockTargetFile);

			expect(result).toBe("# Hello\nBody content");
			expect(mockTemplaterPlugin.templater.read_and_parse_template).toHaveBeenCalledWith(
				expect.objectContaining({ target_file: mockTargetFile, run_mode: 0 })
			);
		});

		it("should merge overrides on top of template frontmatter (overrides win)", async () => {
			mockApp.vault.getFileByPath.mockReturnValue(mockTemplateFile);
			mockTemplaterPlugin.templater.read_and_parse_template.mockResolvedValue(
				"---\nStatus: draft\ntags:\n  - note\n---\n\nBody content"
			);

			const result = await renderTemplateContent(mockApp, "templates/event.md", mockTargetFile, {
				Status: "done",
				"Start Date": "2026-01-01",
			});

			expect(result).toContain("Status: done");
			expect(result).not.toContain("Status: draft");
			expect(result).toContain("Start Date: 2026-01-01");
			expect(result).toContain("Body content");
		});

		it("should prepend overrides when template has no frontmatter", async () => {
			mockApp.vault.getFileByPath.mockReturnValue(mockTemplateFile);
			mockTemplaterPlugin.templater.read_and_parse_template.mockResolvedValue("# Just a body");

			const result = await renderTemplateContent(mockApp, "templates/event.md", mockTargetFile, {
				"Start Date": "2026-01-01",
			});

			expect(result).toContain("---");
			expect(result).toContain("Start Date: 2026-01-01");
			expect(result).toContain("# Just a body");
		});

		it("should return null when Templater lacks read_and_parse_template", async () => {
			const noInternalApiApp = {
				plugins: { getPlugin: vi.fn(() => ({ templater: {} })) },
				vault: { getFileByPath: vi.fn() },
			} as any;

			const result = await renderTemplateContent(noInternalApiApp, "templates/event.md", mockTargetFile);
			expect(result).toBeNull();
		});

		it("should return null when template file is not found", async () => {
			mockApp.vault.getFileByPath.mockReturnValue(null);

			const result = await renderTemplateContent(mockApp, "nonexistent.md", mockTargetFile);
			expect(result).toBeNull();
		});

		it("should return null when read_and_parse_template throws", async () => {
			mockApp.vault.getFileByPath.mockReturnValue(mockTemplateFile);
			mockTemplaterPlugin.templater.read_and_parse_template.mockRejectedValue(new Error("Render error"));

			const result = await renderTemplateContent(mockApp, "templates/event.md", mockTargetFile);
			expect(result).toBeNull();
		});

		it("should not create or modify any vault files", async () => {
			mockApp.vault.getFileByPath.mockReturnValue(mockTemplateFile);
			mockTemplaterPlugin.templater.read_and_parse_template.mockResolvedValue("# Content");

			await renderTemplateContent(mockApp, "templates/event.md", mockTargetFile);

			expect(mockApp.vault.create).not.toHaveBeenCalled();
			expect(mockApp.vault.modify).not.toHaveBeenCalled();
		});
	});

	describe("createFileAtPathAtomic", () => {
		it("should fall back to createFileAtPath when no template configured", async () => {
			// No Templater plugin in mockApp for this test
			const noTemplaterApp = {
				plugins: { getPlugin: vi.fn(() => null) },
				vault: {
					getFileByPath: vi.fn().mockReturnValue(null),
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
					create: vi.fn().mockResolvedValue({ path: "events/test.md" }),
				},
			} as any;

			await createFileAtPathAtomic(noTemplaterApp, "events/test.md", {
				content: "Body text",
				frontmatter: { Status: "Inbox" },
			});

			// Falls back to createFileAtPath → single vault.create
			expect(noTemplaterApp.vault.create).toHaveBeenCalledTimes(1);
			const [, fileContent] = noTemplaterApp.vault.create.mock.calls[0];
			expect(fileContent).toContain("Status: Inbox");
			expect(fileContent).toContain("Body text");
		});

		it("should render template and append content when both are provided", async () => {
			const sentinelFile = { path: "events/test.md" } as any;
			mockApp.vault.getFileByPath.mockReturnValue(mockTemplateFile);
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
			mockApp.vault.create.mockResolvedValue(sentinelFile);
			mockTemplaterPlugin.templater.read_and_parse_template.mockResolvedValue(
				"---\nStatus: draft\n---\n\n# Template Heading\n\nTemplate notes"
			);

			const result = await createFileAtPathAtomic(mockApp, "events/test.md", {
				content: "Source event body",
				frontmatter: { "Start Date": "2026-02-18" },
				templatePath: "templates/event.md",
			});

			expect(mockApp.vault.create).toHaveBeenCalledWith("events/test.md", PENDING_WRITE_SENTINEL);
			expect(mockApp.vault.modify).toHaveBeenCalledTimes(1);
			const [, finalContent] = mockApp.vault.modify.mock.calls[0];

			// Frontmatter overrides applied
			expect(finalContent).toContain("Start Date: 2026-02-18");
			// Template body preserved
			expect(finalContent).toContain("# Template Heading");
			expect(finalContent).toContain("Template notes");
			// Source content appended
			expect(finalContent).toContain("Source event body");
			// Source content comes after template body
			const templateIdx = (finalContent as string).indexOf("Template notes");
			const sourceIdx = (finalContent as string).indexOf("Source event body");
			expect(sourceIdx).toBeGreaterThan(templateIdx);
			expect(result).toBe(sentinelFile);
		});

		it("should render template without appending when content is empty", async () => {
			const sentinelFile = { path: "events/test.md" } as any;
			mockApp.vault.getFileByPath.mockReturnValue(mockTemplateFile);
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
			mockApp.vault.create.mockResolvedValue(sentinelFile);
			mockTemplaterPlugin.templater.read_and_parse_template.mockResolvedValue(
				"---\nStatus: draft\n---\n\n# Template Only"
			);

			await createFileAtPathAtomic(mockApp, "events/test.md", {
				frontmatter: { "Start Date": "2026-02-18" },
				templatePath: "templates/event.md",
			});

			const [, finalContent] = mockApp.vault.modify.mock.calls[0];
			expect(finalContent).toContain("# Template Only");
			expect(finalContent).toContain("Start Date: 2026-02-18");
		});

		it("should fall back to frontmatter+content when rendering fails", async () => {
			const sentinelFile = { path: "events/test.md" } as any;
			mockApp.vault.getFileByPath.mockReturnValue(mockTemplateFile);
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
			mockApp.vault.create.mockResolvedValue(sentinelFile);
			mockTemplaterPlugin.templater.read_and_parse_template.mockRejectedValue(new Error("Render failed"));

			await createFileAtPathAtomic(mockApp, "events/test.md", {
				content: "Fallback body",
				frontmatter: { "Start Date": "2026-02-18" },
				templatePath: "templates/event.md",
			});

			const [, fallbackContent] = mockApp.vault.modify.mock.calls[0];
			expect(fallbackContent).toContain("Start Date: 2026-02-18");
			expect(fallbackContent).toContain("Fallback body");
		});

		it("should fall back to createFileAtPath when no template path provided", async () => {
			mockApp.vault.getFileByPath.mockReturnValue(null);
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
			mockApp.vault.create.mockResolvedValue({ path: "events/test.md" });

			await createFileAtPathAtomic(mockApp, "events/test.md", {
				content: "Body text",
				frontmatter: { Status: "Inbox" },
			});

			// No template → falls back to createFileAtPath → single vault.create
			expect(mockApp.vault.create).toHaveBeenCalledTimes(1);
			const [, fileContent] = mockApp.vault.create.mock.calls[0];
			expect(fileContent).toContain("Status: Inbox");
			expect(fileContent).toContain("Body text");
			expect(mockApp.vault.modify).not.toHaveBeenCalled();
		});
	});
});
