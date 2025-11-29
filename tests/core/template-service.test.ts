import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TemplateService } from "../../src/core/templates";

describe("TemplateService", () => {
	let mockApp: any;
	let mockIndexer: any;
	let mockSettingsStore: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockApp = {
			vault: {
				create: vi.fn().mockResolvedValue({ path: "test.md", basename: "test" }),
				getFileByPath: vi.fn().mockReturnValue(null),
				getAbstractFileByPath: vi.fn().mockReturnValue(null), // Required by generateUniqueFilePath
			},
			fileManager: {
				processFrontMatter: vi.fn().mockResolvedValue(undefined),
			},
		};

		const mockSingleSettings = {
			id: "default",
			name: "Main Calendar",
			enabled: true,
			directory: "Calendar",
			startProp: "Start Date",
			endProp: "End Date",
			templatePath: "",
		};

		mockSettingsStore = new BehaviorSubject(mockSingleSettings);

		mockIndexer = {
			events$: {
				subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
			},
		};
	});

	describe("createFile with content", () => {
		it("should apply frontmatter when creating file with content", async () => {
			const service = new TemplateService(mockApp, mockSettingsStore, mockIndexer);

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

			// Verify file was created
			expect(mockApp.vault.create).toHaveBeenCalledTimes(1);
			expect(mockApp.vault.create).toHaveBeenCalledWith(
				expect.stringContaining("Test Event"),
				"# Test Event\n\nEvent content here"
			);

			// Verify frontmatter was applied
			expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalledTimes(1);
			const [_file, callback] = mockApp.fileManager.processFrontMatter.mock.calls[0];

			// Simulate processFrontMatter calling the callback with empty frontmatter
			const fm: Record<string, unknown> = {};
			callback(fm);

			// Verify frontmatter was assigned correctly
			expect(fm["Start Date"]).toBe("2025-11-20T20:00:00.000Z");
			expect(fm["End Date"]).toBe("2025-11-20T20:20:00.000Z");
			expect(fm.RRuleID).toBe("test-123");
			expect(fm["Recurring Instance Date"]).toBe("2025-11-20");
		});

		it("should preserve UTC Z suffix in timestamps", async () => {
			const service = new TemplateService(mockApp, mockSettingsStore, mockIndexer);

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

			// Verify frontmatter was applied
			expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalled();
			const [_file2, callback2] = mockApp.fileManager.processFrontMatter.mock.calls[0];

			const fm2: Record<string, unknown> = {};
			callback2(fm2);

			// Verify Z suffix is preserved (not converted to +01:00 or other local offset)
			expect(fm2["Start Date"]).toBe("2025-09-29T20:00:00.000Z");
			expect(fm2["End Date"]).toBe("2025-09-29T20:20:00.000Z");
			expect(fm2["Start Date"]).toContain("Z");
			expect(fm2["Start Date"]).not.toContain("+01:00");
			expect(fm2["Start Date"]).not.toContain("+00:00");
		});

		it("should not apply frontmatter if not provided", async () => {
			const service = new TemplateService(mockApp, mockSettingsStore, mockIndexer);

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
			const service = new TemplateService(mockApp, mockSettingsStore, mockIndexer);

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
			const service = new TemplateService(mockApp, mockSettingsStore, mockIndexer);

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

			// Verify frontmatter was applied
			expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalled();
			const [_file3, callback3] = mockApp.fileManager.processFrontMatter.mock.calls[0];

			const fm3: Record<string, unknown> = {};
			callback3(fm3);

			// Verify all properties are correctly assigned
			expect(fm3["Start Date"]).toBe("2025-11-20T19:00:00.000Z");
			expect(fm3["End Date"]).toBe("2025-11-20T19:20:00.000Z");
			expect(fm3["All Day"]).toBe(false);
			expect(fm3.RRuleID).toBe("1730000000000-abc12");
			expect(fm3["Recurring Instance Date"]).toBe("2025-11-20");
			expect(fm3.Source).toBe("[[Recurring Event Source]]");
			expect(fm3.Goal).toEqual(["[[Goals/Mid Week Sprint Sync|Mid Week Sprint Sync]]"]);
			expect(fm3["Backlink Tags"]).toEqual([
				"[[Tags/Obsidian|Obsidian]]",
				"[[Tags/Remarkable|Remarkable]]",
				"[[Tags/Productivity|Productivity]]",
			]);
		});
	});

	describe("createFile without content", () => {
		it("should create file manually without applying frontmatter when no content", async () => {
			const service = new TemplateService(mockApp, mockSettingsStore, mockIndexer);

			await service.createFile({
				title: "New Event",
				targetDirectory: "Calendar",
			});

			// Verify file was created
			expect(mockApp.vault.create).toHaveBeenCalledTimes(1);
			expect(mockApp.vault.create).toHaveBeenCalledWith(expect.any(String), "# New Event\n\n");

			// Verify frontmatter was NOT applied (no content path)
			expect(mockApp.fileManager.processFrontMatter).not.toHaveBeenCalled();
		});
	});

	describe("integration with recurring events", () => {
		it("should correctly handle frontmatter from recurring event manager", async () => {
			const service = new TemplateService(mockApp, mockSettingsStore, mockIndexer);

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

			// Verify frontmatter was applied
			expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalled();
			const [_file4, callback4] = mockApp.fileManager.processFrontMatter.mock.calls[0];

			const fm4: Record<string, unknown> = {};
			callback4(fm4);

			// Verify UTC timestamps with Z are preserved exactly as generated
			expect(fm4["Start Date"]).toBe("2025-11-20T20:00:00.000Z");
			expect(fm4["End Date"]).toBe("2025-11-20T20:20:00.000Z");

			// Verify no timezone offset conversion occurred
			expect(typeof fm4["Start Date"]).toBe("string");
			expect((fm4["Start Date"] as string).endsWith("Z")).toBe(true);
			expect(fm4["Start Date"] as string).not.toContain("+01:00");
			expect(fm4["Start Date"] as string).not.toContain("+00:00");
		});
	});
});
