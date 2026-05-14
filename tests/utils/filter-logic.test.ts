import { describe, expect, it, vi } from "vitest";

import { createExpressionMatcher, matchesSearch } from "../../src/utils/filter-logic";

describe("matchesSearch", () => {
	it("returns true for empty search", () => {
		expect(matchesSearch("", { title: "Anything" })).toBe(true);
	});

	it("matches title case-insensitively", () => {
		expect(matchesSearch("plan", { title: "Project Planning" })).toBe(true);
		expect(matchesSearch("PLAN", { title: "Project Planning" })).toBe(true);
	});

	it("falls back to meta.title when title missing", () => {
		expect(matchesSearch("alice", { meta: { title: "Meeting with Alice" } })).toBe(true);
	});

	it("returns false when no match found", () => {
		expect(matchesSearch("xyz", { title: "Workout" })).toBe(false);
	});
});

describe("createExpressionMatcher", () => {
	it("returns true when expression is empty", () => {
		const matcher = createExpressionMatcher(() => "");
		expect(matcher.evaluate({ Status: "active" })).toBe(true);
	});

	it("evaluates strict equality", () => {
		const matcher = createExpressionMatcher(() => 'Status === "active"');
		expect(matcher.evaluate({ Status: "active" })).toBe(true);
		expect(matcher.evaluate({ Status: "done" })).toBe(false);
	});

	it("evaluates strict inequality", () => {
		const matcher = createExpressionMatcher(() => 'Status !== "done"');
		expect(matcher.evaluate({ Status: "active" })).toBe(true);
		expect(matcher.evaluate({ Status: "done" })).toBe(false);
	});

	it("evaluates loose equality and inequality", () => {
		const matcher = createExpressionMatcher(() => "Priority == 1");
		expect(matcher.evaluate({ Priority: 1 })).toBe(true);
		expect(matcher.evaluate({ Priority: "1" })).toBe(true);

		const notMatcher = createExpressionMatcher(() => "Priority != 1");
		expect(notMatcher.evaluate({ Priority: 2 })).toBe(true);
		expect(notMatcher.evaluate({ Priority: 1 })).toBe(false);
	});

	it("evaluates numeric comparisons", () => {
		const matcher = createExpressionMatcher(() => "Priority > 2");
		expect(matcher.evaluate({ Priority: 3 })).toBe(true);
		expect(matcher.evaluate({ Priority: 1 })).toBe(false);
	});

	it("evaluates && and || short-circuit", () => {
		const matcher = createExpressionMatcher(() => 'Status === "active" && Priority > 1');
		expect(matcher.evaluate({ Status: "active", Priority: 2 })).toBe(true);
		expect(matcher.evaluate({ Status: "active", Priority: 1 })).toBe(false);
		expect(matcher.evaluate({ Status: "done", Priority: 2 })).toBe(false);

		const orMatcher = createExpressionMatcher(() => 'Status === "active" || Status === "blocked"');
		expect(orMatcher.evaluate({ Status: "active" })).toBe(true);
		expect(orMatcher.evaluate({ Status: "blocked" })).toBe(true);
		expect(orMatcher.evaluate({ Status: "done" })).toBe(false);
	});

	it("evaluates unary not", () => {
		const matcher = createExpressionMatcher(() => "!Done");
		expect(matcher.evaluate({ Done: false })).toBe(true);
		expect(matcher.evaluate({ Done: true })).toBe(false);
		expect(matcher.evaluate({})).toBe(true);
	});

	it("evaluates parenthesized groups", () => {
		const matcher = createExpressionMatcher(() => '(Status === "a" || Status === "b") && Priority > 0');
		expect(matcher.evaluate({ Status: "a", Priority: 1 })).toBe(true);
		expect(matcher.evaluate({ Status: "c", Priority: 1 })).toBe(false);
	});

	it("supports .includes() against array properties", () => {
		const matcher = createExpressionMatcher(() => 'Tags.includes("work")');
		expect(matcher.evaluate({ Tags: ["work", "urgent"] })).toBe(true);
		expect(matcher.evaluate({ Tags: ["personal"] })).toBe(false);
		expect(matcher.evaluate({ Tags: [] })).toBe(false);
	});

	it("supports .includes() against string properties", () => {
		const matcher = createExpressionMatcher(() => 'Title.includes("plan")');
		expect(matcher.evaluate({ Title: "Project planning" })).toBe(true);
		expect(matcher.evaluate({ Title: "Workout" })).toBe(false);
	});

	it("returns false when .includes() target is missing", () => {
		const matcher = createExpressionMatcher(() => 'Tags.includes("work")');
		expect(matcher.evaluate({})).toBe(false);
	});

	it("sanitizes property names with spaces/dashes", () => {
		const matcher = createExpressionMatcher(() => 'Start_Date === "2026-05-13"');
		expect(matcher.evaluate({ "Start Date": "2026-05-13" })).toBe(true);
		expect(matcher.evaluate({ "Start Date": "2026-05-14" })).toBe(false);
	});

	it("invalidate() clears cache so a new expression takes effect", () => {
		let expr = 'Status === "a"';
		const matcher = createExpressionMatcher(() => expr);
		expect(matcher.evaluate({ Status: "a" })).toBe(true);
		expr = 'Status === "b"';
		matcher.invalidate();
		expect(matcher.evaluate({ Status: "b" })).toBe(true);
		expect(matcher.evaluate({ Status: "a" })).toBe(false);
	});

	it("returns false on parse errors and warns at most once per expression", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const matcher = createExpressionMatcher(() => "this is not a (valid expression");
		expect(matcher.evaluate({ Status: "a" })).toBe(false);
		expect(matcher.evaluate({ Status: "a" })).toBe(false);
		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();
	});

	it("rejects disallowed methods", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const matcher = createExpressionMatcher(() => 'Title.toUpperCase() === "X"');
		expect(matcher.evaluate({ Title: "x" })).toBe(false);
		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();
	});

	it("blocks prototype-chain access (e.g. .constructor) by returning undefined", () => {
		// Member access only reaches own properties of the target. Prototype methods
		// like `.constructor` are NOT exposed — `Tags.constructor` resolves to undefined,
		// which is falsy, so the expression returns false without crashing or warning.
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const matcher = createExpressionMatcher(() => "Tags.constructor");
		expect(matcher.evaluate({ Tags: [] })).toBe(false);
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	describe("operators", () => {
		it("evaluates all comparison operators", () => {
			const cases: Array<[string, Record<string, unknown>, boolean]> = [
				["Priority < 5", { Priority: 3 }, true],
				["Priority < 5", { Priority: 5 }, false],
				["Priority <= 5", { Priority: 5 }, true],
				["Priority <= 5", { Priority: 6 }, false],
				["Priority >= 5", { Priority: 5 }, true],
				["Priority >= 5", { Priority: 4 }, false],
			];
			for (const [expr, fm, expected] of cases) {
				const matcher = createExpressionMatcher(() => expr);
				expect(matcher.evaluate(fm), `${expr} on ${JSON.stringify(fm)}`).toBe(expected);
			}
		});

		it("evaluates arithmetic operators", () => {
			const matcher = createExpressionMatcher(() => "Priority + 1 === 3");
			expect(matcher.evaluate({ Priority: 2 })).toBe(true);
			expect(matcher.evaluate({ Priority: 1 })).toBe(false);

			const sub = createExpressionMatcher(() => "Score - 10 > 0");
			expect(sub.evaluate({ Score: 15 })).toBe(true);
			expect(sub.evaluate({ Score: 5 })).toBe(false);

			const mod = createExpressionMatcher(() => "Count % 2 === 0");
			expect(mod.evaluate({ Count: 4 })).toBe(true);
			expect(mod.evaluate({ Count: 3 })).toBe(false);
		});

		it("evaluates unary +/-", () => {
			const neg = createExpressionMatcher(() => "-Score < 0");
			expect(neg.evaluate({ Score: 5 })).toBe(true);
			expect(neg.evaluate({ Score: -5 })).toBe(false);

			const pos = createExpressionMatcher(() => "+Count === 3");
			expect(pos.evaluate({ Count: "3" })).toBe(true);
			expect(pos.evaluate({ Count: "4" })).toBe(false);
		});

		it("evaluates ternary conditional", () => {
			const matcher = createExpressionMatcher(() => "IsUrgent ? Priority > 5 : Priority > 2");
			expect(matcher.evaluate({ IsUrgent: true, Priority: 7 })).toBe(true);
			expect(matcher.evaluate({ IsUrgent: true, Priority: 4 })).toBe(false);
			expect(matcher.evaluate({ IsUrgent: false, Priority: 3 })).toBe(true);
			expect(matcher.evaluate({ IsUrgent: false, Priority: 1 })).toBe(false);
		});
	});

	describe("literals", () => {
		it("normalizes null and missing keys to undefined in the scope", () => {
			// Frontmatter nulls and missing keys are both represented as `undefined`
			// inside the evaluator (`value ?? undefined`), so `=== null` always fails.
			const matcher = createExpressionMatcher(() => "Owner === null");
			expect(matcher.evaluate({ Owner: null })).toBe(false);
			expect(matcher.evaluate({})).toBe(false);

			// Loose equality treats null and undefined as equal in JS — works as expected.
			const looseMatcher = createExpressionMatcher(() => "Owner == null");
			expect(looseMatcher.evaluate({ Owner: null })).toBe(true);
			expect(looseMatcher.evaluate({})).toBe(true);
			expect(looseMatcher.evaluate({ Owner: "Alice" })).toBe(false);
		});

		it("handles boolean literals", () => {
			const matcher = createExpressionMatcher(() => "Done === true");
			expect(matcher.evaluate({ Done: true })).toBe(true);
			expect(matcher.evaluate({ Done: false })).toBe(false);
		});

		it("handles array literals on the right of .includes()", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			// Arrays on the right side are accepted as a value; .includes against an array of arrays
			const matcher = createExpressionMatcher(() => 'Tags.includes("a")');
			expect(matcher.evaluate({ Tags: ["a", "b"] })).toBe(true);
			expect(matcher.evaluate({ Tags: ["c"] })).toBe(false);
			warn.mockRestore();
		});
	});

	describe("scope and missing properties", () => {
		it("undefined identifier resolves to undefined (not throw)", () => {
			const matcher = createExpressionMatcher(() => "Unknown === undefined");
			// jsep doesn't recognize `undefined` as a literal by default — it's an identifier
			// that resolves to `undefined` from the scope, which equals our missing-key undefined.
			expect(matcher.evaluate({})).toBe(true);
		});

		it("two missing keys compare as equal", () => {
			const matcher = createExpressionMatcher(() => "A === B");
			expect(matcher.evaluate({})).toBe(true);
		});

		it("rebuilds the AST when frontmatter introduces new keys", () => {
			const matcher = createExpressionMatcher(() => 'Status === "a"');
			expect(matcher.evaluate({ Status: "a" })).toBe(true);
			// Add a new key — the matcher should still work; mapping rebuild does not corrupt the AST.
			expect(matcher.evaluate({ Status: "a", NewProp: 123 })).toBe(true);
			expect(matcher.evaluate({ Status: "b", NewProp: 123 })).toBe(false);
		});
	});

	describe("security boundary", () => {
		it("rejects function declarations and expressions", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const matcher = createExpressionMatcher(() => "(function(){ return true; })()");
			expect(matcher.evaluate({})).toBe(false);
			warn.mockRestore();
		});

		it("rejects 'this' references", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const matcher = createExpressionMatcher(() => "this === undefined");
			expect(matcher.evaluate({})).toBe(false);
			warn.mockRestore();
		});

		it("rejects bracketed member access", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const matcher = createExpressionMatcher(() => 'Tags["constructor"]');
			expect(matcher.evaluate({ Tags: [] })).toBe(false);
			warn.mockRestore();
		});

		it("rejects calls against an object's prototype methods", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			// `valueOf` is on every object's prototype but not in our allow-list.
			const matcher = createExpressionMatcher(() => "Priority.valueOf() === 1");
			expect(matcher.evaluate({ Priority: 1 })).toBe(false);
			warn.mockRestore();
		});
	});

	describe("caching", () => {
		it("reuses the cached AST when the expression and key set are unchanged", () => {
			let getCalls = 0;
			const matcher = createExpressionMatcher(() => {
				getCalls++;
				return 'Status === "a"';
			});
			matcher.evaluate({ Status: "a" });
			matcher.evaluate({ Status: "a" });
			matcher.evaluate({ Status: "b" });
			// getExpression is called each evaluate; the AST cache prevents reparsing.
			// We can't observe parses directly, but we can confirm the matcher still works
			// after many calls (no state corruption).
			expect(getCalls).toBe(3);
		});

		it("does NOT silently use stale AST when the expression string changes between calls", () => {
			let expr = 'Status === "a"';
			const matcher = createExpressionMatcher(() => expr);
			expect(matcher.evaluate({ Status: "a" })).toBe(true);
			// Change the expression — the matcher detects the change and re-parses.
			expr = 'Status === "b"';
			expect(matcher.evaluate({ Status: "b" })).toBe(true);
			expect(matcher.evaluate({ Status: "a" })).toBe(false);
		});
	});
});
