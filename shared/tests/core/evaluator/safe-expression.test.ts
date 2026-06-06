import { BehaviorSubject } from "rxjs";
import { afterEach, describe, expect, it } from "vitest";

import { ColorEvaluator, type ColorRule } from "../../../src/core/evaluator/color";
import {
	evaluateSafeExpression,
	InvalidExpressionError,
	parseSafeExpression,
} from "../../../src/core/evaluator/safe-expression";

const SENTINEL = "__SAFE_EXPR_PWNED__" as const;

declare global {
	var __SAFE_EXPR_PWNED__: boolean | undefined;
}

describe("evaluateSafeExpression", () => {
	describe("supported grammar", () => {
		it.each<[string, Record<string, unknown>, boolean]>([
			["Status === 'Archived'", { Status: "Archived" }, true],
			["Status === 'Archived'", { Status: "Active" }, false],
			["Status === 'Archived' && priority === 'high'", { Status: "Archived", priority: "high" }, true],
			["Status === 'Archived' && priority === 'high'", { Status: "Archived", priority: "low" }, false],
			["Tags.includes('urgent') || Priority === 'High'", { Priority: "High" }, true],
			["My-Property === 'test'", { "My-Property": "test" }, true],
			["private === true", { private: true }, true],
			["Array.isArray(tags) && tags.includes('important')", { tags: ["important", "work"] }, true],
			["Array.isArray(tags) && tags.includes('missing')", { tags: ["important", "work"] }, false],
			["Category?.includes('Work')", { Category: "Work" }, true],
			["Category?.includes('Work')", {}, false],
			["count > 3", { count: 5 }, true],
			["count > 3", { count: 2 }, false],
			["count >= 3 && count <= 10", { count: 7 }, true],
			["!archived", { archived: false }, true],
			["title.toLowerCase().includes('plan')", { title: "Project PLAN" }, true],
			["tags.length > 0", { tags: ["a"] }, true],
			["tags.length > 0", { tags: [] }, false],
			["typeof status !== 'undefined'", { status: "x" }, true],
			["typeof status !== 'undefined'", {}, false],
			["new Date(date) > new Date('2024-01-01')", { date: "2024-06-01" }, true],
			["new Date(date) > new Date('2024-01-01')", { date: "2023-06-01" }, false],
		])("evaluates %s correctly", (expression, frontmatter, expected) => {
			expect(evaluateSafeExpression(expression, frontmatter)).toBe(expected);
		});

		it("treats missing properties as undefined instead of throwing", () => {
			expect(evaluateSafeExpression("_Archived !== true", { title: "Team Meeting" })).toBe(true);
			expect(evaluateSafeExpression("!_Archived", {})).toBe(true);
			expect(evaluateSafeExpression("Status === 'Active'", { title: "Team Meeting" })).toBe(false);
		});

		it("returns true for an empty expression", () => {
			expect(evaluateSafeExpression("   ", { Status: "Active" })).toBe(true);
		});
	});

	// Every expression shown in the filtering / color-rule documentation and in the settings UI
	// (Fusion-Goals + Nexus) must parse and evaluate. Each is paired with matching frontmatter so a
	// real user filter "passes" (matches). Guards against the jsep migration silently dropping a
	// documented construct.
	describe("documentation & settings examples (all match with matching frontmatter)", () => {
		it.each<[string, Record<string, unknown>]>([
			// Equality / inequality
			["status === 'active'", { status: "active" }],
			["type !== 'archived'", { type: "project" }],
			["priority !== 'low'", { priority: "high" }],
			["completed === true", { completed: true }],
			["archived !== true", { archived: false }],
			["status !== null", { status: "active" }],
			["status !== ''", { status: "active" }],
			["Status === 'Active'", { Status: "Active" }],
			["Priority === 'High'", { Priority: "High" }],
			["type === 'project'", { type: "project" }],
			// Numeric & string comparison
			["progress > 50", { progress: 75 }],
			["count <= 10", { count: 5 }],
			["score >= 75", { score: 80 }],
			["age >= 18", { age: 21 }],
			["priority >= 8", { priority: 9 }],
			["tags.length > 3", { tags: [1, 2, 3, 4] }],
			["priority >= 'high'", { priority: "high" }],
			// Logical operators
			["status === 'active' && priority === 'high'", { status: "active", priority: "high" }],
			["status === 'active' || status === 'pending'", { status: "pending" }],
			["type === 'project' || type === 'task'", { type: "task" }],
			["status === 'complete' && priority === 'high'", { status: "complete", priority: "high" }],
			["status === 'pending' && priority === 'urgent'", { status: "pending", priority: "urgent" }],
			// Arrays
			["Array.isArray(tags) && tags.includes('important')", { tags: ["important"] }],
			["Array.isArray(tags) && tags.length > 0", { tags: ["x"] }],
			["Array.isArray(attachments) && attachments.length > 0", { attachments: ["a"] }],
			["Array.isArray(tags) && (tags.includes('machine-learning') || tags.includes('ai'))", { tags: ["ai"] }],
			["tags.includes('important')", { tags: ["important"] }],
			["Array.isArray(tags)", { tags: [] }],
			["tags.length > 0", { tags: ["x"] }],
			["type === 'project' && Array.isArray(tags) && tags.includes('active')", { type: "project", tags: ["active"] }],
			// String methods
			["title.includes('Project')", { title: "My Project" }],
			["title.startsWith('DRAFT')", { title: "DRAFT note" }],
			["title.toLowerCase() === 'important'", { title: "Important" }],
			["title.toLowerCase().includes('search term')", { title: "My SEARCH TERM here" }],
			// Nested property access
			["metadata && metadata.category === 'work'", { metadata: { category: "work" } }],
			["author && author.name === 'Alice'", { author: { name: "Alice" } }],
			// Existence / typeof
			["typeof status !== 'undefined'", { status: "active" }],
			["typeof status === 'undefined' || typeof type === 'undefined'", {}],
		])("matches: %s", (expression, frontmatter) => {
			expect(evaluateSafeExpression(expression, frontmatter)).toBe(true);
		});

		// Date-comparison examples from the docs. These rely on `new Date(...)`, parsed via the
		// @jsep-plugin/new plugin registered in safe-expression.ts.
		it.each<[string, Record<string, unknown>]>([
			["new Date(date) > new Date('2024-01-01')", { date: "2024-06-01" }],
			["new Date(lastModified) < new Date('2023-01-01')", { lastModified: "2022-06-01" }],
			["typeof date !== 'undefined' && new Date(date) > new Date('2024-01-01')", { date: "2024-06-01" }],
			["typeof lastReviewed === 'undefined' || new Date(lastReviewed) < new Date('2024-01-01')", {}],
		])("matches date filter: %s", (expression, frontmatter) => {
			expect(evaluateSafeExpression(expression, frontmatter)).toBe(true);
		});
	});

	describe("rejects disallowed syntax (fails closed)", () => {
		it.each([
			["object literal", "({}).constructor"],
			["arrow function", "(() => 1)()"],
			["assignment", "x = 1"],
			["template literal", "`${x}`"],
		])("rejects at parse: %s", (_label, expression) => {
			expect(() => parseSafeExpression(expression)).toThrow();
		});

		it.each([
			["statement separator (compound)", "a; b"],
			["bitwise operator", "a | b"],
			["function-constructor escape via array", "[].constructor.constructor('return 1')()"],
			["function-constructor escape via string", "''.constructor.constructor('return 1')()"],
			["new Function escape", "new Function('return 1')()"],
			["non-Date constructor", "new WeakRef(x)"],
			["disallowed method call", "Status.replace.call(Status)"],
		])("parses but refuses to evaluate: %s", (_label, expression) => {
			expect(() => evaluateSafeExpression(expression, { Status: "x" })).toThrow(InvalidExpressionError);
		});
	});

	// The RCE payload writes to `globalThis.__SAFE_EXPR_PWNED__`, so these assertions must
	// observe that exact object — `window`/`activeWindow` would check the wrong global.
	/* eslint-disable obsidianmd/no-global-this */
	describe("security: no code execution (regression for new Function RCE)", () => {
		afterEach(() => {
			delete globalThis[SENTINEL];
		});

		const PAYLOAD = `[].constructor.constructor('globalThis.${SENTINEL} = true')()`;

		it("never executes a constructor-escape payload via evaluateSafeExpression", () => {
			globalThis[SENTINEL] = false;
			expect(() => evaluateSafeExpression(PAYLOAD, { Status: "x" })).toThrow();
			expect(globalThis[SENTINEL]).toBe(false);
		});

		it("never executes a payload smuggled through a ColorEvaluator rule", () => {
			globalThis[SENTINEL] = false;
			const rules: ColorRule[] = [{ id: "evil", expression: PAYLOAD, enabled: true, color: "#000000" }];
			const settings$ = new BehaviorSubject({ defaultNodeColor: "#ffffff", colorRules: rules });
			const evaluator = new ColorEvaluator(settings$);

			// The malicious rule must not match (fails closed) and must not run.
			expect(evaluator.evaluateColor({ Status: "x" })).toBe("#ffffff");
			expect(globalThis[SENTINEL]).toBe(false);
		});
	});
	/* eslint-enable obsidianmd/no-global-this */
});
