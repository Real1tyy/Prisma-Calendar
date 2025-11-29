import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import {
	ensureFileHasZettelId,
	extractNotesCoreName,
	extractZettelId,
	generateUniqueEventPath,
	generateUniqueZettelId,
	hashRRuleIdToZettelFormat,
	isPhysicalRecurringEvent,
	rebuildPhysicalInstanceWithNewDate,
	removeZettelId,
	shouldUpdateInstanceDateOnMove,
} from "../../src/utils/calendar-events";
import { createMockApp, createMockFile } from "../mocks/obsidian";

describe("ZettelID Utilities", () => {
	describe("extractZettelId", () => {
		it("should extract ZettelID from filename with ZettelID", () => {
			const result = extractZettelId("Meeting Notes-20250106120000");
			expect(result).toBe("20250106120000");
		});

		it("should extract ZettelID from path with ZettelID", () => {
			const result = extractZettelId("Daily Task-20231225093000");
			expect(result).toBe("20231225093000");
		});

		it("should return null for filename without ZettelID", () => {
			const result = extractZettelId("Meeting Notes");
			expect(result).toBeNull();
		});

		it("should return null for filename with partial ZettelID", () => {
			const result = extractZettelId("Meeting-2025010");
			expect(result).toBeNull();
		});

		it("should return null for empty string", () => {
			const result = extractZettelId("");
			expect(result).toBeNull();
		});

		it("should handle filename with multiple number sequences", () => {
			const result = extractZettelId("2025-Meeting-Notes-20250106120000");
			expect(result).toBe("20250106120000");
		});
	});

	describe("extractNotesCoreName", () => {
		it("should remove ZettelID with hyphen from filename", () => {
			const result = extractNotesCoreName("Meeting Notes-20250106120000");
			expect(result).toBe("Meeting Notes");
		});

		it("should remove space-separated ZettelID from filename", () => {
			const result = extractNotesCoreName("Gym 20250203140530");
			expect(result).toBe("Gym");
		});

		it("should remove ISO date formats", () => {
			const result = extractNotesCoreName("Meeting - 2025-02-03");
			expect(result).toBe("Meeting");
			const result2 = extractNotesCoreName("Event - 2025-02-03 14:00");
			expect(result2).toBe("Event");
		});

		it("should remove trailing timestamps (8+ digits)", () => {
			const result = extractNotesCoreName("Task 20250203");
			expect(result).toBe("Task");
			const result2 = extractNotesCoreName("Event 123456789");
			expect(result2).toBe("Event");
		});

		it("should return original filename if no ZettelID or timestamp", () => {
			const result = extractNotesCoreName("Meeting Notes");
			expect(result).toBe("Meeting Notes");
			const result2 = extractNotesCoreName("Recurring Event");
			expect(result2).toBe("Recurring Event");
		});

		it("should handle multiple hyphens correctly", () => {
			const result = extractNotesCoreName("My-Important-Meeting-20250106120000");
			expect(result).toBe("My-Important-Meeting");
		});

		it("should not remove partial number sequences", () => {
			const result = extractNotesCoreName("Meeting-2025");
			expect(result).toBe("Meeting-2025");
		});

		it("should handle multiple spaces before timestamp", () => {
			const result = extractNotesCoreName("Event   20250203140530");
			expect(result).toBe("Event");
		});

		it("should handle empty string", () => {
			const result = extractNotesCoreName("");
			expect(result).toBe("");
		});

		it("should trim result after stripping", () => {
			const result = extractNotesCoreName("Event  20250203140530");
			expect(result).toBe("Event");
		});

		it("should remove ISO date suffix without dash separator", () => {
			const result = extractNotesCoreName("Go To The Gym 2025-10-29");
			expect(result).toBe("Go To The Gym");
			const result2 = extractNotesCoreName("Go To The Gym 2025-10-31");
			expect(result2).toBe("Go To The Gym");
		});

		it("should handle various date-suffixed event names", () => {
			expect(extractNotesCoreName("Thai Boxing 2025-10-28")).toBe("Thai Boxing");
			expect(extractNotesCoreName("Sauna 2025-11-02")).toBe("Sauna");
			expect(extractNotesCoreName("Mid Week Sprint Sync 2025-10-30")).toBe("Mid Week Sprint Sync");
		});

		it("should not remove date from middle of string", () => {
			const result = extractNotesCoreName("Event 2025-10-29 Important");
			expect(result).toBe("Event 2025-10-29 Important");
		});

		it("should handle edge case with only date", () => {
			const result = extractNotesCoreName("2025-10-29");
			expect(result).toBe("2025-10-29");
		});

		it("should remove kebab-case date suffix", () => {
			expect(extractNotesCoreName("mid-sprint-sync-2025-10-28")).toBe("mid-sprint-sync");
			expect(extractNotesCoreName("weekly-standup-2025-11-02")).toBe("weekly-standup");
			expect(extractNotesCoreName("team-meeting-2025-12-31")).toBe("team-meeting");
		});

		it("should handle multiple hyphens with date suffix", () => {
			const result = extractNotesCoreName("my-very-long-event-name-2025-10-30");
			expect(result).toBe("my-very-long-event-name");
		});

		it("should not remove date from middle of kebab-case string", () => {
			const result = extractNotesCoreName("event-2025-10-29-important");
			expect(result).toBe("event-2025-10-29-important");
		});

		it("should remove day abbreviations", () => {
			expect(extractNotesCoreName("Thai Box Tue")).toBe("Thai Box");
			expect(extractNotesCoreName("Meeting Mon")).toBe("Meeting");
			expect(extractNotesCoreName("Workout Wed")).toBe("Workout");
			expect(extractNotesCoreName("Gym Thu")).toBe("Gym");
			expect(extractNotesCoreName("Dinner Fri")).toBe("Dinner");
			expect(extractNotesCoreName("Party Sat")).toBe("Party");
			expect(extractNotesCoreName("Brunch Sun")).toBe("Brunch");
		});

		it("should remove full day names", () => {
			expect(extractNotesCoreName("Thai Box Monday")).toBe("Thai Box");
			expect(extractNotesCoreName("Meeting Tuesday")).toBe("Meeting");
			expect(extractNotesCoreName("Workout Wednesday")).toBe("Workout");
			expect(extractNotesCoreName("Gym Thursday")).toBe("Gym");
			expect(extractNotesCoreName("Dinner Friday")).toBe("Dinner");
			expect(extractNotesCoreName("Party Saturday")).toBe("Party");
			expect(extractNotesCoreName("Brunch Sunday")).toBe("Brunch");
		});

		it("should handle case-insensitive day names", () => {
			expect(extractNotesCoreName("Event tue")).toBe("Event");
			expect(extractNotesCoreName("Event TUESDAY")).toBe("Event");
			expect(extractNotesCoreName("Event TuEsDaY")).toBe("Event");
		});

		it("should not remove day names from middle of string", () => {
			const result = extractNotesCoreName("Tuesday Meeting Tomorrow");
			expect(result).toBe("Tuesday Meeting Tomorrow");
		});
	});

	describe("removeZettelId", () => {
		it("should remove ZettelID with hyphen from filename", () => {
			const result = removeZettelId("Meeting Notes-20250106120000");
			expect(result).toBe("Meeting Notes");
		});

		it("should remove space-separated ZettelID from filename", () => {
			const result = removeZettelId("Gym 20250203140530");
			expect(result).toBe("Gym");
		});

		it("should return original filename if no ZettelID", () => {
			const result = removeZettelId("Meeting Notes");
			expect(result).toBe("Meeting Notes");
		});

		it("should handle multiple hyphens correctly", () => {
			const result = removeZettelId("My-Important-Meeting-20250106120000");
			expect(result).toBe("My-Important-Meeting");
		});

		it("should handle empty string", () => {
			const result = removeZettelId("");
			expect(result).toBe("");
		});

		it("should trim result after stripping", () => {
			const result = removeZettelId("Event  20250203140530");
			expect(result).toBe("Event");
		});

		it("should NOT remove dates or day names (simpler than extractNotesCoreName)", () => {
			// removeZettelId only removes 14-digit ZettelIDs, nothing else
			expect(removeZettelId("Thai Box Tue")).toBe("Thai Box Tue");
			expect(removeZettelId("Event 2025-10-29")).toBe("Event 2025-10-29");
			expect(removeZettelId("mid-sprint-sync-2025-10-28")).toBe("mid-sprint-sync-2025-10-28");
		});
	});

	describe("generateUniqueZettelId", () => {
		it("should generate 14-digit ZettelID when path doesn't exist", () => {
			const app = createMockApp() as unknown as App;
			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

			const result = generateUniqueZettelId(app, "notes/", "Meeting");

			// Should be a 14-digit string
			expect(result).toMatch(/^\d{14}$/);
			expect(app.vault.getAbstractFileByPath).toHaveBeenCalledWith(`notes/Meeting-${result}.md`);
		});

		it("should increment ZettelID when path exists", () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("notes/Meeting-20250106120000.md");

			vi.mocked(app.vault.getAbstractFileByPath)
				.mockReturnValueOnce(mockFile) // First call: file exists
				.mockReturnValueOnce(null); // Second call: incremented ID is free

			const result = generateUniqueZettelId(app, "notes/", "Meeting");

			// Should be a 14-digit string
			expect(result).toMatch(/^\d{14}$/);
			// Should have checked twice (once for original, once for incremented)
			expect(app.vault.getAbstractFileByPath).toHaveBeenCalledTimes(2);
		});

		it("should keep incrementing until unique ID found", () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("notes/Meeting-20250106120000.md");

			vi.mocked(app.vault.getAbstractFileByPath)
				.mockReturnValueOnce(mockFile) // First attempt
				.mockReturnValueOnce(mockFile) // Second attempt
				.mockReturnValueOnce(mockFile) // Third attempt
				.mockReturnValueOnce(null); // Fourth attempt: success

			const result = generateUniqueZettelId(app, "notes/", "Meeting");

			// Should be a 14-digit string
			expect(result).toMatch(/^\d{14}$/);
			// Should have checked 4 times
			expect(app.vault.getAbstractFileByPath).toHaveBeenCalledTimes(4);
		});

		it("should handle empty basePath", () => {
			const app = createMockApp() as unknown as App;
			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

			const result = generateUniqueZettelId(app, "", "Meeting");

			expect(result).toMatch(/^\d{14}$/);
			expect(app.vault.getAbstractFileByPath).toHaveBeenCalledWith(`Meeting-${result}.md`);
		});

		it("should use fallback with random suffix after max attempts", () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("notes/Meeting-20250106120000.md");

			// Always return a file to force max attempts
			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(mockFile);

			const result = generateUniqueZettelId(app, "notes/", "Meeting");

			// Should be a 14-digit timestamp + 1-3 digit random suffix
			expect(result).toMatch(/^\d{14}\d{1,3}$/);
		});
	});

	describe("generateUniqueEventPath", () => {
		it("should generate complete event path with unique ZettelID", () => {
			const app = createMockApp() as unknown as App;
			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

			const result = generateUniqueEventPath(app, "events", "Team Meeting");

			expect(result.zettelId).toMatch(/^\d{14}$/);
			expect(result.filename).toBe(`Team Meeting-${result.zettelId}`);
			expect(result.fullPath).toBe(`events/${result.filename}.md`);
		});

		it("should handle empty directory", () => {
			const app = createMockApp() as unknown as App;
			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

			const result = generateUniqueEventPath(app, "", "Meeting");

			expect(result.zettelId).toMatch(/^\d{14}$/);
			expect(result.filename).toBe(`Meeting-${result.zettelId}`);
			expect(result.fullPath).toBe(`${result.filename}.md`);
		});

		it("should generate unique path when collision occurs", () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("events/Meeting-20250106120000.md");

			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValueOnce(mockFile).mockReturnValueOnce(null);

			const result = generateUniqueEventPath(app, "events", "Meeting");

			expect(result.zettelId).toMatch(/^\d{14}$/);
			expect(result.filename).toBe(`Meeting-${result.zettelId}`);
			expect(result.fullPath).toBe(`events/${result.filename}.md`);
			// Should have checked twice due to collision
			expect(app.vault.getAbstractFileByPath).toHaveBeenCalledTimes(2);
		});

		it("should normalize directory with trailing slash", () => {
			const app = createMockApp() as unknown as App;
			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

			const result = generateUniqueEventPath(app, "events/", "Meeting");

			// Should not have double slashes
			expect(result.fullPath).not.toMatch(/\/\//);
			expect(result.fullPath).toMatch(/^events\/Meeting-\d{14}\.md$/);
		});
	});

	describe("ensureFileHasZettelId", () => {
		it("should return existing ZettelID if file already has one", async () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("events/Meeting-20250106120000.md");
			mockFile.basename = "Meeting-20250106120000";

			const result = await ensureFileHasZettelId(app, mockFile);

			expect(result.zettelId).toBe("20250106120000");
			expect(result.file).toBe(mockFile);
			expect(app.fileManager.renameFile).not.toHaveBeenCalled();
		});

		it("should embed ZettelID in frontmatter if it exists but not in frontmatter", async () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("events/Meeting-20250106120000.md");
			mockFile.basename = "Meeting-20250106120000";

			const result = await ensureFileHasZettelId(app, mockFile, "zettelId");

			expect(result.zettelId).toBe("20250106120000");
			// Should update frontmatter
			expect(app.fileManager.processFrontMatter).toHaveBeenCalled();
		});

		it("should generate and embed ZettelID if file doesn't have one", async () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("events/Meeting.md");
			mockFile.basename = "Meeting";
			mockFile.parent = { path: "events" } as any;

			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

			const result = await ensureFileHasZettelId(app, mockFile, "zettelId");

			expect(result.zettelId).toMatch(/^\d{14}$/);
			expect(app.fileManager.renameFile).toHaveBeenCalledWith(mockFile, `events/Meeting-${result.zettelId}.md`);
			expect(app.fileManager.processFrontMatter).toHaveBeenCalled();
		});

		it("should handle file without parent directory", async () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("Meeting.md");
			mockFile.basename = "Meeting";
			mockFile.parent = null;

			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

			const result = await ensureFileHasZettelId(app, mockFile);

			expect(result.zettelId).toMatch(/^\d{14}$/);
			expect(app.fileManager.renameFile).toHaveBeenCalledWith(mockFile, `Meeting-${result.zettelId}.md`);
		});

		it("should generate unique ZettelID when collision occurs", async () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("events/Meeting.md");
			mockFile.basename = "Meeting";
			mockFile.parent = { path: "events" } as any;

			const existingFile = createMockFile("events/Meeting-20250106120000.md");

			vi.mocked(app.vault.getAbstractFileByPath)
				.mockReturnValueOnce(existingFile) // Collision
				.mockReturnValueOnce(null); // Success

			const result = await ensureFileHasZettelId(app, mockFile);

			expect(result.zettelId).toMatch(/^\d{14}$/);
			// Should have checked twice due to collision
			expect(app.vault.getAbstractFileByPath).toHaveBeenCalledTimes(2);
		});

		it("should work without zettelIdProp parameter", async () => {
			const app = createMockApp() as unknown as App;
			const mockFile = createMockFile("events/Meeting-20250106120000.md");
			mockFile.basename = "Meeting-20250106120000";

			const result = await ensureFileHasZettelId(app, mockFile);

			expect(result.zettelId).toBe("20250106120000");
			expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
		});
	});

	describe("Integration: Batch Clone Scenario", () => {
		it("should handle multiple files with same name getting unique ZettelIDs", () => {
			const app = createMockApp() as unknown as App;

			// First clone - no collision
			vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);
			const result1 = generateUniqueEventPath(app, "events", "Meeting");
			expect(result1.zettelId).toMatch(/^\d{14}$/);

			// Simulate first file now exists
			const mockFile1 = createMockFile(`events/Meeting-${result1.zettelId}.md`);

			// Second clone - collision with first
			vi.mocked(app.vault.getAbstractFileByPath)
				.mockReturnValueOnce(mockFile1) // Collision
				.mockReturnValueOnce(null); // Success with incremented ID

			const result2 = generateUniqueEventPath(app, "events", "Meeting");
			expect(result2.zettelId).toMatch(/^\d{14}$/);
			// Should be different from first
			expect(result2.zettelId).not.toBe(result1.zettelId);

			// Third clone - collision with both previous
			const mockFile2 = createMockFile(`events/Meeting-${result2.zettelId}.md`);

			vi.mocked(app.vault.getAbstractFileByPath)
				.mockReturnValueOnce(mockFile1) // First collision
				.mockReturnValueOnce(mockFile2) // Second collision
				.mockReturnValueOnce(null); // Success with doubly-incremented ID

			const result3 = generateUniqueEventPath(app, "events", "Meeting");
			expect(result3.zettelId).toMatch(/^\d{14}$/);
			// Should be different from both previous
			expect(result3.zettelId).not.toBe(result1.zettelId);
			expect(result3.zettelId).not.toBe(result2.zettelId);
		});
	});

	describe("hashRRuleIdToZettelFormat", () => {
		it("should generate a deterministic 14-digit hash", () => {
			const rRuleId = "1730000000000-abc12";
			const hash = hashRRuleIdToZettelFormat(rRuleId);

			expect(hash).toMatch(/^\d{14}$/);
			expect(hash.length).toBe(14);
		});

		it("should be deterministic (same input = same output)", () => {
			const rRuleId = "1730000000000-abc12";
			const hash1 = hashRRuleIdToZettelFormat(rRuleId);
			const hash2 = hashRRuleIdToZettelFormat(rRuleId);

			expect(hash1).toBe(hash2);
		});

		it("should generate different hashes for different rRuleIds", () => {
			const rRuleId1 = "1730000000000-abc12";
			const rRuleId2 = "1730000000000-xyz99";
			const hash1 = hashRRuleIdToZettelFormat(rRuleId1);
			const hash2 = hashRRuleIdToZettelFormat(rRuleId2);

			expect(hash1).not.toBe(hash2);
		});

		it("should handle short rRuleIds", () => {
			const rRuleId = "abc";
			const hash = hashRRuleIdToZettelFormat(rRuleId);

			expect(hash).toMatch(/^\d{14}$/);
		});

		it("should handle long rRuleIds", () => {
			const rRuleId = "very-long-rrule-id-with-many-characters-1234567890";
			const hash = hashRRuleIdToZettelFormat(rRuleId);

			expect(hash).toMatch(/^\d{14}$/);
		});

		it("should pad with leading zeros when necessary", () => {
			const rRuleId = "a"; // Short input likely produces small hash
			const hash = hashRRuleIdToZettelFormat(rRuleId);

			expect(hash.length).toBe(14);
			expect(hash).toMatch(/^\d{14}$/);
		});

		it("should generate stable hashes for common rRuleId formats", () => {
			const rRuleIds = ["1730000000000-abc12", "1730000000000-xyz99", "1730123456789-def45", "1730987654321-ghi78"];

			const hashes = rRuleIds.map((id) => hashRRuleIdToZettelFormat(id));

			// All should be 14 digits
			hashes.forEach((hash) => {
				expect(hash).toMatch(/^\d{14}$/);
			});

			// All should be unique
			const uniqueHashes = new Set(hashes);
			expect(uniqueHashes.size).toBe(rRuleIds.length);
		});

		it("should maintain consistency across multiple calls", () => {
			const rRuleId = "1730000000000-test123";
			const hashes = Array.from({ length: 100 }, () => hashRRuleIdToZettelFormat(rRuleId));

			// All hashes should be identical
			const uniqueHashes = new Set(hashes);
			expect(uniqueHashes.size).toBe(1);
		});

		it("should work with rRuleIds containing special characters", () => {
			const rRuleId = "1730000000000-special_chars!@#$%";
			const hash = hashRRuleIdToZettelFormat(rRuleId);

			expect(hash).toMatch(/^\d{14}$/);
		});

		it("should be compatible with existing zettel ID format", () => {
			const rRuleId = "1730000000000-abc12";
			const hash = hashRRuleIdToZettelFormat(rRuleId);

			// Should be extractable by extractZettelId
			const filename = `My Event 2025-01-15-${hash}`;
			const extracted = extractZettelId(filename);
			expect(extracted).toBe(hash);
		});

		it("should be removable by removeZettelId", () => {
			const rRuleId = "1730000000000-abc12";
			const hash = hashRRuleIdToZettelFormat(rRuleId);
			const filename = `My Event-${hash}`;

			const cleaned = removeZettelId(filename);
			expect(cleaned).toBe("My Event");
		});
	});
});

describe("Physical Recurring Event Utilities", () => {
	describe("rebuildPhysicalInstanceWithNewDate", () => {
		it("should rebuild filename with new date", () => {
			const basename = "Weekly Meeting 2025-01-15-12345678901234";
			const newDate = "2025-01-22";
			const result = rebuildPhysicalInstanceWithNewDate(basename, newDate);
			expect(result).toBe("Weekly Meeting 2025-01-22-12345678901234");
		});

		it("should handle multi-word titles", () => {
			const basename = "My Important Team Meeting 2025-02-10-98765432109876";
			const newDate = "2025-02-17";
			const result = rebuildPhysicalInstanceWithNewDate(basename, newDate);
			expect(result).toBe("My Important Team Meeting 2025-02-17-98765432109876");
		});

		it("should return null for invalid format (no date)", () => {
			const basename = "Meeting-12345678901234";
			const newDate = "2025-01-22";
			const result = rebuildPhysicalInstanceWithNewDate(basename, newDate);
			expect(result).toBeNull();
		});

		it("should return null for invalid format (no zettel id)", () => {
			const basename = "Meeting 2025-01-15";
			const newDate = "2025-01-22";
			const result = rebuildPhysicalInstanceWithNewDate(basename, newDate);
			expect(result).toBeNull();
		});

		it("should return null for invalid format (wrong zettel id length)", () => {
			const basename = "Meeting 2025-01-15-123456";
			const newDate = "2025-01-22";
			const result = rebuildPhysicalInstanceWithNewDate(basename, newDate);
			expect(result).toBeNull();
		});

		it("should preserve zettel id exactly", () => {
			const basename = "Event 2025-03-01-00000000000001";
			const newDate = "2025-03-08";
			const result = rebuildPhysicalInstanceWithNewDate(basename, newDate);
			expect(result).toBe("Event 2025-03-08-00000000000001");
		});

		it("should handle titles with numbers", () => {
			const basename = "Task 123 2025-01-15-12345678901234";
			const newDate = "2025-01-16";
			const result = rebuildPhysicalInstanceWithNewDate(basename, newDate);
			expect(result).toBe("Task 123 2025-01-16-12345678901234");
		});

		it("should handle titles with special characters", () => {
			const basename = "Team Sync (Weekly) 2025-01-15-12345678901234";
			const newDate = "2025-01-22";
			const result = rebuildPhysicalInstanceWithNewDate(basename, newDate);
			expect(result).toBe("Team Sync (Weekly) 2025-01-22-12345678901234");
		});
	});

	describe("isPhysicalRecurringEvent", () => {
		const rruleIdProp = "RRuleID";
		const rruleProp = "RRule";
		const instanceDateProp = "Recurring Instance Date";

		it("should return true for physical recurring event", () => {
			const frontmatter = {
				[rruleIdProp]: "1730000000000-abc12",
				[instanceDateProp]: "2025-01-15",
				Source: "[[Source Event]]",
			};
			expect(isPhysicalRecurringEvent(frontmatter, rruleIdProp, rruleProp, instanceDateProp)).toBe(true);
		});

		it("should return false for source event (has RRule)", () => {
			const frontmatter = {
				[rruleIdProp]: "1730000000000-abc12",
				[instanceDateProp]: "2025-01-15",
				[rruleProp]: "every week",
			};
			expect(isPhysicalRecurringEvent(frontmatter, rruleIdProp, rruleProp, instanceDateProp)).toBe(false);
		});

		it("should return false if missing rruleId", () => {
			const frontmatter = {
				[instanceDateProp]: "2025-01-15",
			};
			expect(isPhysicalRecurringEvent(frontmatter, rruleIdProp, rruleProp, instanceDateProp)).toBe(false);
		});

		it("should return false if missing instanceDate", () => {
			const frontmatter = {
				[rruleIdProp]: "1730000000000-abc12",
			};
			expect(isPhysicalRecurringEvent(frontmatter, rruleIdProp, rruleProp, instanceDateProp)).toBe(false);
		});

		it("should return false for undefined frontmatter", () => {
			expect(isPhysicalRecurringEvent(undefined, rruleIdProp, rruleProp, instanceDateProp)).toBe(false);
		});

		it("should return false for regular event", () => {
			const frontmatter = {
				Title: "Regular Event",
				"Start Date": "2025-01-15T10:00",
			};
			expect(isPhysicalRecurringEvent(frontmatter, rruleIdProp, rruleProp, instanceDateProp)).toBe(false);
		});

		it("should work with custom instanceDateProp name", () => {
			const customInstanceDateProp = "Custom Instance Date";
			const frontmatter = {
				[rruleIdProp]: "1730000000000-abc12",
				[customInstanceDateProp]: "2025-01-15",
			};
			expect(isPhysicalRecurringEvent(frontmatter, rruleIdProp, rruleProp, customInstanceDateProp)).toBe(true);
		});
	});

	describe("shouldUpdateInstanceDateOnMove", () => {
		const ignoreRecurringProp = "Ignore Recurring";

		it("should return true when ignoreRecurring is true", () => {
			const frontmatter = {
				[ignoreRecurringProp]: true,
				RRuleID: "1730000000000-abc12",
			};
			expect(shouldUpdateInstanceDateOnMove(frontmatter, ignoreRecurringProp)).toBe(true);
		});

		it("should return false when ignoreRecurring is false", () => {
			const frontmatter = {
				[ignoreRecurringProp]: false,
				RRuleID: "1730000000000-abc12",
			};
			expect(shouldUpdateInstanceDateOnMove(frontmatter, ignoreRecurringProp)).toBe(false);
		});

		it("should return false when ignoreRecurring is not present", () => {
			const frontmatter = {
				RRuleID: "1730000000000-abc12",
			};
			expect(shouldUpdateInstanceDateOnMove(frontmatter, ignoreRecurringProp)).toBe(false);
		});

		it("should return false for undefined frontmatter", () => {
			expect(shouldUpdateInstanceDateOnMove(undefined, ignoreRecurringProp)).toBe(false);
		});

		it("should return false when ignoreRecurring is string 'true' (not boolean)", () => {
			const frontmatter = {
				[ignoreRecurringProp]: "true",
			};
			expect(shouldUpdateInstanceDateOnMove(frontmatter, ignoreRecurringProp)).toBe(false);
		});

		it("should handle different prop names", () => {
			const customProp = "Skip Instance";
			const frontmatter = {
				[customProp]: true,
			};
			expect(shouldUpdateInstanceDateOnMove(frontmatter, customProp)).toBe(true);
		});
	});
});
