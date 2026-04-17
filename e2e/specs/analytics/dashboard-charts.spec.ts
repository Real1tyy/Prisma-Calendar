import { todayStamp } from "../../fixtures/analytics-helpers";
import { expect, test } from "../../fixtures/electron";
import { openCalendarViewViaRibbon, seedEvents, switchToGroupChild, unlockPro } from "../../fixtures/helpers";

// Dashboard (Pro) has three children — By Name, By Category, Recurring — each
// rendering a chart/ranking/table grid populated by events in the vault.
// This spec seeds deterministic data via the UI, then walks every child and
// asserts the ranking/table rows contain the expected entries.

test.describe("analytics: dashboard charts (populated)", () => {
	test("every dashboard child surfaces the seeded events grouped by its axis", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);

		// Seed 3× "Weekly Review" (Work) + 2× "Workout" (Fitness) for deterministic
		// per-name and per-category rankings.
		await seedEvents(obsidian.page, [
			{ title: "Weekly Review", start: todayStamp(9, 0), end: todayStamp(10, 0), categories: ["Work"] },
			{ title: "Weekly Review", start: todayStamp(11, 0), end: todayStamp(12, 0), categories: ["Work"] },
			{ title: "Weekly Review", start: todayStamp(14, 0), end: todayStamp(15, 0), categories: ["Work"] },
			{ title: "Workout", start: todayStamp(7, 0), end: todayStamp(8, 0), categories: ["Fitness"] },
			{ title: "Workout", start: todayStamp(18, 0), end: todayStamp(19, 0), categories: ["Fitness"] },
		]);

		await unlockPro(obsidian.page);

		// Dashboard child panels coexist in the DOM once visited — the tabbed
		// container just toggles visibility. Scope every cell selector to the
		// visible one so `.first()` can't pick up a stale sibling panel.
		const visibleRanking = obsidian.page.locator('[data-testid="prisma-dashboard-cell-ranking"]:visible').first();
		const visibleTable = obsidian.page.locator('[data-testid="prisma-dashboard-cell-table"]:visible').first();

		// ─── By Name ───
		await switchToGroupChild(obsidian.page, "dashboard", "dashboard-by-name");

		await expect(obsidian.page.locator('[data-testid="prisma-dashboard-cell-chart"]:visible').first()).toBeVisible({
			timeout: 5_000,
		});
		await expect(visibleRanking).toBeVisible();
		await expect(visibleTable).toBeVisible();

		await expect(visibleRanking.locator('[data-item-title="Weekly review"]')).toBeVisible({ timeout: 15_000 });
		await expect(visibleRanking.locator('[data-item-title="Workout"]')).toBeVisible();
		await expect(visibleTable.locator('[data-item-title="Weekly review"]')).toBeVisible();
		await expect(visibleTable.locator('[data-item-title="Workout"]')).toBeVisible();

		// ─── By Category ───
		await switchToGroupChild(obsidian.page, "dashboard", "dashboard-by-category");

		await expect(visibleRanking.locator('[data-item-title="Work"]')).toBeVisible({ timeout: 15_000 });
		await expect(visibleRanking.locator('[data-item-title="Fitness"]')).toBeVisible();
		await expect(visibleTable.locator('[data-item-title="Work"]')).toBeVisible();
		await expect(visibleTable.locator('[data-item-title="Fitness"]')).toBeVisible();

		// 5 events seeded in `beforeEach` + 1 from `vault-seed/Events/Team Meeting.md`
		// (the fixture event also carries `Category: Work`, so it lands in the
		// byCategory total too).
		await expect(
			obsidian.page.locator('[data-testid="prisma-dashboard-stat-value-Total Events"]:visible').first()
		).toHaveText("6", { timeout: 10_000 });

		// ─── Recurring ───
		// No recurring events seeded, so rankings are empty (empty-state text)
		// but the stats card for "Rules" still renders at zero.
		await switchToGroupChild(obsidian.page, "dashboard", "dashboard-recurring");
		await expect(obsidian.page.locator('[data-testid="prisma-dashboard-cell-chart"]:visible').first()).toBeVisible({
			timeout: 5_000,
		});
		await expect(obsidian.page.locator('[data-testid="prisma-dashboard-stat-value-Rules"]:visible').first()).toHaveText(
			"0",
			{ timeout: 10_000 }
		);
	});
});
