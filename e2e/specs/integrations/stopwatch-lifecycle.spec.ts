import { expect, test } from "../../fixtures/electron";
import { sel, STOPWATCH_TIME_TID, TID } from "../../fixtures/testids";

// Stopwatch is rendered inside the event modal as a collapsible section
// (components/stopwatch.ts). The display span is stamped with
// data-testid="prisma-stopwatch-time" and the minimize button with
// data-testid="prisma-event-btn-minimize" (base-event-modal.ts).

const MODAL = ".modal";
const STOPWATCH_TIME = sel(STOPWATCH_TIME_TID);
const MINIMIZE_BUTTON = sel(TID.event.btn("minimize"));

test.describe("stopwatch lifecycle", () => {
	test("create-event-with-stopwatch opens the modal with an active stopwatch", async ({ calendar }) => {
		await calendar.runCommand("Prisma Calendar: Create new event with stopwatch");

		await expect(calendar.page.locator(MODAL).first()).toBeVisible();

		const display = calendar.page.locator(STOPWATCH_TIME).first();
		await display.waitFor({ state: "visible" });

		const first = await display.textContent();
		await calendar.page.waitForTimeout(2_000);
		const second = await display.textContent();
		expect(first).not.toBe(second);
	});

	test("minimize preserves stopwatch state across reopen", async ({ calendar }) => {
		await calendar.runCommand("Prisma Calendar: Create new event with stopwatch");

		const modal = calendar.page.locator(MODAL).first();
		await modal.waitFor({ state: "visible" });
		await calendar.page.locator(STOPWATCH_TIME).first().waitFor({ state: "visible" });

		await calendar.page.waitForTimeout(1_500);

		await calendar.page.locator(MINIMIZE_BUTTON).first().click();
		await expect(modal).toBeHidden();

		await calendar.runCommand("Prisma Calendar: Restore minimized event modal");
		await expect(calendar.page.locator(MODAL).first()).toBeVisible();
		await expect(calendar.page.locator(STOPWATCH_TIME).first()).toBeVisible();
	});
});
