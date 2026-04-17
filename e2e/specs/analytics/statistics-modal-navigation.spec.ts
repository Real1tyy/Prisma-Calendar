import { closeOpenModal } from "../../fixtures/analytics-helpers";
import { expect, test } from "../../fixtures/electron";
import { clickToolbar, openCalendarViewViaRibbon } from "../../fixtures/helpers";

// The weekly-stats modal has prev/next/today navigation buttons that shift
// the visible week. The period-label reflects the current range — clicking
// next must produce a different label than the starting one.

test.describe("analytics: stats modal navigation", () => {
	test("weekly-stats modal prev/next buttons update the period label", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);

		await clickToolbar(obsidian.page, "weekly-stats");
		await expect(obsidian.page.locator(".modal").first()).toBeVisible({ timeout: 5_000 });

		const periodLabel = obsidian.page.locator('[data-testid="prisma-stats-modal-period-label"]').first();
		await periodLabel.waitFor({ state: "visible", timeout: 5_000 });

		const initialLabel = (await periodLabel.innerText()).trim();

		await obsidian.page.locator('[data-testid="prisma-stats-modal-next"]').first().click();
		await expect(periodLabel).not.toHaveText(initialLabel, { timeout: 5_000 });

		// Today button snaps back to the current week.
		await obsidian.page.locator('[data-testid="prisma-stats-modal-today"]').first().click();
		await expect(periodLabel).toHaveText(initialLabel, { timeout: 5_000 });

		// Prev moves backwards by the same span.
		await obsidian.page.locator('[data-testid="prisma-stats-modal-prev"]').first().click();
		await expect(periodLabel).not.toHaveText(initialLabel, { timeout: 5_000 });

		await closeOpenModal(obsidian.page);
	});
});
