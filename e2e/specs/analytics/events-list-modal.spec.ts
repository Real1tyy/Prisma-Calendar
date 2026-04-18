import { closeOpenModal } from "../../fixtures/analytics-helpers";
import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { clickEventListItem, pickSeriesBasesView, switchEventsModalTab } from "../../fixtures/helpers";
import { sel } from "../../fixtures/testids";

// The FullCalendar "Events" toolbar button (`prisma-cal-toolbar-events`)
// opens the EventsModal, which has tabs for Recurring / By Category / By
// Name. Drilling into a non-recurring entry opens the EventSeriesModal,
// whose footer exposes 5 visualisation buttons: Table, List, Cards,
// Timeline, Heatmap — each opens a child modal of its own.

test.describe("analytics: events-list modal + series visualisations", () => {
	test.beforeEach(async ({ calendar }) => {
		// Seed two categories, two distinct event-name series.
		await calendar.seedMany([
			{ title: "Team Meeting", start: todayStamp(9, 0), end: todayStamp(10, 0), categories: ["Work"] },
			{ title: "Team Meeting", start: todayStamp(11, 0), end: todayStamp(12, 0), categories: ["Work"] },
			{ title: "Workout", start: todayStamp(7, 0), end: todayStamp(8, 0), categories: ["Fitness"] },
		]);
	});

	test("Events toolbar button opens the modal with three tabs", async ({ calendar }) => {
		await calendar.clickToolbar("show-recurring");
		await calendar.page.locator(".modal").first().waitFor({ state: "visible" });

		// Modal is present, and all three tab buttons are stamped.
		await expect(calendar.page.locator(sel("prisma-events-modal-tab-recurring")).first()).toBeVisible();
		await expect(calendar.page.locator(sel("prisma-events-modal-tab-byCategory")).first()).toBeVisible();
		await expect(calendar.page.locator(sel("prisma-events-modal-tab-byName")).first()).toBeVisible();
	});

	test("By Category tab lists seeded categories; drilling into one opens the series modal", async ({ calendar }) => {
		await calendar.clickToolbar("show-recurring");
		await calendar.page.locator(".modal").first().waitFor({ state: "visible" });
		await switchEventsModalTab(calendar.page, "byCategory");

		// Both seeded categories must appear as list items.
		await expect(calendar.page.locator(sel("prisma-event-list-item-Work")).first()).toBeVisible();
		await expect(calendar.page.locator(sel("prisma-event-list-item-Fitness")).first()).toBeVisible();

		// Drill into "Work" — opens EventSeriesModal on top.
		await clickEventListItem(calendar.page, "Work");

		// Series modal exposes the five Bases buttons.
		for (const viewType of ["table", "list", "cards", "timeline", "heatmap"] as const) {
			await expect(calendar.page.locator(sel(`prisma-event-series-bases-${viewType}`)).first()).toBeVisible();
		}
	});

	test("each Bases visualisation opens a follow-up modal", async ({ calendar }) => {
		await calendar.clickToolbar("show-recurring");
		await calendar.page.locator(".modal").first().waitFor({ state: "visible" });
		await switchEventsModalTab(calendar.page, "byCategory");
		await clickEventListItem(calendar.page, "Work");

		// Baseline modal count — the Events modal + Series modal are open on top of each other.
		const baseline = await calendar.page.locator(".modal").count();

		// "Timeline" opens a timeline modal; count should increase, then close.
		await pickSeriesBasesView(calendar.page, "timeline");
		await calendar.page.waitForFunction((prev) => document.querySelectorAll(".modal").length > prev, baseline);
		await closeOpenModal(calendar.page);
		await expect(calendar.page.locator(".modal")).toHaveCount(baseline);

		// "Heatmap" same: opens, then closes.
		await pickSeriesBasesView(calendar.page, "heatmap");
		await calendar.page.waitForFunction((prev) => document.querySelectorAll(".modal").length > prev, baseline);
		await closeOpenModal(calendar.page);
		await expect(calendar.page.locator(".modal")).toHaveCount(baseline);
	});
});
