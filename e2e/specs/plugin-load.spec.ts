import { countPluginCommands, isPluginLoaded } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../fixtures/electron";
import { SELECTORS } from "../fixtures/selectors";

test.describe("plugin load", () => {
	test("launches Obsidian with the seed vault", async ({ obsidian }) => {
		await expect(obsidian.page.locator(SELECTORS.workspace)).toBeVisible();
	});

	test("enables prisma-calendar with no console errors", async ({ obsidian }) => {
		const errors: string[] = [];
		obsidian.page.on("console", (msg) => {
			if (msg.type() === "error") {
				errors.push(msg.text());
			}
		});

		expect(await isPluginLoaded(obsidian.page, "prisma-calendar")).toBe(true);
		expect(errors, errors.join("\n")).toEqual([]);
	});

	test("registers at least one Prisma command", async ({ obsidian }) => {
		expect(await countPluginCommands(obsidian.page, "prisma-calendar")).toBeGreaterThan(0);
	});
});
