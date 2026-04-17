import { runCommand } from "../../fixtures/commands";
import { expect, test } from "../../fixtures/electron";
import { openCalendar } from "../../fixtures/helpers";

// Stopwatch is rendered inside the event modal as a collapsible section
// (components/stopwatch.ts). The display span is stamped with
// data-testid="prisma-stopwatch-time" and the minimize button with
// data-testid="prisma-event-btn-minimize" (base-event-modal.ts).

const MODAL = ".modal";
const STOPWATCH_TIME = '[data-testid="prisma-stopwatch-time"]';
const MINIMIZE_BUTTON = '[data-testid="prisma-event-btn-minimize"]';

test.describe("stopwatch lifecycle", () => {
	test.beforeEach(async ({ obsidian }) => {
		await openCalendar(obsidian.page);
	});

	test("create-event-with-stopwatch opens the modal with an active stopwatch", async ({ obsidian }) => {
		await runCommand(obsidian.page, "Prisma Calendar: Create new event with stopwatch");

		await expect(obsidian.page.locator(MODAL).first()).toBeVisible();

		const display = obsidian.page.locator(STOPWATCH_TIME).first();
		await display.waitFor({ state: "visible" });

		const first = await display.textContent();
		await obsidian.page.waitForTimeout(2_000);
		const second = await display.textContent();
		expect(first).not.toBe(second);
	});

	test("minimize preserves stopwatch state across reopen", async ({ obsidian }) => {
		await runCommand(obsidian.page, "Prisma Calendar: Create new event with stopwatch");

		const modal = obsidian.page.locator(MODAL).first();
		await modal.waitFor({ state: "visible" });
		await obsidian.page.locator(STOPWATCH_TIME).first().waitFor({ state: "visible" });

		await obsidian.page.waitForTimeout(1_500);

		await obsidian.page.locator(MINIMIZE_BUTTON).first().click();
		await expect(modal).toBeHidden();

		await runCommand(obsidian.page, "Prisma Calendar: Restore minimized event modal");
		await expect(obsidian.page.locator(MODAL).first()).toBeVisible();
		await expect(obsidian.page.locator(STOPWATCH_TIME).first()).toBeVisible();
	});
});
