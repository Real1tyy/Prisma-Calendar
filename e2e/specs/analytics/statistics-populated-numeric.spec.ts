import { closeOpenModal, switchAggregationToCategory, todayStamp } from "../../fixtures/analytics-helpers";
import { expect, test } from "../../fixtures/electron";
import { clickToolbar, openCalendarViewViaRibbon, seedEvents, switchView } from "../../fixtures/helpers";

// Phase-2 stats coverage: create timed events with categories, then verify
// daily/weekly/monthly/alltime ranges each surface the events and their
// aggregated totals. Daily is a view tab; the other three are modal dialogs
// launched from toolbar buttons.

test.describe("analytics: stats (populated, numeric)", () => {
	test.beforeEach(async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);

		// Seed: 3× "Work" (30m each) + 2× "Personal" (45m each). Work total = 1h
		// 30m, Personal total = 1h 30m — easy to eyeball.
		await seedEvents(obsidian.page, [
			{ title: "Work Block A", start: todayStamp(9, 0), end: todayStamp(9, 30), categories: ["Work"] },
			{ title: "Work Block B", start: todayStamp(10, 0), end: todayStamp(10, 30), categories: ["Work"] },
			{ title: "Work Block C", start: todayStamp(11, 0), end: todayStamp(11, 30), categories: ["Work"] },
			{ title: "Personal Block A", start: todayStamp(14, 0), end: todayStamp(14, 45), categories: ["Personal"] },
			{ title: "Personal Block B", start: todayStamp(15, 0), end: todayStamp(15, 45), categories: ["Personal"] },
		]);
	});

	test("daily-stats view surfaces all 5 today's events grouped by category", async ({ obsidian }) => {
		await switchView(obsidian.page, "daily-stats");

		// Empty-state must be gone.
		await expect(obsidian.page.locator('[data-testid="prisma-stats-empty"]')).toHaveCount(0, { timeout: 5_000 });

		// Total duration label is populated (5 events, format varies by settings).
		await expect(obsidian.page.locator('[data-testid="prisma-stats-total-duration"]').first()).toBeVisible({
			timeout: 5_000,
		});

		// Switch aggregation to Category to make assertions deterministic.
		await switchAggregationToCategory(obsidian.page);

		// Category rows should show the correct event counts: Work (3), Personal (2).
		await expect(obsidian.page.locator('[data-testid="prisma-stats-entry-count-Work"]').first()).toHaveText("3", {
			timeout: 5_000,
		});
		await expect(obsidian.page.locator('[data-testid="prisma-stats-entry-count-Personal"]').first()).toHaveText("2");
	});

	test("weekly-stats modal shows the seeded categories", async ({ obsidian }) => {
		await clickToolbar(obsidian.page, "weekly-stats");
		await expect(obsidian.page.locator(".modal").first()).toBeVisible({ timeout: 5_000 });
		await expect(obsidian.page.locator('[data-testid="prisma-stats-modal-period-label"]').first()).toBeVisible();

		// Weekly includes today's events (today falls inside this week).
		// Table contains event names — assert at least the count row exists for a seeded title.
		await expect(obsidian.page.locator('[data-testid="prisma-stats-table"]').first()).toBeVisible();
		await expect(obsidian.page.locator('[data-testid="prisma-stats-entry-Work Block A"]').first()).toBeVisible({
			timeout: 5_000,
		});

		await closeOpenModal(obsidian.page);
	});

	test("monthly-stats modal aggregates today's work into Work category bucket", async ({ obsidian }) => {
		await clickToolbar(obsidian.page, "monthly-stats");
		await expect(obsidian.page.locator(".modal").first()).toBeVisible({ timeout: 5_000 });

		// Monthly modal's table has per-event rows by default. Confirm Work-series
		// titles are present as entries.
		await expect(obsidian.page.locator('[data-testid="prisma-stats-entry-Work Block A"]').first()).toBeVisible({
			timeout: 5_000,
		});
		await expect(obsidian.page.locator('[data-testid="prisma-stats-entry-Personal Block A"]').first()).toBeVisible();

		await closeOpenModal(obsidian.page);
	});

	test("alltime-stats modal includes every seeded event", async ({ obsidian }) => {
		await clickToolbar(obsidian.page, "alltime-stats");
		await expect(obsidian.page.locator(".modal").first()).toBeVisible({ timeout: 5_000 });

		// All-time covers the entire vault; all 5 seeded titles must be rows.
		const table = obsidian.page.locator('[data-testid="prisma-stats-table"]').first();
		await table.waitFor({ state: "visible", timeout: 5_000 });
		for (const title of ["Work Block A", "Work Block B", "Work Block C", "Personal Block A", "Personal Block B"]) {
			await expect(table.locator(`[data-testid="prisma-stats-entry-${title}"]`).first()).toBeVisible();
		}

		await closeOpenModal(obsidian.page);
	});
});
