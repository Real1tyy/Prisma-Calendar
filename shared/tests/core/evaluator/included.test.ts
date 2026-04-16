import { BehaviorSubject } from "rxjs";

import { describe, expect, it } from "vitest";

import type { PathIncludedProperties } from "../../../src/core/evaluator/included";
import { IncludedPropertiesEvaluator } from "../../../src/core/evaluator/included";

interface TestSettings {
	defaultBasesIncludedProperties: string[];
	pathBasesIncludedProperties: PathIncludedProperties[];
}

function makeSettings(
	defaultIncluded: string[],
	pathRules: Array<{ id: string; path: string; includedProperties: string[]; enabled: boolean }>
): TestSettings {
	return {
		defaultBasesIncludedProperties: defaultIncluded,
		pathBasesIncludedProperties: pathRules,
	};
}

describe("IncludedPropertiesEvaluator", () => {
	describe("default included properties", () => {
		it("should return file.name and defaults when no rules defined", () => {
			const settings = makeSettings(["Status", "Priority"], []);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new IncludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateIncludedProperties("any/path/file.md");

			expect(result).toEqual(["file.name", "Status", "Priority"]);
		});

		it("should return file.name and defaults when no rules match", () => {
			const settings = makeSettings(
				["Status", "Priority"],
				[
					{
						id: "rule1",
						path: "Projects/",
						includedProperties: ["deadline"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new IncludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateIncludedProperties("Notes/file.md");

			expect(result).toEqual(["file.name", "Status", "Priority"]);
		});

		it("should always include file.name first", () => {
			const settings = makeSettings(["Status"], []);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new IncludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateIncludedProperties("any/path.md");

			expect(result[0]).toBe("file.name");
		});
	});

	describe("path matching", () => {
		it("should add path-specific properties when rule matches", () => {
			const settings = makeSettings(
				["Status"],
				[
					{
						id: "rule1",
						path: "Projects/",
						includedProperties: ["deadline", "progress"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new IncludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateIncludedProperties("Projects/My Project.md");

			expect(result).toEqual(["file.name", "Status", "deadline", "progress"]);
		});

		it("should match nested paths", () => {
			const settings = makeSettings(
				["Status"],
				[
					{
						id: "rule1",
						path: "Projects/Work/",
						includedProperties: ["deadline"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new IncludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateIncludedProperties("Projects/Work/Important.md");

			expect(result).toEqual(["file.name", "Status", "deadline"]);
		});

		it("should not match partial directory names", () => {
			const settings = makeSettings(
				["Status"],
				[
					{
						id: "rule1",
						path: "Project/",
						includedProperties: ["deadline"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new IncludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateIncludedProperties("Projects/file.md");

			expect(result).toEqual(["file.name", "Status"]);
		});
	});

	describe("rule priority", () => {
		it("should use first matching rule only", () => {
			const settings = makeSettings(
				["Status"],
				[
					{
						id: "rule1",
						path: "Projects/",
						includedProperties: ["deadline"],
						enabled: true,
					},
					{
						id: "rule2",
						path: "Projects/Work/",
						includedProperties: ["progress"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new IncludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateIncludedProperties("Projects/Work/file.md");

			expect(result).toEqual(["file.name", "Status", "deadline"]);
			expect(result).not.toContain("progress");
		});
	});

	describe("enabled/disabled rules", () => {
		it("should ignore disabled rules", () => {
			const settings = makeSettings(
				["Status"],
				[
					{
						id: "rule1",
						path: "Projects/",
						includedProperties: ["deadline"],
						enabled: false,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new IncludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateIncludedProperties("Projects/file.md");

			expect(result).toEqual(["file.name", "Status"]);
		});
	});

	describe("duplicate handling", () => {
		it("should not add duplicate properties", () => {
			const settings = makeSettings(
				["Status"],
				[
					{
						id: "rule1",
						path: "Projects/",
						includedProperties: ["Status", "deadline"], // Status already in defaults
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new IncludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateIncludedProperties("Projects/file.md");

			expect(result).toEqual(["file.name", "Status", "deadline"]);
			expect(result.filter((p) => p === "Status").length).toBe(1);
		});
	});

	describe("reactive updates", () => {
		it("should update when settings change", () => {
			const initialSettings = makeSettings(["Status"], []);
			const settings$ = new BehaviorSubject(initialSettings);
			const evaluator = new IncludedPropertiesEvaluator(settings$);

			let result = evaluator.evaluateIncludedProperties("Projects/file.md");

			expect(result).toEqual(["file.name", "Status"]);

			const newSettings = makeSettings(
				["Status", "Priority"],
				[
					{
						id: "rule1",
						path: "Projects/",
						includedProperties: ["deadline"],
						enabled: true,
					},
				]
			);

			settings$.next(newSettings);

			result = evaluator.evaluateIncludedProperties("Projects/file.md");

			expect(result).toEqual(["file.name", "Status", "Priority", "deadline"]);
		});
	});

	describe("edge cases", () => {
		it("should handle empty default included properties", () => {
			const settings = makeSettings(
				[],
				[
					{
						id: "rule1",
						path: "Projects/",
						includedProperties: ["deadline"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new IncludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateIncludedProperties("Projects/file.md");

			expect(result).toEqual(["file.name", "deadline"]);
		});

		it("should handle empty path in rule", () => {
			const settings = makeSettings(
				["Status"],
				[
					{
						id: "rule1",
						path: "",
						includedProperties: ["universal"],
						enabled: true,
					},
				]
			);
			const settings$ = new BehaviorSubject(settings);
			const evaluator = new IncludedPropertiesEvaluator(settings$);

			const result = evaluator.evaluateIncludedProperties("any/path.md");

			expect(result).toEqual(["file.name", "Status", "universal"]);
		});
	});
});
