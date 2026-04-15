import { executeCommand } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../fixtures/electron";
import { openCalendar } from "../fixtures/helpers";

test.describe("event creation", () => {
	test("create event command opens a modal", async ({ obsidian }) => {
		// Prisma's create-event command resolves against the active calendar
		// bundle, so the calendar view needs to be open first. The fixture
		// initializes bundles but doesn't activate any view — specs opt in.
		await openCalendar(obsidian.page);

		const executed = await executeCommand(obsidian.page, "prisma-calendar:create-event");
		expect(executed).toBe(true);

		await expect(obsidian.page.locator(".modal").first()).toBeVisible({ timeout: 5_000 });
	});
});
