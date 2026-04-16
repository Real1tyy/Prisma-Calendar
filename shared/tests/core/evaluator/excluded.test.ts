import { BehaviorSubject } from "rxjs";

import { describe, expect, it } from "vitest";

import type { PathExcludedProperties } from "../../../src/core/evaluator/excluded";
import { ExcludedPropertiesEvaluator } from "../../../src/core/evaluator/excluded";

interface TestSettings {
	defaultExcludedProperties: string[];
	pathExcludedProperties: PathExcludedProperties[];
}

function makeSettings(
	defaultExcluded: string[],
	pathRules: Array<{ id: string; path: string; excludedProperties: string[]; enabled: boolean }>
): TestSettings {
	return {
		defaultExcludedProperties: defaultExcluded,
		pathExcludedProperties: pathRules,
	};
}

describe("ExcludedPropertiesEvaluator", () => {
	describe("default excluded properties", () => {
		it("should return default excluded properties when no rules defined", () => {
			const settings = makeSettings(["Parent", "Child", "Related", "_ZettelID"], []);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateExcludedProperties("any/path/file.md");

			expect(result).toEqual(["Parent", "Child", "Related", "_ZettelID"]);
		});

		it("should return default excluded properties when no rules match", () => {
			const settings = makeSettings(
				["Parent", "Child"],
				[
					{
						id: "rule1",
						path: "Projects/",
						excludedProperties: ["status"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateExcludedProperties("Notes/file.md");

			expect(result).toEqual(["Parent", "Child"]);
		});

		it("should always include default excluded properties even when rule matches", () => {
			const settings = makeSettings(
				["Parent", "Child"],
				[
					{
						id: "rule1",
						path: "Projects/",
						excludedProperties: ["status"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateExcludedProperties("Projects/file.md");

			expect(result).toContain("Parent");
			expect(result).toContain("Child");
		});
	});

	describe("path matching", () => {
		it("should match file path that starts with rule path", () => {
			const settings = makeSettings(
				["Parent"],
				[
					{
						id: "rule1",
						path: "Projects/",
						excludedProperties: ["status", "progress"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateExcludedProperties("Projects/My Project.md");

			expect(result).toEqual(["Parent", "status", "progress"]);
		});

		it("should match nested paths", () => {
			const settings = makeSettings(
				["Parent"],
				[
					{
						id: "rule1",
						path: "Projects/Work/",
						excludedProperties: ["deadline"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateExcludedProperties("Projects/Work/Important.md");

			expect(result).toEqual(["Parent", "deadline"]);
		});

		it("should not match partial directory names", () => {
			const settings = makeSettings(
				["Parent"],
				[
					{
						id: "rule1",
						path: "Project/",
						excludedProperties: ["status"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			// "Projects" != "Project"
			const result = evaluator.evaluateExcludedProperties("Projects/file.md");

			expect(result).toEqual(["Parent"]);
		});

		it("should match exact path", () => {
			const settings = makeSettings(
				["Parent"],
				[
					{
						id: "rule1",
						path: "Projects/My Project.md",
						excludedProperties: ["specific"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateExcludedProperties("Projects/My Project.md");

			expect(result).toEqual(["Parent", "specific"]);
		});

		it("should match root level paths", () => {
			const settings = makeSettings(
				["Parent"],
				[
					{
						id: "rule1",
						path: "file.md",
						excludedProperties: ["root"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateExcludedProperties("file.md");

			expect(result).toEqual(["Parent", "root"]);
		});
	});

	describe("rule priority", () => {
		it("should use first matching rule only", () => {
			const settings = makeSettings(
				["Parent"],
				[
					{
						id: "rule1",
						path: "Projects/",
						excludedProperties: ["status"],
						enabled: true,
					},
					{
						id: "rule2",
						path: "Projects/Work/",
						excludedProperties: ["deadline"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			// Both rules match, but only first should apply
			const result = evaluator.evaluateExcludedProperties("Projects/Work/file.md");

			expect(result).toEqual(["Parent", "status"]);
			expect(result).not.toContain("deadline");
		});

		it("should respect rule order for overlapping paths", () => {
			const settings = makeSettings(
				["Parent"],
				[
					{
						id: "rule1",
						path: "Projects/Work/",
						excludedProperties: ["specific"],
						enabled: true,
					},
					{
						id: "rule2",
						path: "Projects/",
						excludedProperties: ["general"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			// More specific rule comes first
			const result = evaluator.evaluateExcludedProperties("Projects/Work/file.md");

			expect(result).toEqual(["Parent", "specific"]);
		});
	});

	describe("enabled/disabled rules", () => {
		it("should ignore disabled rules", () => {
			const settings = makeSettings(
				["Parent"],
				[
					{
						id: "rule1",
						path: "Projects/",
						excludedProperties: ["status"],
						enabled: false,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateExcludedProperties("Projects/file.md");

			expect(result).toEqual(["Parent"]);
		});

		it("should skip disabled rules and use next matching enabled rule", () => {
			const settings = makeSettings(
				["Parent"],
				[
					{
						id: "rule1",
						path: "Projects/",
						excludedProperties: ["first"],
						enabled: false,
					},
					{
						id: "rule2",
						path: "Projects/",
						excludedProperties: ["second"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateExcludedProperties("Projects/file.md");

			expect(result).toEqual(["Parent", "second"]);
		});
	});

	describe("duplicate handling", () => {
		it("should not add duplicate properties", () => {
			const settings = makeSettings(
				["Parent", "Child"],
				[
					{
						id: "rule1",
						path: "Projects/",
						excludedProperties: ["Parent", "status"], // Parent already in defaults
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateExcludedProperties("Projects/file.md");

			expect(result).toEqual(["Parent", "Child", "status"]);
			expect(result.filter((p) => p === "Parent").length).toBe(1);
		});

		it("should handle empty excluded properties array in rule", () => {
			const settings = makeSettings(
				["Parent"],
				[
					{
						id: "rule1",
						path: "Projects/",
						excludedProperties: [],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateExcludedProperties("Projects/file.md");

			expect(result).toEqual(["Parent"]);
		});
	});

	describe("reactive updates", () => {
		it("should update when settings change", () => {
			const initialSettings = makeSettings(["Parent"], []);
			const settings$ = new BehaviorSubject(initialSettings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			let result = evaluator.evaluateExcludedProperties("Projects/file.md");

			expect(result).toEqual(["Parent"]);

			// Update settings
			const newSettings = makeSettings(
				["Parent", "Child"],
				[
					{
						id: "rule1",
						path: "Projects/",
						excludedProperties: ["status"],
						enabled: true,
					},
				]
			);

			settings$.next(newSettings);

			result = evaluator.evaluateExcludedProperties("Projects/file.md");

			expect(result).toEqual(["Parent", "Child", "status"]);
		});

		it("should update when rules are added", () => {
			const initialSettings = makeSettings(["Parent"], []);
			const settings$ = new BehaviorSubject(initialSettings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			let result = evaluator.evaluateExcludedProperties("Projects/file.md");

			expect(result).toEqual(["Parent"]);

			// Add rule
			const updatedSettings = makeSettings(
				["Parent"],
				[
					{
						id: "rule1",
						path: "Projects/",
						excludedProperties: ["status"],
						enabled: true,
					},
				]
			);

			settings$.next(updatedSettings);

			result = evaluator.evaluateExcludedProperties("Projects/file.md");

			expect(result).toEqual(["Parent", "status"]);
		});

		it("should update when rule is disabled", () => {
			const initialSettings = makeSettings(
				["Parent"],
				[
					{
						id: "rule1",
						path: "Projects/",
						excludedProperties: ["status"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(initialSettings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			let result = evaluator.evaluateExcludedProperties("Projects/file.md");

			expect(result).toEqual(["Parent", "status"]);

			// Disable rule
			const updatedSettings = makeSettings(
				["Parent"],
				[
					{
						id: "rule1",
						path: "Projects/",
						excludedProperties: ["status"],
						enabled: false,
					},
				]
			);

			settings$.next(updatedSettings);

			result = evaluator.evaluateExcludedProperties("Projects/file.md");

			expect(result).toEqual(["Parent"]);
		});
	});

	describe("edge cases", () => {
		it("should handle empty default excluded properties", () => {
			const settings = makeSettings(
				[],
				[
					{
						id: "rule1",
						path: "Projects/",
						excludedProperties: ["status"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateExcludedProperties("Projects/file.md");

			expect(result).toEqual(["status"]);
		});

		it("should handle empty path in rule", () => {
			const settings = makeSettings(
				["Parent"],
				[
					{
						id: "rule1",
						path: "",
						excludedProperties: ["universal"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			// Empty string matches all paths (startsWith(""))
			const result = evaluator.evaluateExcludedProperties("any/path.md");

			expect(result).toEqual(["Parent", "universal"]);
		});

		it("should handle special characters in paths", () => {
			const settings = makeSettings(
				["Parent"],
				[
					{
						id: "rule1",
						path: "Projects (Work)/",
						excludedProperties: ["status"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateExcludedProperties("Projects (Work)/file.md");

			expect(result).toEqual(["Parent", "status"]);
		});

		it("should handle paths with trailing slashes", () => {
			const settings = makeSettings(
				["Parent"],
				[
					{
						id: "rule1",
						path: "Projects/",
						excludedProperties: ["status"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateExcludedProperties("Projects/file.md");

			expect(result).toEqual(["Parent", "status"]);
		});

		it("should handle paths without trailing slashes", () => {
			const settings = makeSettings(
				["Parent"],
				[
					{
						id: "rule1",
						path: "Projects",
						excludedProperties: ["status"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new ExcludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateExcludedProperties("Projects/file.md");

			expect(result).toEqual(["Parent", "status"]);
		});
	});
});
