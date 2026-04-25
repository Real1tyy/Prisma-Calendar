import { join } from "node:path";

import { expect, test } from "@playwright/test";
import { listFixtureFiles } from "@real1ty-obsidian-plugins/testing/visual";

const FIXTURES_DIR = join(__dirname, "fixtures");
const fixtures = listFixtureFiles(FIXTURES_DIR);

if (fixtures.length === 0) {
	test("no visual fixtures found", () => {
		throw new Error(
			`No HTML fixtures in ${FIXTURES_DIR}. ` +
				"Run 'pnpm test tests/visual/generate-fixtures.test.ts' first (or 'mise run test-visual' which does both)."
		);
	});
} else {
	for (const fixture of fixtures) {
		test(`visual: ${fixture}`, async ({ page }) => {
			await page.goto(`file://${join(FIXTURES_DIR, fixture)}`);
			await page.waitForLoadState("networkidle");
			await page.evaluate(() => document.fonts.ready);
			await expect(page).toHaveScreenshot(`${fixture}.png`, { fullPage: true });
		});
	}
}
