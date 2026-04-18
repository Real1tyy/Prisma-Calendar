import { expect, test } from "../../fixtures/electron";
import { FILTER_EXPRESSION_TID, sel } from "../../fixtures/testids";

// Expression filter is an <input data-testid="prisma-filter-expression">
// injected into the calendar toolbar (input-managers/expression-filter.ts).
// `focus-expression-filter` moves the cursor there. Invalid expressions are
// swallowed by `createExpressionMatcher` (filter-logic.ts) — they never
// throw at the page level, so we assert no SyntaxError / ReferenceError
// reaches the renderer and the calendar DOM stays mounted.

const EXPRESSION_INPUT = sel(FILTER_EXPRESSION_TID);

test.describe("expression filter", () => {
	test.beforeEach(async ({ calendar }) => {
		await calendar.page.locator(EXPRESSION_INPUT).first().waitFor({ state: "attached" });
	});

	test("focus-expression-filter command focuses the toolbar input", async ({ calendar }) => {
		await calendar.runCommand("Prisma Calendar: Focus expression filter");
		await expect(calendar.page.locator(EXPRESSION_INPUT).first()).toBeFocused();
	});

	test("typing into the input updates its value", async ({ calendar }) => {
		const input = calendar.page.locator(EXPRESSION_INPUT).first();
		await input.fill("Category === 'Work'");
		await expect(input).toHaveValue("Category === 'Work'");

		await input.fill("");
		await expect(input).toHaveValue("");
	});

	test("invalid expression does not crash the view", async ({ calendar }) => {
		const pageErrors: string[] = [];
		calendar.page.on("pageerror", (err) => pageErrors.push(err.message));

		await calendar.page.locator(EXPRESSION_INPUT).first().fill("this is not valid js ===");

		await expect(calendar.page.locator(".fc")).toBeVisible();
		expect(pageErrors.filter((e) => /SyntaxError|ReferenceError/.test(e))).toEqual([]);
	});
});
