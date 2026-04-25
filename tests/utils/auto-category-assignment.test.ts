import { describe, expect, it } from "vitest";

import type { SingleCalendarConfig } from "../../src/types/settings";
import { autoAssignCategories, normalizeEventNameForComparison } from "../../src/utils/event-matching";

describe("Auto-Category Assignment", () => {
	describe("normalizeEventNameForComparison", () => {
		it("should remove ZettelID with hyphen format", () => {
			const result = normalizeEventNameForComparison("Health-20250103123456");
			expect(result).toBe("health");
		});

		it("should remove ZettelID with space format", () => {
			const result = normalizeEventNameForComparison("Health 20250103123456");
			expect(result).toBe("health");
		});

		it("should remove instance date with ZettelID format", () => {
			const result = normalizeEventNameForComparison("Health 2025-01-15-20250103123456");
			expect(result).toBe("health");
		});

		it("should handle complex event name with instance date", () => {
			const result = normalizeEventNameForComparison("Team Meeting 2025-01-15-20250103123456");
			expect(result).toBe("team meeting");
		});

		it("should convert to lowercase", () => {
			const result = normalizeEventNameForComparison("HEALTH");
			expect(result).toBe("health");
		});

		it("should trim whitespace", () => {
			const result = normalizeEventNameForComparison("  Health  ");
			expect(result).toBe("health");
		});

		it("should handle complex event names", () => {
			const result = normalizeEventNameForComparison("Team Meeting 20250103123456");
			expect(result).toBe("team meeting");
		});

		it("should not remove dates that are part of the event name", () => {
			const result = normalizeEventNameForComparison("Report 2025-01-15");
			expect(result).toBe("report 2025-01-15");
		});
	});

	describe("autoAssignCategories", () => {
		const mockSettings: Partial<SingleCalendarConfig> = {
			autoAssignCategoryByName: false,
			autoAssignCategoryByIncludes: false,
			categoryAssignmentPresets: [],
		};

		const availableCategories = ["Health", "Business", "Personal"];

		describe("with autoAssignCategoryByName enabled", () => {
			it("should auto-assign category when event name matches category name (case-insensitive)", () => {
				const settings = {
					...mockSettings,
					autoAssignCategoryByName: true,
				} as SingleCalendarConfig;

				const result = autoAssignCategories("health", settings, availableCategories);

				expect(result).toEqual(["Health"]);
			});

			it("should handle event name with ZettelID", () => {
				const settings = {
					...mockSettings,
					autoAssignCategoryByName: true,
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Health-20250103123456", settings, availableCategories);

				expect(result).toEqual(["Health"]);
			});

			it("should not duplicate categories", () => {
				const settings = {
					...mockSettings,
					autoAssignCategoryByName: true,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "health",
							categories: ["Health"],
						},
					],
				} as SingleCalendarConfig;

				const result = autoAssignCategories("health", settings, availableCategories);

				// Health should only appear once
				expect(result).toEqual(["Health"]);
			});

			it("should not auto-assign if event name does not match any category", () => {
				const settings = {
					...mockSettings,
					autoAssignCategoryByName: true,
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Random Event", settings, availableCategories);

				expect(result).toEqual([]);
			});
		});

		describe("with autoAssignCategoryByIncludes enabled", () => {
			it("should auto-assign category when event name contains category name", () => {
				const settings = {
					...mockSettings,
					autoAssignCategoryByIncludes: true,
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Youtube Analysis", settings, availableCategories);

				expect(result).toEqual([]);
			});

			it("should match when event name contains category as substring", () => {
				const categories = ["Youtube", "Health", "Business"];
				const settings = {
					...mockSettings,
					autoAssignCategoryByIncludes: true,
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Youtube Analysis", settings, categories);

				expect(result).toEqual(["Youtube"]);
			});

			it("should match multiple categories when event name contains several", () => {
				const categories = ["Health", "Personal"];
				const settings = {
					...mockSettings,
					autoAssignCategoryByIncludes: true,
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Personal Health Checkup", settings, categories);

				expect(result).toContain("Health");
				expect(result).toContain("Personal");
			});

			it("should be case-insensitive", () => {
				const categories = ["Youtube"];
				const settings = {
					...mockSettings,
					autoAssignCategoryByIncludes: true,
				} as SingleCalendarConfig;

				const result = autoAssignCategories("youtube analysis", settings, categories);

				expect(result).toEqual(["Youtube"]);
			});

			it("should handle event name with ZettelID", () => {
				const categories = ["Youtube"];
				const settings = {
					...mockSettings,
					autoAssignCategoryByIncludes: true,
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Youtube Analysis-20250103123456", settings, categories);

				expect(result).toEqual(["Youtube"]);
			});

			it("should not match when event name does not contain any category", () => {
				const settings = {
					...mockSettings,
					autoAssignCategoryByIncludes: true,
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Random Event", settings, availableCategories);

				expect(result).toEqual([]);
			});

			it("should work together with exact name matching without duplicates", () => {
				const settings = {
					...mockSettings,
					autoAssignCategoryByName: true,
					autoAssignCategoryByIncludes: true,
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Health", settings, availableCategories);

				expect(result).toEqual(["Health"]);
			});
		});

		describe("with category assignment presets", () => {
			it("should auto-assign categories based on preset", () => {
				const settings = {
					...mockSettings,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "Productivity",
							categories: ["Health", "Business"],
						},
					],
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Productivity", settings, availableCategories, true);

				expect(result).toContain("Health");
				expect(result).toContain("Business");
			});

			it("should match presets case-insensitively", () => {
				const settings = {
					...mockSettings,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "productivity",
							categories: ["Health", "Business"],
						},
					],
				} as SingleCalendarConfig;

				const result = autoAssignCategories("PRODUCTIVITY", settings, availableCategories, true);

				expect(result).toContain("Health");
				expect(result).toContain("Business");
			});

			it("should handle event name with ZettelID in presets", () => {
				const settings = {
					...mockSettings,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "Productivity",
							categories: ["Health"],
						},
					],
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Productivity-20250103123456", settings, availableCategories, true);

				expect(result).toContain("Health");
			});

			it("should not duplicate categories from presets", () => {
				const settings = {
					...mockSettings,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "Productivity",
							categories: ["Health", "Business", "Health"],
						},
					],
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Productivity", settings, availableCategories, true);

				expect(result).toEqual(["Health", "Business"]);
			});

			it("should handle multiple presets for the same event name", () => {
				const settings = {
					...mockSettings,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "Productivity",
							categories: ["Health"],
						},
						{
							id: "2",
							eventName: "Productivity",
							categories: ["Business"],
						},
					],
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Productivity", settings, availableCategories, true);

				expect(result).toContain("Health");
				expect(result).toContain("Business");
			});
		});

		describe("with both features enabled", () => {
			it("preset match takes precedence and suppresses name matching", () => {
				const settings = {
					...mockSettings,
					autoAssignCategoryByName: true,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "Health",
							categories: ["Business"],
						},
					],
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Health", settings, availableCategories, true);

				expect(result).toEqual(["Business"]);
			});

			it("falls back to name matching when no preset matches", () => {
				const settings = {
					...mockSettings,
					autoAssignCategoryByName: true,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "Productivity",
							categories: ["Business"],
						},
					],
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Health", settings, availableCategories, true);

				expect(result).toEqual(["Health"]);
			});

			it("preset match takes precedence and suppresses substring matching", () => {
				const categories = ["Health", "Business"];
				const settings = {
					...mockSettings,
					autoAssignCategoryByIncludes: true,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "Health Checkup",
							categories: ["Personal"],
						},
					],
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Health Checkup", settings, categories, true);

				expect(result).toEqual(["Personal"]);
			});
		});

		describe("with features disabled", () => {
			it("should return empty array when all features disabled", () => {
				const settings = {
					...mockSettings,
					autoAssignCategoryByName: false,
					categoryAssignmentPresets: [],
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Health", settings, availableCategories);

				expect(result).toEqual([]);
			});

			it("should return empty array when no categories and features disabled", () => {
				const settings = {
					...mockSettings,
					autoAssignCategoryByName: false,
					categoryAssignmentPresets: [],
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Health", settings, availableCategories);

				expect(result).toEqual([]);
			});
		});

		describe("Pro feature gating for presets", () => {
			it("should NOT apply presets when isProEnabled is false", () => {
				const settings = {
					...mockSettings,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "Coding",
							categories: ["Business"],
						},
					],
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Coding", settings, availableCategories, false);

				expect(result).toEqual([]);
			});

			it("should apply presets when isProEnabled is true", () => {
				const settings = {
					...mockSettings,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "Coding",
							categories: ["Business"],
						},
					],
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Coding", settings, availableCategories, true);

				expect(result).toEqual(["Business"]);
			});

			it("should still apply name matching even without Pro", () => {
				const settings = {
					...mockSettings,
					autoAssignCategoryByName: true,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "Health",
							categories: ["Business"],
						},
					],
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Health", settings, availableCategories, false);

				expect(result).toEqual(["Health"]);
			});

			it("should default isProEnabled to false when not provided", () => {
				const settings = {
					...mockSettings,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "Coding",
							categories: ["Business"],
						},
					],
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Coding", settings, availableCategories);

				expect(result).toEqual([]);
			});
		});

		describe("comma-separated preset event names", () => {
			it("should match any name in comma-separated list", () => {
				const settings = {
					...mockSettings,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "Coding, Work, Dev",
							categories: ["Business"],
						},
					],
				} as SingleCalendarConfig;

				expect(autoAssignCategories("Coding", settings, availableCategories, true)).toEqual(["Business"]);
				expect(autoAssignCategories("Work", settings, availableCategories, true)).toEqual(["Business"]);
				expect(autoAssignCategories("Dev", settings, availableCategories, true)).toEqual(["Business"]);
			});

			it("should not match partial names from comma-separated list", () => {
				const settings = {
					...mockSettings,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "Coding, Work",
							categories: ["Business"],
						},
					],
				} as SingleCalendarConfig;

				expect(autoAssignCategories("Cod", settings, availableCategories, true)).toEqual([]);
				expect(autoAssignCategories("Working", settings, availableCategories, true)).toEqual([]);
			});

			it("should handle extra whitespace in comma-separated names", () => {
				const settings = {
					...mockSettings,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "  Coding ,  Work  ,Dev  ",
							categories: ["Business"],
						},
					],
				} as SingleCalendarConfig;

				expect(autoAssignCategories("Coding", settings, availableCategories, true)).toEqual(["Business"]);
				expect(autoAssignCategories("Work", settings, availableCategories, true)).toEqual(["Business"]);
				expect(autoAssignCategories("Dev", settings, availableCategories, true)).toEqual(["Business"]);
			});

			it("should skip empty entries in comma-separated names", () => {
				const settings = {
					...mockSettings,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "Coding,,  ,Work",
							categories: ["Business"],
						},
					],
				} as SingleCalendarConfig;

				expect(autoAssignCategories("Coding", settings, availableCategories, true)).toEqual(["Business"]);
				expect(autoAssignCategories("Work", settings, availableCategories, true)).toEqual(["Business"]);
				expect(autoAssignCategories("", settings, availableCategories, true)).toEqual([]);
			});

			it("should match comma-separated names with ZettelID suffix", () => {
				const settings = {
					...mockSettings,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "Gym, Exercise",
							categories: ["Health"],
						},
					],
				} as SingleCalendarConfig;

				expect(autoAssignCategories("Gym-20250103123456", settings, availableCategories, true)).toEqual(["Health"]);
				expect(autoAssignCategories("Exercise 2025-01-15-20250103123456", settings, availableCategories, true)).toEqual(
					["Health"]
				);
			});
		});

		describe("edge cases", () => {
			it("should return empty array for empty event name", () => {
				const settings = {
					...mockSettings,
					autoAssignCategoryByName: true,
				} as SingleCalendarConfig;

				expect(autoAssignCategories("", settings, availableCategories)).toEqual([]);
			});

			it("should return empty array for whitespace-only event name", () => {
				const settings = {
					...mockSettings,
					autoAssignCategoryByName: true,
				} as SingleCalendarConfig;

				expect(autoAssignCategories("   ", settings, availableCategories)).toEqual([]);
			});

			it("should return empty array when no categories available", () => {
				const settings = {
					...mockSettings,
					autoAssignCategoryByName: true,
				} as SingleCalendarConfig;

				expect(autoAssignCategories("Health", settings, [])).toEqual([]);
			});

			it("should handle empty categoryAssignmentPresets", () => {
				const settings = {
					...mockSettings,
					autoAssignCategoryByName: false,
					categoryAssignmentPresets: [],
				} as SingleCalendarConfig;

				expect(autoAssignCategories("Health", settings, availableCategories, true)).toEqual([]);
			});

			it("should handle empty categoryAssignmentPresets array", () => {
				const settings = {
					...mockSettings,
					autoAssignCategoryByName: false,
					categoryAssignmentPresets: [],
				} as SingleCalendarConfig;

				expect(autoAssignCategories("Coding", settings, availableCategories, true)).toEqual([]);
			});
		});
	});

	describe("normalizeEventNameForComparison edge cases", () => {
		it("should handle empty string", () => {
			expect(normalizeEventNameForComparison("")).toBe("");
		});

		it("should not strip standalone 14-digit number (not preceded by separator)", () => {
			expect(normalizeEventNameForComparison("20250103123456")).toBe("20250103123456");
		});

		it("should preserve numbers that are not ZettelIDs", () => {
			expect(normalizeEventNameForComparison("Meeting 12345")).toBe("meeting 12345");
		});

		it("should preserve short numeric suffixes (not 14-digit ZettelID)", () => {
			expect(normalizeEventNameForComparison("Task-123")).toBe("task-123");
		});

		it("should handle multiple spaces before ZettelID", () => {
			expect(normalizeEventNameForComparison("Event  20250103123456")).toBe("event");
		});

		it("should handle event names with hyphens", () => {
			expect(normalizeEventNameForComparison("work-session-20250103123456")).toBe("work-session");
		});

		it("should handle instance date without ZettelID", () => {
			expect(normalizeEventNameForComparison("Event 2025-01-15")).toBe("event 2025-01-15");
		});
	});
});
