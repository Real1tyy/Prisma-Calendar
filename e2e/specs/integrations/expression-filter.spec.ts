import { runCommand } from "../../fixtures/commands";
import { expect, test } from "../../fixtures/electron";
import { openCalendar } from "../../fixtures/helpers";

// Expression filter is an <input data-testid="prisma-filter-expression">
// injected into the calendar toolbar (input-managers/expression-filter.ts).
// `focus-expression-filter` moves the cursor there. Invalid expressions are
// swallowed by `createExpressionMatcher` (filter-logic.ts) — they never
// throw at the page level, so we assert no SyntaxError / ReferenceError
// reaches the renderer and the calendar DOM stays mounted.

const EXPRESSION_INPUT = '[data-testid="prisma-filter-expression"]';

test.describe("expression filter", () => {
	test.beforeEach(async ({ obsidian }) => {
		await openCalendar(obsidian.page);
		await obsidian.page.locator(EXPRESSION_INPUT).first().waitFor({ state: "attached" });
	});

	test("focus-expression-filter command focuses the toolbar input", async ({ obsidian }) => {
		await runCommand(obsidian.page, "Prisma Calendar: Focus expression filter");
		await expect(obsidian.page.locator(EXPRESSION_INPUT).first()).toBeFocused();
	});

	test("typing into the input updates its value", async ({ obsidian }) => {
		const input = obsidian.page.locator(EXPRESSION_INPUT).first();
		await input.fill("Category === 'Work'");
		await expect(input).toHaveValue("Category === 'Work'");

		await input.fill("");
		await expect(input).toHaveValue("");
	});

	test("invalid expression does not crash the view", async ({ obsidian }) => {
		const pageErrors: string[] = [];
		obsidian.page.on("pageerror", (err) => pageErrors.push(err.message));

		await obsidian.page.locator(EXPRESSION_INPUT).first().fill("this is not valid js ===");

		await expect(obsidian.page.locator(".fc")).toBeVisible();
		expect(pageErrors.filter((e) => /SyntaxError|ReferenceError/.test(e))).toEqual([]);
	});
});
