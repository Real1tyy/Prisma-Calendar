import { BehaviorSubject } from "rxjs";
import { describe, expect, it } from "vitest";

import { FilterEvaluator } from "../../../src/core/evaluator/filter";

interface TestSettings {
	filterExpressions: string[];
}

function makeSettings(expressions: string[]): TestSettings {
	return { filterExpressions: expressions };
}

describe("FilterEvaluator", () => {
	it("returns true when no rules are defined", () => {
		const settings = makeSettings([]);
		const settings$ = new BehaviorSubject(settings);
		const evaluator = new FilterEvaluator(settings$);

		expect(evaluator.evaluateFilters({ Status: "Anything" })).toBe(true);
	});

	it("returns true when all rules evaluate to true", () => {
		const settings = makeSettings(["Status === 'Archived'", "private === true"]);
		const settings$ = new BehaviorSubject(settings);
		const evaluator = new FilterEvaluator(settings$);

		const fm = { Status: "Archived", private: true } as Record<string, unknown>;

		expect(evaluator.evaluateFilters(fm)).toBe(true);
	});

	it("returns false when any rule evaluates to false", () => {
		const settings = makeSettings(["Status === 'Archived'", "private === true"]);
		const settings$ = new BehaviorSubject(settings);
		const evaluator = new FilterEvaluator(settings$);

		const fm = { Status: "Active", private: true } as Record<string, unknown>;

		expect(evaluator.evaluateFilters(fm)).toBe(false);
	});

	it("handles property names with special characters", () => {
		const settings = makeSettings(["My-Property === 'test'"]);
		const settings$ = new BehaviorSubject(settings);
		const evaluator = new FilterEvaluator(settings$);

		const fm = { "My-Property": "test" } as Record<string, unknown>;

		expect(evaluator.evaluateFilters(fm)).toBe(true);
	});

	it("handles array operations without fm prefix", () => {
		const settings = makeSettings(["Array.isArray(tags) && tags.includes('important')"]);
		const settings$ = new BehaviorSubject(settings);
		const evaluator = new FilterEvaluator(settings$);

		const fm = { tags: ["important", "work"] } as Record<string, unknown>;

		expect(evaluator.evaluateFilters(fm)).toBe(true);
	});

	it("evaluates missing properties as undefined instead of rejecting", () => {
		const settings = makeSettings(["_Archived !== true"]);
		const settings$ = new BehaviorSubject(settings);
		const evaluator = new FilterEvaluator(settings$);

		const fm = { title: "Team Meeting" } as Record<string, unknown>;

		expect(evaluator.evaluateFilters(fm)).toBe(true);
	});

	it("rejects when missing property is required to equal a value", () => {
		const settings = makeSettings(["Status === 'Active'"]);
		const settings$ = new BehaviorSubject(settings);
		const evaluator = new FilterEvaluator(settings$);

		const fm = { title: "Team Meeting" } as Record<string, unknown>;

		expect(evaluator.evaluateFilters(fm)).toBe(false);
	});

	it("handles negation of missing boolean property", () => {
		const settings = makeSettings(["!_Archived"]);
		const settings$ = new BehaviorSubject(settings);
		const evaluator = new FilterEvaluator(settings$);

		const fm = {} as Record<string, unknown>;

		expect(evaluator.evaluateFilters(fm)).toBe(true);
	});

	it("handles missing property with no frontmatter keys from expression", () => {
		const settings = makeSettings(["Status !== 'Inbox'"]);
		const settings$ = new BehaviorSubject(settings);
		const evaluator = new FilterEvaluator(settings$);

		const fmWithout = {} as Record<string, unknown>;
		expect(evaluator.evaluateFilters(fmWithout)).toBe(true);

		const fmWith = { Status: "Inbox" } as Record<string, unknown>;
		expect(evaluator.evaluateFilters(fmWith)).toBe(false);
	});
});
