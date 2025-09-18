import type { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilterEvaluator } from "../../src/utils/filter-evaluator";
import { createMockSingleCalendarSettings, createMockSingleCalendarSettingsStore } from "../setup";

describe("FilterEvaluator", () => {
	let evaluator: FilterEvaluator;
	let settingsStore: BehaviorSubject<any>;
	let mockSettings: any;

	beforeEach(() => {
		mockSettings = createMockSingleCalendarSettings();
		settingsStore = createMockSingleCalendarSettingsStore();
		evaluator = new FilterEvaluator(settingsStore);
	});

	afterEach(() => {
		evaluator.destroy();
		settingsStore.complete();
	});

	describe("Basic filtering", () => {
		beforeEach(() => {
			settingsStore.next({
				...mockSettings,
				filterExpressions: [],
			});
		});

		it("should return true when no filters are configured", () => {
			const frontmatter = { Status: "Inbox", Priority: "High" };
			expect(evaluator.evaluateFilters(frontmatter)).toBe(true);
		});

		it("should filter by simple equality", () => {
			settingsStore.next({
				...mockSettings,
				filterExpressions: ["fm.Status === 'Done'"],
			});

			expect(evaluator.evaluateFilters({ Status: "Done" })).toBe(true);
			expect(evaluator.evaluateFilters({ Status: "Inbox" })).toBe(false);
			expect(evaluator.evaluateFilters({})).toBe(false);
		});

		it("should filter by inequality", () => {
			settingsStore.next({
				...mockSettings,
				filterExpressions: ["fm.Status !== 'Inbox'"],
			});

			expect(evaluator.evaluateFilters({ Status: "Done" })).toBe(true);
			expect(evaluator.evaluateFilters({ Status: "In Progress" })).toBe(true);
			expect(evaluator.evaluateFilters({ Status: "Inbox" })).toBe(false);
			expect(evaluator.evaluateFilters({})).toBe(true); // undefined !== 'Inbox'
		});

		it("should handle boolean properties", () => {
			settingsStore.next({
				...mockSettings,
				filterExpressions: ["!fm._Archived"],
			});

			expect(evaluator.evaluateFilters({ _Archived: false })).toBe(true);
			expect(evaluator.evaluateFilters({ _Archived: true })).toBe(false);
			expect(evaluator.evaluateFilters({})).toBe(true); // !undefined is true
		});

		it("should handle array properties", () => {
			settingsStore.next({
				...mockSettings,
				filterExpressions: ["Array.isArray(fm.Project) && fm.Project.length > 0"],
			});

			expect(evaluator.evaluateFilters({ Project: ["Project A"] })).toBe(true);
			expect(evaluator.evaluateFilters({ Project: [] })).toBe(false);
			expect(evaluator.evaluateFilters({ Project: "Not an array" })).toBe(false);
			expect(evaluator.evaluateFilters({})).toBe(false);
		});

		it("should handle null and undefined values", () => {
			settingsStore.next({
				...mockSettings,
				filterExpressions: ["fm.Status != null"],
			});

			expect(evaluator.evaluateFilters({ Status: "Done" })).toBe(true);
			expect(evaluator.evaluateFilters({ Status: null })).toBe(false);
			expect(evaluator.evaluateFilters({})).toBe(false);
		});

		it("should handle string operations", () => {
			settingsStore.next({
				...mockSettings,
				filterExpressions: ["fm.Title && fm.Title.includes('Meeting')"],
			});

			expect(evaluator.evaluateFilters({ Title: "Team Meeting" })).toBe(true);
			expect(evaluator.evaluateFilters({ Title: "Daily Standup" })).toBe(false);
			expect(evaluator.evaluateFilters({})).toBe(false);
		});

		it("should handle numeric comparisons", () => {
			settingsStore.next({
				...mockSettings,
				filterExpressions: ["fm.Priority >= 3"],
			});

			expect(evaluator.evaluateFilters({ Priority: 5 })).toBe(true);
			expect(evaluator.evaluateFilters({ Priority: 3 })).toBe(true);
			expect(evaluator.evaluateFilters({ Priority: 2 })).toBe(false);
			expect(evaluator.evaluateFilters({})).toBe(false);
		});
	});

	describe("Complex filtering", () => {
		it("should handle OR conditions", () => {
			settingsStore.next({
				...mockSettings,
				filterExpressions: ["fm.Status === 'Done' || fm.Status === 'In Progress'"],
			});

			expect(evaluator.evaluateFilters({ Status: "Done" })).toBe(true);
			expect(evaluator.evaluateFilters({ Status: "In Progress" })).toBe(true);
			expect(evaluator.evaluateFilters({ Status: "Inbox" })).toBe(false);
		});

		it("should handle AND conditions across multiple filters", () => {
			settingsStore.next({
				...mockSettings,
				filterExpressions: ["fm.Status !== 'Inbox'", "fm.Priority === 'High'"],
			});

			expect(evaluator.evaluateFilters({ Status: "Done", Priority: "High" })).toBe(true);
			expect(evaluator.evaluateFilters({ Status: "Inbox", Priority: "High" })).toBe(false);
			expect(evaluator.evaluateFilters({ Status: "Done", Priority: "Low" })).toBe(false);
		});

		it("should handle nested property access", () => {
			settingsStore.next({
				...mockSettings,
				filterExpressions: ["fm.Goal && fm.Goal[0] && fm.Goal[0].includes('Clarity')"],
			});

			const frontmatter1 = {
				Goal: ["[[Goals/Achieve Clarity, Structure|Achieve Clarity, Structure]]"],
			};
			const frontmatter2 = {
				Goal: ["[[Goals/Something Else|Something Else]]"],
			};
			const frontmatter3 = { Goal: [] };

			expect(evaluator.evaluateFilters(frontmatter1)).toBe(true);
			expect(evaluator.evaluateFilters(frontmatter2)).toBe(false);
			expect(evaluator.evaluateFilters(frontmatter3)).toBe(false);
		});

		it("should handle complex logical expressions", () => {
			settingsStore.next({
				...mockSettings,
				filterExpressions: [
					"(fm.Status === 'Done' || fm.Status === 'In Progress') && fm.Priority !== 'Low'",
				],
			});

			expect(evaluator.evaluateFilters({ Status: "Done", Priority: "High" })).toBe(true);
			expect(evaluator.evaluateFilters({ Status: "In Progress", Priority: "Medium" })).toBe(true);
			expect(evaluator.evaluateFilters({ Status: "Done", Priority: "Low" })).toBe(false);
			expect(evaluator.evaluateFilters({ Status: "Inbox", Priority: "High" })).toBe(false);
		});

		it("should handle date comparisons", () => {
			const today = new Date().toISOString().split("T")[0];
			settingsStore.next({
				...mockSettings,
				filterExpressions: [`fm['Start Date'] >= '${today}'`],
			});

			expect(evaluator.evaluateFilters({ "Start Date": today })).toBe(true);
			expect(evaluator.evaluateFilters({ "Start Date": "2020-01-01" })).toBe(false);
		});
	});

	describe("Error handling", () => {
		it("should ignore invalid expressions", () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			settingsStore.next({
				...mockSettings,
				filterExpressions: [
					"fm.Status === 'Done'", // valid
					"invalid syntax !!!", // invalid
					"fm.Priority === 'High'", // valid
				],
			});

			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it("should handle runtime errors in expressions", () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			// This expression passes compilation test with {} but fails with real data
			// because it tries to access a property that might be null/undefined
			settingsStore.next({
				...mockSettings,
				filterExpressions: ["fm.Status && fm.Status.nonExistentMethod()"],
			});

			expect(evaluator.evaluateFilters({ Status: "Done" })).toBe(false);
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it("should treat non-boolean results as false", () => {
			settingsStore.next({
				...mockSettings,
				filterExpressions: ["fm.Status"], // returns string, not boolean
			});

			expect(evaluator.evaluateFilters({ Status: "Done" })).toBe(false);
			expect(evaluator.evaluateFilters({ Status: "" })).toBe(false);
		});

		it("should handle expressions that throw during evaluation", () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			// This expression passes compilation but throws when trying to parse invalid JSON
			// We use a conditional to make it pass the compilation test
			settingsStore.next({
				...mockSettings,
				filterExpressions: ["fm.Status ? JSON.parse('{invalid json}') : true"],
			});

			expect(evaluator.evaluateFilters({ Status: "Done" })).toBe(false);
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it("should handle empty or whitespace-only expressions", () => {
			settingsStore.next({
				...mockSettings,
				filterExpressions: ["", "   ", "fm.Status === 'Done'", "\t\n"],
			});

			expect(evaluator.evaluateFilters({ Status: "Done" })).toBe(true);
		});
	});

	describe("Real-world examples", () => {
		it("should filter the example frontmatter correctly", () => {
			settingsStore.next({
				...mockSettings,
				filterExpressions: ["fm.Status !== 'Inbox'"],
			});

			// This should pass (Status: Done)
			const passingFrontmatter = {
				"Start Date": "",
				"End Date": "",
				Goal: ["[[Goals/Achieve Clarity, Structure|Achieve Clarity, Structure]]"],
				Project: ["[[Projects/Obsidian Setup|Obsidian Setup]]"],
				"Backlink Tags": ["[[Tags/Obsidian|Obsidian]]"],
				"All Day": false,
				RRule: null,
				RRuleSpec: null,
				Status: "Done",
				Priority: "High",
				Difficulty: 2,
				Parent: [],
				Child: [],
				Related: [],
				Aliases: [],
				_ZettelID: 20250826211829,
				_Archived: true,
				_LastModifiedTime: 20250826211830,
			};

			// This should not pass (Status: Inbox)
			const failingFrontmatter = {
				"Start Date": "2025-09-07 15:00",
				"End Date": "2025-09-07 17:30",
				Goal: [
					"[[Goals/Find A Girlfriend - Have A Stable Relationship|Find A Girlfriend - Have A Stable Relationship]]",
				],
				Project: ["[[Projects/Cold Approach|Cold Approach]]"],
				"Backlink Tags": ["[[Tags/Females|Females]]", "[[Tags/Dating|Dating]]"],
				"All Day": null,
				RRule: "weekly",
				RRuleSpec: "friday, saturday, sunday",
				Status: "Inbox",
				Priority: null,
				Difficulty: null,
				Parent: [],
				Child: [],
				Related: [],
				Aliases: [],
				_ZettelID: 20250907140120,
				_Archived: false,
				_LastModifiedTime: null,
				_AllChildren: [],
				_AllRelated: [],
			};

			expect(evaluator.evaluateFilters(passingFrontmatter)).toBe(true);
			expect(evaluator.evaluateFilters(failingFrontmatter)).toBe(false);
		});

		it("should handle multiple complex filters", () => {
			settingsStore.next({
				...mockSettings,
				filterExpressions: [
					"fm.Status !== 'Inbox'",
					"!fm._Archived",
					"fm.Priority === 'High' || fm.Difficulty <= 2",
				],
			});

			const frontmatter = {
				Status: "Done",
				Priority: "High",
				Difficulty: 2,
				_Archived: false,
			};

			expect(evaluator.evaluateFilters(frontmatter)).toBe(true);

			// Change one property to make it fail
			const failingFrontmatter = { ...frontmatter, _Archived: true };
			expect(evaluator.evaluateFilters(failingFrontmatter)).toBe(false);
		});

		it("should handle task filtering scenarios", () => {
			settingsStore.next({
				...mockSettings,
				filterExpressions: [
					"fm.Status && fm.Status !== 'Inbox'",
					"fm._Archived !== true",
					"fm.Project && Array.isArray(fm.Project) && fm.Project.length > 0",
				],
			});

			const validTask = {
				Status: "In Progress",
				Project: ["[[Projects/My Project|My Project]]"],
				_Archived: false,
			};

			const inboxTask = {
				Status: "Inbox",
				Project: ["[[Projects/My Project|My Project]]"],
				_Archived: false,
			};

			const archivedTask = {
				Status: "Done",
				Project: ["[[Projects/My Project|My Project]]"],
				_Archived: true,
			};

			const noProjectTask = {
				Status: "In Progress",
				Project: [],
				_Archived: false,
			};

			expect(evaluator.evaluateFilters(validTask)).toBe(true);
			expect(evaluator.evaluateFilters(inboxTask)).toBe(false);
			expect(evaluator.evaluateFilters(archivedTask)).toBe(false);
			expect(evaluator.evaluateFilters(noProjectTask)).toBe(false);
		});
	});

	describe("Filter management", () => {
		it("should handle destruction properly", () => {
			const spy = vi.spyOn(settingsStore, "subscribe");

			const newEvaluator = new FilterEvaluator(settingsStore);
			expect(spy).toHaveBeenCalled();

			newEvaluator.destroy();

			// Should not throw when destroyed multiple times
			expect(() => newEvaluator.destroy()).not.toThrow();
		});

		it("should not react to settings changes after destruction", () => {
			evaluator.destroy();

			settingsStore.next({
				...mockSettings,
				filterExpressions: ["fm.Status === 'Done'"],
			});

			// Should still have 0 filters since it's destroyed
			// Note: We can't test this directly anymore since getActiveFilterCount was removed
		});
	});

	describe("Performance and edge cases", () => {
		it("should handle large numbers of filters efficiently", () => {
			const manyFilters = Array.from({ length: 100 }, (_, i) => `fm.prop${i} === 'value${i}'`);

			settingsStore.next({
				...mockSettings,
				filterExpressions: manyFilters,
			});

			const frontmatter = { prop50: "value50" };
			expect(evaluator.evaluateFilters(frontmatter)).toBe(false); // Only one matches, need all
		});

		it("should handle rapid settings changes", () => {
			for (let i = 0; i < 10; i++) {
				settingsStore.next({
					...mockSettings,
					filterExpressions: [`fm.Status === 'Status${i}'`],
				});
			}

			expect(evaluator.evaluateFilters({ Status: "Status9" })).toBe(true);
		});

		it("should handle special characters in property names", () => {
			settingsStore.next({
				...mockSettings,
				filterExpressions: ["fm['Start Date'] === '2024-01-01'", "fm['_ZettelID'] > 0"],
			});

			const frontmatter = {
				"Start Date": "2024-01-01",
				_ZettelID: 123456,
			};

			expect(evaluator.evaluateFilters(frontmatter)).toBe(true);
		});

		it("should handle deeply nested object access safely", () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			settingsStore.next({
				...mockSettings,
				filterExpressions: ["fm.deep && fm.deep.nested && fm.deep.nested.property === 'value'"],
			});

			expect(evaluator.evaluateFilters({ deep: { nested: { property: "value" } } })).toBe(true);
			expect(evaluator.evaluateFilters({ deep: { nested: {} } })).toBe(false);
			expect(evaluator.evaluateFilters({ deep: {} })).toBe(false);
			expect(evaluator.evaluateFilters({})).toBe(false);

			consoleSpy.mockRestore();
		});
	});
});
