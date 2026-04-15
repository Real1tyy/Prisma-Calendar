import { openSettingsTab } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../fixtures/electron";
import { SELECTORS } from "../fixtures/selectors";

test.describe("settings tab", () => {
	test("renders the Prisma Calendar settings pane", async ({ obsidian }) => {
		await openSettingsTab(obsidian.page, "prisma-calendar");

		const content = obsidian.page.locator(SELECTORS.settings.content);
		await expect(content).toBeVisible();
		await expect(content.locator(SELECTORS.settings.heading).first()).toBeVisible();
	});
});
