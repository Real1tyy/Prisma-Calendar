import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PENDING_WRITE_SENTINEL } from "../../src/core/file/templater";
import { TemplaterService } from "../../src/core/file/templater-service";
import { createMockApp } from "../../src/testing/mocks/obsidian";

describe("TemplaterService", () => {
	let mockApp: any;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();

		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		mockApp = createMockApp({
			vault: {
				create: vi.fn().mockResolvedValue({ path: "test.md", basename: "test" }),
				getFileByPath: vi.fn().mockReturnValue(null),
				getAbstractFileByPath: vi.fn().mockReturnValue(null),
			},
			fileManager: {
				processFrontMatter: vi.fn().mockResolvedValue(undefined),
			},
		});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	describe("createFile with content", () => {
		it("should apply frontmatter when creating file with content", async () => {
			const service = new TemplaterService(mockApp);

			const frontmatter = {
				"Start Date": "2025-11-20T20:00:00.000Z",
				"End Date": "2025-11-20T20:20:00.000Z",
				RRuleID: "test-123",
				"Recurring Instance Date": "2025-11-20",
			};

			await service.createFile({
				title: "Test Event",
				targetDirectory: "Calendar",
				filename: "Test Event 2025-11-20-12345678901234",
				content: "# Test Event\n\nEvent content here",
				frontmatter,
			});

			// Verify file was created with frontmatter atomically (no separate processFrontMatter call)
			expect(mockApp.vault.create).toHaveBeenCalledTimes(1);
			const [filePath, fileContent] = mockApp.vault.create.mock.calls[0];

			expect(filePath).toContain("Test Event");
			// File content should include YAML frontmatter
			expect(fileContent).toContain("---");
			expect(fileContent).toContain("Start Date: 2025-11-20T20:00:00.000Z");
			expect(fileContent).toContain("End Date: 2025-11-20T20:20:00.000Z");
			expect(fileContent).toContain("RRuleID: test-123");
			expect(fileContent).toContain("Recurring Instance Date: 2025-11-20");
			expect(fileContent).toContain("# Test Event");
			expect(fileContent).toContain("Event content here");

			expect(mockApp.fileManager.processFrontMatter).not.toHaveBeenCalled();
		});

		it("should preserve UTC Z suffix in timestamps", async () => {
			const service = new TemplaterService(mockApp);

			const frontmatter = {
				"Start Date": "2025-09-29T20:00:00.000Z",
				"End Date": "2025-09-29T20:20:00.000Z",
			};

			await service.createFile({
				title: "Test Event",
				targetDirectory: "Calendar",
				content: "Event body",
				frontmatter,
			});

			// Verify file was created with frontmatter atomically
			expect(mockApp.vault.create).toHaveBeenCalledTimes(1);
			const [, fileContent] = mockApp.vault.create.mock.calls[0];

			// Verify Z suffix is preserved (not converted to +01:00 or other local offset)
			expect(fileContent).toContain("Start Date: 2025-09-29T20:00:00.000Z");
			expect(fileContent).toContain("End Date: 2025-09-29T20:20:00.000Z");
		});

		it("should not apply frontmatter if not provided", async () => {
			const service = new TemplaterService(mockApp);

			await service.createFile({
				title: "Test Event",
				targetDirectory: "Calendar",
				content: "Event body",
			});

			// Verify file was created
			expect(mockApp.vault.create).toHaveBeenCalledTimes(1);

			// Verify frontmatter was NOT applied (no frontmatter provided)
			expect(mockApp.fileManager.processFrontMatter).not.toHaveBeenCalled();
		});

		it("should not apply frontmatter if empty object", async () => {
			const service = new TemplaterService(mockApp);

			await service.createFile({
				title: "Test Event",
				targetDirectory: "Calendar",
				content: "Event body",
				frontmatter: {},
			});

			// Verify file was created
			expect(mockApp.vault.create).toHaveBeenCalledTimes(1);

			// Verify frontmatter was NOT applied (empty frontmatter)
			expect(mockApp.fileManager.processFrontMatter).not.toHaveBeenCalled();
		});

		it("should apply all frontmatter properties correctly", async () => {
			const service = new TemplaterService(mockApp);

			const frontmatter = {
				"Start Date": "2025-11-20T19:00:00.000Z",
				"End Date": "2025-11-20T19:20:00.000Z",
				"All Day": false,
				RRuleID: "1730000000000-abc12",
				"Recurring Instance Date": "2025-11-20",
				Source: "[[Recurring Event Source]]",
				Goal: ["[[Goals/Mid Week Sprint Sync|Mid Week Sprint Sync]]"],
				"Backlink Tags": [
					"[[Tags/Obsidian|Obsidian]]",
					"[[Tags/Remarkable|Remarkable]]",
					"[[Tags/Productivity|Productivity]]",
				],
			};

			await service.createFile({
				title: "Physical Event",
				targetDirectory: "Calendar",
				filename: "Physical Event 2025-11-20-12345678901234",
				content: "# Physical Event\n\nBody content",
				frontmatter,
			});

			// Verify file was created with all frontmatter atomically
			expect(mockApp.vault.create).toHaveBeenCalledTimes(1);
			const [, fileContent] = mockApp.vault.create.mock.calls[0];

			// Verify all properties are in the file content
			expect(fileContent).toContain("Start Date: 2025-11-20T19:00:00.000Z");
			expect(fileContent).toContain("End Date: 2025-11-20T19:20:00.000Z");
			expect(fileContent).toContain("All Day: false");
			expect(fileContent).toContain("RRuleID: 1730000000000-abc12");
			expect(fileContent).toContain("Recurring Instance Date: 2025-11-20");
			expect(fileContent).toContain('Source: "[[Recurring Event Source]]"');
			expect(fileContent).toContain("[[Goals/Mid Week Sprint Sync|Mid Week Sprint Sync]]");
			expect(fileContent).toContain("[[Tags/Obsidian|Obsidian]]");
			expect(fileContent).toContain("# Physical Event");
			expect(fileContent).toContain("Body content");
		});
	});

	describe("createFile without content", () => {
		it("should create file manually without applying frontmatter when no content", async () => {
			const service = new TemplaterService(mockApp);

			await service.createFile({
				title: "New Event",
				targetDirectory: "Calendar",
			});

			// Verify file was created with empty content
			expect(mockApp.vault.create).toHaveBeenCalledTimes(1);
			expect(mockApp.vault.create).toHaveBeenCalledWith(expect.any(String), "");

			// Verify frontmatter was NOT applied (no content path)
			expect(mockApp.fileManager.processFrontMatter).not.toHaveBeenCalled();
		});
	});

	describe("renderTemplate", () => {
		const mockTargetFile = { path: "Calendar/Team Meeting.md", basename: "Team Meeting" } as any;

		it("should return rendered content with merged frontmatter", async () => {
			const mockTemplaterPlugin = {
				templater: {
					read_and_parse_template: vi.fn().mockResolvedValue("---\nStatus: draft\n---\n\nBody"),
				},
			};
			const appWithTemplater = {
				plugins: { getPlugin: vi.fn(() => mockTemplaterPlugin) },
				vault: {
					getFileByPath: vi.fn().mockReturnValue({ path: "templates/event.md", basename: "event" }),
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
					create: vi.fn(),
					modify: vi.fn(),
				},
			} as any;

			const service = new TemplaterService(appWithTemplater);
			const result = await service.renderTemplate("templates/event.md", mockTargetFile, {
				Status: "confirmed",
				"Start Date": "2026-02-17",
			});

			expect(result).toContain("Status: confirmed");
			expect(result).not.toContain("Status: draft");
			expect(result).toContain("Start Date: 2026-02-17");
			expect(appWithTemplater.vault.create).not.toHaveBeenCalled();
			expect(appWithTemplater.vault.modify).not.toHaveBeenCalled();
		});

		it("should return null when Templater is not available", async () => {
			const service = new TemplaterService(mockApp);
			const result = await service.renderTemplate("templates/event.md", mockTargetFile);
			expect(result).toBeNull();
		});
	});

	describe("createFileAtomic", () => {
		it("should create empty file then modify with rendered+merged content", async () => {
			const emptyFile = { path: "Calendar/Team Meeting.md" } as any;
			const mockTemplaterPlugin = {
				templater: {
					read_and_parse_template: vi.fn().mockResolvedValue("# Rendered"),
				},
			};
			const appWithTemplater = {
				plugins: { getPlugin: vi.fn(() => mockTemplaterPlugin) },
				vault: {
					getFileByPath: vi.fn().mockReturnValue({ path: "templates/event.md", basename: "event" }),
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
					create: vi.fn().mockResolvedValue(emptyFile),
					modify: vi.fn().mockResolvedValue(undefined),
				},
			} as any;

			const service = new TemplaterService(appWithTemplater);
			const result = await service.createFileAtomic({
				title: "Team Meeting",
				targetDirectory: "Calendar",
				templatePath: "templates/event.md",
				useTemplater: true,
				frontmatter: { "Start Date": "2026-02-17" },
			});

			// Step 1: sentinel file created (non-empty so Templater's folder handler skips it)
			expect(appWithTemplater.vault.create).toHaveBeenCalledWith("Calendar/Team Meeting.md", PENDING_WRITE_SENTINEL);
			// Step 2: single modify with complete content
			expect(appWithTemplater.vault.modify).toHaveBeenCalledTimes(1);
			const [, modifiedContent] = appWithTemplater.vault.modify.mock.calls[0];
			expect(modifiedContent).toContain("Start Date: 2026-02-17");
			expect(result).toBe(emptyFile);
		});

		it("should write frontmatter-only content when rendering fails", async () => {
			const emptyFile = { path: "Calendar/Team Meeting.md" } as any;
			const mockTemplaterPlugin = {
				templater: {
					read_and_parse_template: vi.fn().mockRejectedValue(new Error("Render failed")),
				},
			};
			const appWithTemplater = {
				plugins: { getPlugin: vi.fn(() => mockTemplaterPlugin) },
				vault: {
					getFileByPath: vi.fn().mockReturnValue({ path: "templates/event.md", basename: "event" }),
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
					create: vi.fn().mockResolvedValue(emptyFile),
					modify: vi.fn().mockResolvedValue(undefined),
				},
			} as any;

			const service = new TemplaterService(appWithTemplater);
			const result = await service.createFileAtomic({
				title: "Team Meeting",
				targetDirectory: "Calendar",
				templatePath: "templates/event.md",
				useTemplater: true,
				frontmatter: { "Start Date": "2026-02-17" },
			});

			// Falls back to frontmatter-only content (no template body)
			expect(appWithTemplater.vault.modify).toHaveBeenCalledTimes(1);
			const [, fallbackContent] = appWithTemplater.vault.modify.mock.calls[0];
			expect(fallbackContent).toContain("Start Date: 2026-02-17");
			expect(result).toBe(emptyFile);
		});

		it("should fall back to manual creation when Templater is unavailable", async () => {
			const service = new TemplaterService(mockApp);

			await service.createFileAtomic({
				title: "Team Meeting",
				targetDirectory: "Calendar",
				templatePath: "templates/event.md",
				useTemplater: true,
			});

			// Falls back to createFileManually → vault.create with empty content
			expect(mockApp.vault.create).toHaveBeenCalledWith(expect.stringContaining("Team Meeting"), "");
		});

		it("should fall back to manual creation when content is provided but Templater unavailable", async () => {
			const service = new TemplaterService(mockApp);

			await service.createFileAtomic({
				title: "Team Meeting",
				targetDirectory: "Calendar",
				content: "# Body",
				frontmatter: { "Start Date": "2026-02-17" },
				templatePath: "templates/event.md",
				useTemplater: true,
			});

			// No Templater plugin → falls back to createFileAtPath (manual creation)
			expect(mockApp.vault.create).toHaveBeenCalledTimes(1);
			const [, fileContent] = mockApp.vault.create.mock.calls[0];
			expect(fileContent).toContain("Start Date: 2026-02-17");
			expect(fileContent).toContain("# Body");
		});
	});

	describe("createFileAtomic with content + template", () => {
		it("should render template and append content when both are provided", async () => {
			const emptyFile = { path: "Calendar/Team Meeting.md" } as any;
			const mockTemplaterPlugin = {
				templater: {
					read_and_parse_template: vi.fn().mockResolvedValue("---\nStatus: draft\n---\n\n# Template Heading"),
				},
			};
			const appWithTemplater = {
				plugins: { getPlugin: vi.fn(() => mockTemplaterPlugin) },
				vault: {
					getFileByPath: vi.fn().mockReturnValue({ path: "templates/event.md", basename: "event" }),
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
					create: vi.fn().mockResolvedValue(emptyFile),
					modify: vi.fn().mockResolvedValue(undefined),
				},
			} as any;

			const service = new TemplaterService(appWithTemplater);
			const result = await service.createFileAtomic({
				title: "Team Meeting",
				targetDirectory: "Calendar",
				content: "Source body content",
				templatePath: "templates/event.md",
				useTemplater: true,
				frontmatter: { "Start Date": "2026-02-17" },
			});

			// sentinel file created
			expect(appWithTemplater.vault.create).toHaveBeenCalledTimes(1);
			// single modify with rendered template + appended content
			expect(appWithTemplater.vault.modify).toHaveBeenCalledTimes(1);
			const [, modifiedContent] = appWithTemplater.vault.modify.mock.calls[0];
			// Frontmatter overrides applied
			expect(modifiedContent).toContain("Start Date: 2026-02-17");
			// Template body preserved
			expect(modifiedContent).toContain("# Template Heading");
			// Source content appended after template body
			expect(modifiedContent).toContain("Source body content");
			// Content appears after template heading
			const headingIdx = (modifiedContent as string).indexOf("# Template Heading");
			const contentIdx = (modifiedContent as string).indexOf("Source body content");
			expect(contentIdx).toBeGreaterThan(headingIdx);
			expect(result).toBe(emptyFile);
		});

		it("should only render template when content is empty", async () => {
			const emptyFile = { path: "Calendar/Team Meeting.md" } as any;
			const mockTemplaterPlugin = {
				templater: {
					read_and_parse_template: vi.fn().mockResolvedValue("---\nStatus: draft\n---\n\n# Template Only"),
				},
			};
			const appWithTemplater = {
				plugins: { getPlugin: vi.fn(() => mockTemplaterPlugin) },
				vault: {
					getFileByPath: vi.fn().mockReturnValue({ path: "templates/event.md", basename: "event" }),
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
					create: vi.fn().mockResolvedValue(emptyFile),
					modify: vi.fn().mockResolvedValue(undefined),
				},
			} as any;

			const service = new TemplaterService(appWithTemplater);
			await service.createFileAtomic({
				title: "Team Meeting",
				targetDirectory: "Calendar",
				templatePath: "templates/event.md",
				useTemplater: true,
				frontmatter: { "Start Date": "2026-02-17" },
			});

			const [, modifiedContent] = appWithTemplater.vault.modify.mock.calls[0];
			expect(modifiedContent).toContain("# Template Only");
			expect(modifiedContent).toContain("Start Date: 2026-02-17");
		});
	});

	describe("integration with recurring events", () => {
		it("should correctly handle frontmatter from recurring event manager", async () => {
			const service = new TemplaterService(mockApp);

			// Simulate the exact frontmatter structure created by RecurringEventManager
			const instanceFrontmatter = {
				RRuleID: "1730000000000-abc12",
				"Recurring Instance Date": "2025-11-20",
				Source: "[[Recurring Source Note]]",
				"Start Date": "2025-11-20T20:00:00.000Z", // Generated by calculateInstanceTimes + toUTC().toISO()
				"End Date": "2025-11-20T20:20:00.000Z",
				"All Day": false,
				Goal: ["[[Goals/Mid Week Sprint Sync|Mid Week Sprint Sync]]"],
			};

			await service.createFile({
				title: "Physical Event Instance 2025-11-20-12345678901234",
				targetDirectory: "Calendar",
				filename: "Physical Event Instance 2025-11-20-12345678901234",
				content: "# Event Instance\n\nInherited content from source",
				frontmatter: instanceFrontmatter,
			});

			// Verify file was created with frontmatter atomically
			expect(mockApp.vault.create).toHaveBeenCalledTimes(1);
			const [, fileContent] = mockApp.vault.create.mock.calls[0];

			// Verify UTC timestamps with Z are preserved exactly as generated
			expect(fileContent).toContain("Start Date: 2025-11-20T20:00:00.000Z");
			expect(fileContent).toContain("End Date: 2025-11-20T20:20:00.000Z");
			expect(fileContent).toContain("All Day: false");
			expect(fileContent).toContain("RRuleID: 1730000000000-abc12");
			expect(fileContent).toContain("# Event Instance");
		});
	});
});
