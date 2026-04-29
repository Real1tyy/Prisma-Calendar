import { expect } from "@playwright/test";

import { testResilience as test } from "../../fixtures/electron";
import {
	activateCalendar,
	addCalendar,
	countLeavesOfType,
	reloadAndWaitForPrisma,
} from "../../fixtures/resilience-helpers";

// Obsidian persists the active leaf across reloads via workspace.json. Prove
// that when a *non-default* calendar view is open, reload reopens THAT view
// — not the first calendar in the list.
test("reload reopens the active calendar view", async ({ obsidian }) => {
	await addCalendar(obsidian.page, {
		id: "secondary",
		name: "Secondary",
		enabled: true,
		directory: "Events-Secondary",
	});

	const SECONDARY_VIEW_TYPE = "custom-calendar-view-secondary";
	await activateCalendar(obsidian.page, "secondary");

	await expect.poll(() => countLeavesOfType(obsidian.page, SECONDARY_VIEW_TYPE), { timeout: 15_000 }).toBe(1);

	await reloadAndWaitForPrisma(obsidian.page);

	expect(await countLeavesOfType(obsidian.page, SECONDARY_VIEW_TYPE)).toBe(1);
});
