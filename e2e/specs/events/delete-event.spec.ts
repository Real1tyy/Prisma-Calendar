import { existsSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "../../fixtures/electron";
import {
	eventBlockLocator,
	expectEventVisible,
	formatLocalDate,
	openCalendarReady,
	rightClickEventMenu,
	seedEventFile,
} from "./events-helpers";

// Deleting a non-recurring event goes straight through — right-click the block,
// hit "Delete event" in the context menu, and the file is trashed immediately.
// No confirmation modal gates this path (that only exists for recurring sources
// with physical instances), so the file flip is the only signal to assert on.
test.describe("delete event", () => {
	test("right-click → Delete event removes file and block", async ({ obsidian }) => {
		const today = formatLocalDate(new Date());
		const seedPath = seedEventFile(obsidian.vaultDir, "Delete Me", {
			"Start Date": `${today}T09:00`,
			"End Date": `${today}T10:00`,
		});

		await openCalendarReady(obsidian.page);
		await expectEventVisible(obsidian.page, "Delete Me");

		await rightClickEventMenu(obsidian.page, "Delete Me", "deleteEvent");

		await expect.poll(() => existsSync(join(obsidian.vaultDir, seedPath)), { timeout: 10_000 }).toBe(false);

		await expect(eventBlockLocator(obsidian.page, "Delete Me")).toHaveCount(0);
	});
});
