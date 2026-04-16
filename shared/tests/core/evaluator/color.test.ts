import { BehaviorSubject } from "rxjs";

import { describe, expect, it } from "vitest";

import type { ColorRule } from "../../../src/core/evaluator/color";
import { ColorEvaluator } from "../../../src/core/evaluator/color";

interface TestSettings {
	defaultNodeColor: string;
	colorRules: ColorRule[];
}

function makeSettings(defaultColor: string, rules: ColorRule[]): TestSettings {
	return {
		defaultNodeColor: defaultColor,
		colorRules: rules,
	};
}

describe("ColorEvaluator", () => {
	it("should return default color when no rules match", () => {
		const settings = makeSettings("#ff0000", [
			{
				id: "rule1",
				expression: "Status === 'Archived'",
				enabled: true,
				color: "#00ff00",
			},
		]);
		const settings$ = new BehaviorSubject(settings);
		const evaluator = new ColorEvaluator(settings$);

		const fm = { Status: "Active" } as Record<string, unknown>;

		expect(evaluator.evaluateColor(fm)).toBe("#ff0000");
	});

	it("should return rule color when rule matches", () => {
		const settings = makeSettings("#ff0000", [
			{
				id: "rule1",
				expression: "Status === 'Archived'",
				enabled: true,
				color: "#00ff00",
			},
		]);
		const settings$ = new BehaviorSubject(settings);
		const evaluator = new ColorEvaluator(settings$);

		const fm = { Status: "Archived" } as Record<string, unknown>;

		expect(evaluator.evaluateColor(fm)).toBe("#00ff00");
	});

	it("should return first matching rule color", () => {
		const settings = makeSettings("#ff0000", [
			{
				id: "rule1",
				expression: "Status === 'Archived'",
				enabled: true,
				color: "#00ff00",
			},
			{
				id: "rule2",
				expression: "Status === 'Archived'",
				enabled: true,
				color: "#0000ff",
			},
		]);
		const settings$ = new BehaviorSubject(settings);
		const evaluator = new ColorEvaluator(settings$);

		const fm = { Status: "Archived" } as Record<string, unknown>;

		expect(evaluator.evaluateColor(fm)).toBe("#00ff00");
	});

	it("should ignore disabled rules", () => {
		const settings = makeSettings("#ff0000", [
			{
				id: "rule1",
				expression: "Status === 'Archived'",
				enabled: false,
				color: "#00ff00",
			},
		]);
		const settings$ = new BehaviorSubject(settings);
		const evaluator = new ColorEvaluator(settings$);

		const fm = { Status: "Archived" } as Record<string, unknown>;

		expect(evaluator.evaluateColor(fm)).toBe("#ff0000");
	});

	it("should handle empty rules array", () => {
		const settings = makeSettings("#ff0000", []);
		const settings$ = new BehaviorSubject(settings);
		const evaluator = new ColorEvaluator(settings$);

		const fm = { Status: "Archived" } as Record<string, unknown>;

		expect(evaluator.evaluateColor(fm)).toBe("#ff0000");
	});

	it("should update default color reactively", () => {
		const settings = makeSettings("#ff0000", []);
		const settings$ = new BehaviorSubject(settings);
		const evaluator = new ColorEvaluator(settings$);

		expect(evaluator.evaluateColor({})).toBe("#ff0000");

		settings$.next(makeSettings("#00ff00", []));

		expect(evaluator.evaluateColor({})).toBe("#00ff00");
	});

	it("should handle complex expressions", () => {
		const settings = makeSettings("#ff0000", [
			{
				id: "rule1",
				expression: "Status === 'Archived' && priority === 'high'",
				enabled: true,
				color: "#00ff00",
			},
		]);
		const settings$ = new BehaviorSubject(settings);
		const evaluator = new ColorEvaluator(settings$);

		const fm1 = { Status: "Archived", priority: "high" } as Record<string, unknown>;
		const fm2 = { Status: "Archived", priority: "low" } as Record<string, unknown>;

		expect(evaluator.evaluateColor(fm1)).toBe("#00ff00");
		expect(evaluator.evaluateColor(fm2)).toBe("#ff0000");
	});

	it("should handle property names with special characters", () => {
		const settings = makeSettings("#ff0000", [
			{
				id: "rule1",
				expression: "My-Property === 'test'",
				enabled: true,
				color: "#00ff00",
			},
		]);
		const settings$ = new BehaviorSubject(settings);
		const evaluator = new ColorEvaluator(settings$);

		const fm = { "My-Property": "test" } as Record<string, unknown>;

		expect(evaluator.evaluateColor(fm)).toBe("#00ff00");
	});
});
