import { closeOpenModal, todayStamp } from "../../fixtures/analytics-helpers";
import { expect, test } from "../../fixtures/electron";
import {
	clickEventListItem,
	openCalendarViewViaRibbon,
	openEventsModal,
	pickSeriesBasesView,
	seedEvents,
	switchEventsModalTab,
} from "../../fixtures/helpers";

// The FullCalendar "Events" toolbar button (`prisma-cal-toolbar-events`)
// opens the EventsModal, which has tabs for Recurring / By Category / By
// Name. Drilling into a non-recurring entry opens the EventSeriesModal,
// whose footer exposes 5 visualisation buttons: Table, List, Cards,
// Timeline, Heatmap — each opens a child modal of its own.

test.describe("analytics: events-list modal + series visualisations", () => {
	test.beforeEach(async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);

		// Seed two categories, two distinct event-name series.
		await seedEvents(obsidian.page, [
			{ title: "Team Meeting", start: todayStamp(9, 0), end: todayStamp(10, 0), categories: ["Work"] },
			{ title: "Team Meeting", start: todayStamp(11, 0), end: todayStamp(12, 0), categories: ["Work"] },
			{ title: "Workout", start: todayStamp(7, 0), end: todayStamp(8, 0), categories: ["Fitness"] },
		]);
	});

	test("Events toolbar button opens the modal with three tabs", async ({ obsidian }) => {
		await openEventsModal(obsidian.page);

		// Modal is present, and all three tab buttons are stamped.
		await expect(obsidian.page.locator('[data-testid="prisma-events-modal-tab-recurring"]').first()).toBeVisible({
			timeout: 5_000,
		});
		await expect(obsidian.page.locator('[data-testid="prisma-events-modal-tab-byCategory"]').first()).toBeVisible();
		await expect(obsidian.page.locator('[data-testid="prisma-events-modal-tab-byName"]').first()).toBeVisible();
	});

	test("By Category tab lists seeded categories; drilling into one opens the series modal", async ({ obsidian }) => {
		await openEventsModal(obsidian.page);
		await switchEventsModalTab(obsidian.page, "byCategory");

		// Both seeded categories must appear as list items.
		await expect(obsidian.page.locator('[data-testid="prisma-event-list-item-Work"]').first()).toBeVisible({
			timeout: 5_000,
		});
		await expect(obsidian.page.locator('[data-testid="prisma-event-list-item-Fitness"]').first()).toBeVisible();

		// Drill into "Work" — opens EventSeriesModal on top.
		await clickEventListItem(obsidian.page, "Work");

		// Series modal exposes the five Bases buttons.
		for (const viewType of ["table", "list", "cards", "timeline", "heatmap"] as const) {
			await expect(obsidian.page.locator(`[data-testid="prisma-event-series-bases-${viewType}"]`).first()).toBeVisible({
				timeout: 5_000,
			});
		}
	});

	test("each Bases visualisation opens a follow-up modal", async ({ obsidian }) => {
		await openEventsModal(obsidian.page);
		await switchEventsModalTab(obsidian.page, "byCategory");
		await clickEventListItem(obsidian.page, "Work");

		// Baseline modal count — the Events modal + Series modal are open on top of each other.
		const baseline = await obsidian.page.locator(".modal").count();

		// "Timeline" opens a timeline modal; count should increase, then close.
		await pickSeriesBasesView(obsidian.page, "timeline");
		await obsidian.page.waitForFunction((prev) => document.querySelectorAll(".modal").length > prev, baseline, {
			timeout: 5_000,
		});
		await closeOpenModal(obsidian.page);
		await expect(obsidian.page.locator(".modal")).toHaveCount(baseline, { timeout: 5_000 });

		// "Heatmap" same: opens, then closes.
		await pickSeriesBasesView(obsidian.page, "heatmap");
		await obsidian.page.waitForFunction((prev) => document.querySelectorAll(".modal").length > prev, baseline, {
			timeout: 5_000,
		});
		await closeOpenModal(obsidian.page);
		await expect(obsidian.page.locator(".modal")).toHaveCount(baseline, { timeout: 5_000 });
	});
});
