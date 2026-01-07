import { describe, expect, it } from "vitest";
import type { SingleCalendarConfig } from "../../src/types/settings";
import { autoAssignCategories, normalizeEventNameForComparison } from "../../src/utils/calendar-events";

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

				const result = autoAssignCategories("Productivity", settings, availableCategories);

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

				const result = autoAssignCategories("PRODUCTIVITY", settings, availableCategories);

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

				const result = autoAssignCategories("Productivity-20250103123456", settings, availableCategories);

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

				const result = autoAssignCategories("Productivity", settings, availableCategories);

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

				const result = autoAssignCategories("Productivity", settings, availableCategories);

				expect(result).toContain("Health");
				expect(result).toContain("Business");
			});
		});

		describe("with both features enabled", () => {
			it("should apply both name matching and presets", () => {
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

				const result = autoAssignCategories("Health", settings, availableCategories);

				// Should match both the category name AND the preset
				expect(result).toContain("Health"); // From name matching
				expect(result).toContain("Business"); // From preset
			});

			it("should deduplicate across both features", () => {
				const settings = {
					...mockSettings,
					autoAssignCategoryByName: true,
					categoryAssignmentPresets: [
						{
							id: "1",
							eventName: "Health",
							categories: ["Health", "Business"],
						},
					],
				} as SingleCalendarConfig;

				const result = autoAssignCategories("Health", settings, availableCategories);

				// Health should only appear once
				expect(result.filter((c) => c === "Health")).toHaveLength(1);
				expect(result).toContain("Business");
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
	});
});
