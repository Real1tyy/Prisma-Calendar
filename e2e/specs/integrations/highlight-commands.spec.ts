import { runCommand } from "../../fixtures/commands";
import { expect, test } from "../../fixtures/electron";
import { openCalendar } from "../../fixtures/helpers";
import { refreshCalendar, seedEvents } from "../../fixtures/seed-events";

// Highlight commands are registered in main.ts:
//   "Highlight events without categories"
//   "Highlight events with category" (opens category select modal)
//   "Toggle prerequisite connection arrows"
// We verify each command runs and leaves the calendar renderable.

const SEED = [
	{ title: "Morning Standup", startDate: "2026-05-04T09:00", endDate: "2026-05-04T09:30", category: "Work" },
	{ title: "Untagged Event", startDate: "2026-05-05T10:00", endDate: "2026-05-05T10:30" },
] as const;

const CALENDAR_ROOT = ".fc";
const MODAL = ".modal";

test.describe("highlight commands", () => {
	test.beforeEach(async ({ obsidian }) => {
		seedEvents(obsidian.vaultDir, [...SEED]);
		await refreshCalendar(obsidian.page);
		await openCalendar(obsidian.page);
		await obsidian.page.locator(CALENDAR_ROOT).first().waitFor({ state: "visible" });
	});

	test("highlight-events-without-categories keeps the calendar renderable", async ({ obsidian }) => {
		await runCommand(obsidian.page, "Prisma Calendar: Highlight events without categories");
		await expect(obsidian.page.locator(CALENDAR_ROOT).first()).toBeVisible();
	});

	test("highlight-events-with-category opens the category select modal", async ({ obsidian }) => {
		await runCommand(obsidian.page, "Prisma Calendar: Highlight events with category");
		await expect(obsidian.page.locator(MODAL).last()).toBeVisible();
	});

	test("toggle-prerequisite-connections is idempotent", async ({ obsidian }) => {
		await runCommand(obsidian.page, "Prisma Calendar: Toggle prerequisite connection arrows");
		await runCommand(obsidian.page, "Prisma Calendar: Toggle prerequisite connection arrows");
		await expect(obsidian.page.locator(CALENDAR_ROOT).first()).toBeVisible();
	});
});
