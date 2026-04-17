import { gotoToday, todayTimedEvent } from "../../fixtures/calendar-helpers";
import { expect, test } from "../../fixtures/electron";
import { openCalendar } from "../../fixtures/helpers";
import { refreshCalendar, seedEvent } from "../../fixtures/seed-events";

test.describe("dual daily tab", () => {
	test("dual-daily tab activates without console errors", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;
		seedEvent(vaultDir, todayTimedEvent("Dual A", 9, 10));

		const errors: string[] = [];
		page.on("pageerror", (err) => errors.push(err.message));

		await openCalendar(page);
		await refreshCalendar(page);
		await gotoToday(page);

		const tab = page.locator('[data-testid="prisma-view-tab-dual-daily"]').first();
		if ((await tab.count()) === 0) test.skip(true, "dual-daily tab not present in this build");
		await tab.click();

		// Switching tabs hides the main calendar's `.fc` (display:none on the
		// deactivated tab). Dual-daily lazily mounts two of its own `.fc`
		// roots, so wait for a visible one rather than the first-in-DOM one.
		await expect.poll(() => page.locator(".fc:visible").count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
		expect(errors, `pageerror(s) while opening dual-daily:\n${errors.join("\n")}`).toHaveLength(0);
	});
});
