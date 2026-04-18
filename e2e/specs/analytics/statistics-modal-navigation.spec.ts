import { closeOpenModal } from "../../fixtures/analytics-helpers";
import { expect, test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";

// The weekly-stats modal has prev/next/today navigation buttons that shift
// the visible week. The period-label reflects the current range — clicking
// next must produce a different label than the starting one.

test.describe("analytics: stats modal navigation", () => {
	test("weekly-stats modal prev/next buttons update the period label", async ({ calendar }) => {
		await calendar.clickToolbar("weekly-stats");
		await expect(calendar.page.locator(".modal").first()).toBeVisible();

		const periodLabel = calendar.page.locator(sel("prisma-stats-modal-period-label")).first();
		await periodLabel.waitFor({ state: "visible" });

		const initialLabel = (await periodLabel.innerText()).trim();

		await calendar.page.locator(sel("prisma-stats-modal-next")).first().click();
		await expect(periodLabel).not.toHaveText(initialLabel);

		// Today button snaps back to the current week.
		await calendar.page.locator(sel("prisma-stats-modal-today")).first().click();
		await expect(periodLabel).toHaveText(initialLabel);

		// Prev moves backwards by the same span.
		await calendar.page.locator(sel("prisma-stats-modal-prev")).first().click();
		await expect(periodLabel).not.toHaveText(initialLabel);

		await closeOpenModal(calendar.page);
	});
});
