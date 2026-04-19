import { anchorISO, fromAnchor } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";

// Heatmap (Pro) renders one SVG cell per day of the current period with the
// cell's event count stamped as `data-count`. Seeding three events on the
// anchor day (past-Wednesday, always inside the current heatmap window)
// means the anchor cell must surface a count of 3 — see
// `docs/specs/e2e-date-anchor-robustness.md`.

test.describe("analytics: heatmap (populated)", () => {
	test("seeded events accumulate on the anchor day's cell", async ({ calendar }) => {
		await calendar.seedOnDiskMany([
			{ title: "Morning Standup", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 9, 30) },
			{ title: "Design Review", start: fromAnchor(0, 13, 0), end: fromAnchor(0, 14, 0) },
			{ title: "Workout", start: fromAnchor(0, 18, 0), end: fromAnchor(0, 19, 0) },
		]);

		await calendar.unlockPro();
		await calendar.switchView("heatmap");

		const container = calendar.page.locator(sel("prisma-heatmap-container")).first();
		await expect(container).toBeVisible();

		const anchorCell = container.locator(`${sel("prisma-heatmap-cell")}[data-date="${anchorISO()}"]`).first();
		await expect(anchorCell).toHaveAttribute("data-count", "3");
	});
});
