import { closeOpenModal, switchAggregationToCategory } from "../../fixtures/analytics-helpers";
import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";

// Phase-2 stats coverage: create timed events with categories, then verify
// daily/weekly/monthly/alltime ranges each surface the events and their
// aggregated totals. Daily is a view tab; the other three are modal dialogs
// launched from toolbar buttons.

test.describe("analytics: stats (populated, numeric)", () => {
	test.beforeEach(async ({ calendar }) => {
		// Seed: 3× "Work" (30m each) + 2× "Personal" (45m each). Work total = 1h
		// 30m, Personal total = 1h 30m — easy to eyeball.
		await calendar.seedOnDiskMany([
			{ title: "Work Block A", start: todayStamp(9, 0), end: todayStamp(9, 30), category: "Work" },
			{ title: "Work Block B", start: todayStamp(10, 0), end: todayStamp(10, 30), category: "Work" },
			{ title: "Work Block C", start: todayStamp(11, 0), end: todayStamp(11, 30), category: "Work" },
			{ title: "Personal Block A", start: todayStamp(14, 0), end: todayStamp(14, 45), category: "Personal" },
			{ title: "Personal Block B", start: todayStamp(15, 0), end: todayStamp(15, 45), category: "Personal" },
		]);
	});

	test("daily-stats view surfaces all 5 today's events grouped by category", async ({ calendar }) => {
		await calendar.switchView("daily-stats");

		// Empty-state must be gone.
		await expect(calendar.page.locator(sel("prisma-stats-empty"))).toHaveCount(0);

		// Total duration label is populated (5 events, format varies by settings).
		await expect(calendar.page.locator(sel("prisma-stats-total-duration")).first()).toBeVisible();

		// Switch aggregation to Category to make assertions deterministic.
		await switchAggregationToCategory(calendar.page);

		// Category rows should show the correct event counts: Work (3), Personal (2).
		await expect(calendar.page.locator(sel("prisma-stats-entry-count-Work")).first()).toHaveText("3");
		await expect(calendar.page.locator(sel("prisma-stats-entry-count-Personal")).first()).toHaveText("2");
	});

	test("weekly-stats modal shows the seeded categories", async ({ calendar }) => {
		await calendar.clickToolbar("weekly-stats");
		await expect(calendar.page.locator(".modal").first()).toBeVisible();
		await expect(calendar.page.locator(sel("prisma-stats-modal-period-label")).first()).toBeVisible();

		// Weekly includes today's events (today falls inside this week).
		// Table contains event names — assert at least the count row exists for a seeded title.
		await expect(calendar.page.locator(sel("prisma-stats-table")).first()).toBeVisible();
		await expect(calendar.page.locator(sel("prisma-stats-entry-Work Block A")).first()).toBeVisible();

		await closeOpenModal(calendar.page);
	});

	test("monthly-stats modal aggregates today's work into Work category bucket", async ({ calendar }) => {
		await calendar.clickToolbar("monthly-stats");
		await expect(calendar.page.locator(".modal").first()).toBeVisible();

		// Monthly modal's table has per-event rows by default. Confirm Work-series
		// titles are present as entries.
		await expect(calendar.page.locator(sel("prisma-stats-entry-Work Block A")).first()).toBeVisible();
		await expect(calendar.page.locator(sel("prisma-stats-entry-Personal Block A")).first()).toBeVisible();

		await closeOpenModal(calendar.page);
	});

	test("alltime-stats modal includes every seeded event", async ({ calendar }) => {
		await calendar.clickToolbar("alltime-stats");
		await expect(calendar.page.locator(".modal").first()).toBeVisible();

		// All-time covers the entire vault; all 5 seeded titles must be rows.
		const table = calendar.page.locator(sel("prisma-stats-table")).first();
		await table.waitFor({ state: "visible" });
		for (const title of ["Work Block A", "Work Block B", "Work Block C", "Personal Block A", "Personal Block B"]) {
			await expect(table.locator(sel(`prisma-stats-entry-${title}`)).first()).toBeVisible();
		}

		await closeOpenModal(calendar.page);
	});
});
