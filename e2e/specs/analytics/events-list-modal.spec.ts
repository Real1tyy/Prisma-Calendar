import { closeOpenModal } from "../../fixtures/analytics-helpers";
import { todayISO, todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { clickEventListItem, pickSeriesBasesView, switchEventsModalTab } from "../../fixtures/helpers";
import { type SeedEventInput } from "../../fixtures/seed-events";
import { sel } from "../../fixtures/testids";

// The FullCalendar "Events" toolbar button (`prisma-cal-toolbar-show-recurring`)
// opens the EventsModal, which has tabs for Recurring / By Category / By
// Name. Drilling into a non-recurring entry opens the EventSeriesModal,
// whose footer exposes 5 visualisation buttons: Table, List, Cards,
// Timeline, Heatmap — each opens a child modal of its own. These specs
// pin the data flowing through both modals so a regression can't silently
// drop or leak events between groups.

const SERIES_MODAL_SEL = ".modal.prisma-recurring-events-list-modal";
const SERIES_ROW_SEL = ".prisma-recurring-event-row";
const SERIES_TITLE_SEL = ".prisma-recurring-event-title";
const SERIES_STATS_SEL = ".prisma-recurring-events-stats-text";
const EVENTS_MODAL_BODY_SEL = ".prisma-events-modal-content";
const GROUP_COUNT_SEL = `${EVENTS_MODAL_BODY_SEL} .prisma-generic-event-list-count`;
const GROUP_LIST_ITEM_SEL = `${EVENTS_MODAL_BODY_SEL} .prisma-generic-event-list .prisma-generic-event-list-item`;
const GROUP_SUBTITLE_SEL = ".prisma-generic-event-subtitle";

test.describe("analytics: events-list modal + series visualisations", () => {
	test.beforeEach(async ({ calendar }) => {
		// Seed two categories, each with a same-titled pair so both surface in
		// the byName tab — `getNameBasedSeries()` only returns groups with 2+
		// events, so a single Workout would otherwise be filtered out.
		// Use `seedAndStabilize` (vault.create + double-refresh) so the
		// category and name-series trackers are guaranteed to be flushed
		// before the modal opens — `seedMany` returns once the create modal
		// closes but trackers can still be a tick behind, which produced
		// flaky off-by-one counts in the modal.
		const baseZettel = 20260502090000;
		const events: SeedEventInput[] = [
			{
				title: `Team Meeting-${baseZettel}`,
				startDate: todayStamp(9, 0),
				endDate: todayStamp(10, 0),
				category: "Work",
			},
			{
				title: `Team Meeting-${baseZettel + 1}`,
				startDate: todayStamp(11, 0),
				endDate: todayStamp(12, 0),
				category: "Work",
			},
			{
				title: `Workout-${baseZettel + 2}`,
				startDate: todayStamp(7, 0),
				endDate: todayStamp(8, 0),
				category: "Fitness",
			},
			{
				title: `Workout-${baseZettel + 3}`,
				startDate: todayStamp(13, 0),
				endDate: todayStamp(14, 0),
				category: "Fitness",
			},
		];
		await calendar.seedAndStabilize(events);
	});

	test("Events toolbar button opens the modal with three tabs", async ({ calendar }) => {
		await calendar.clickToolbar("show-recurring");
		await calendar.page.locator(".modal").first().waitFor({ state: "visible" });

		// Modal is present, and all three tab buttons are stamped.
		await expect(calendar.page.locator(sel("prisma-events-modal-tab-recurring")).first()).toBeVisible();
		await expect(calendar.page.locator(sel("prisma-events-modal-tab-byCategory")).first()).toBeVisible();
		await expect(calendar.page.locator(sel("prisma-events-modal-tab-byName")).first()).toBeVisible();
	});

	test("By Category tab counts events per category; drilling renders only that category's events", async ({
		calendar,
	}) => {
		await calendar.clickToolbar("show-recurring");
		await calendar.page.locator(".modal").first().waitFor({ state: "visible" });
		await switchEventsModalTab(calendar.page, "byCategory");

		const workItem = calendar.page.locator(sel("prisma-event-list-item-Work")).first();
		const fitnessItem = calendar.page.locator(sel("prisma-event-list-item-Fitness")).first();
		await expect(workItem).toBeVisible();
		await expect(fitnessItem).toBeVisible();

		// Per-group counts: Work has 2 Team Meetings, Fitness has 2 Workouts.
		await expect(workItem.locator(GROUP_SUBTITLE_SEL)).toHaveText("2 events");
		await expect(fitnessItem.locator(GROUP_SUBTITLE_SEL)).toHaveText("2 events");

		// Total visible-category-group count is exactly 2 (no extra leaked categories).
		await expect(calendar.page.locator(GROUP_COUNT_SEL).first()).toHaveText("2 category groups");
		await expect(calendar.page.locator('[data-testid^="prisma-event-list-item-"]')).toHaveCount(2);

		// Drill into "Work" — opens EventSeriesModal on top with exactly the 2 Team Meeting rows.
		await clickEventListItem(calendar.page, "Work");
		const seriesModal = calendar.page.locator(SERIES_MODAL_SEL).first();
		await expect(seriesModal).toBeVisible();

		await expect(seriesModal.locator(SERIES_ROW_SEL)).toHaveCount(2);
		const workTitles = await seriesModal.locator(SERIES_TITLE_SEL).allTextContents();
		expect(workTitles.every((t) => t === "Team Meeting")).toBe(true);
		expect(workTitles).not.toContain("Workout");
		await expect(seriesModal.locator(SERIES_STATS_SEL).first()).toContainText("Total: 2");

		// Single-tab series modal: the source modal opened with `categoryValues=[Work]`,
		// so `tabs.length === 1` and the tab bar is suppressed (event-series-modal-content.tsx
		// renders tabs only when `tabs.length >= 2`). A regression that widened the
		// payload would surface a name/recurring tab here.
		await expect(seriesModal.locator('[data-testid^="prisma-event-series-tab-"]')).toHaveCount(0);

		// Bases footer must expose every visualisation button for this category series.
		for (const viewType of ["table", "list", "cards", "timeline", "heatmap"] as const) {
			await expect(seriesModal.locator(sel(`prisma-event-series-bases-${viewType}`)).first()).toBeVisible();
		}
	});

	test("By Name tab counts name groups; drilling renders only that name's events", async ({ calendar }) => {
		await calendar.clickToolbar("show-recurring");
		await calendar.page.locator(".modal").first().waitFor({ state: "visible" });
		await switchEventsModalTab(calendar.page, "byName");

		// nameKey is lowercased by `NameSeriesTracker.getNameKey` and only the
		// first char is re-uppercased for display, so the byName item titles
		// are "Team meeting" / "Workout" — not the original frontmatter casing.
		const teamItem = calendar.page.locator(sel("prisma-event-list-item-Team meeting")).first();
		const workoutItem = calendar.page.locator(sel("prisma-event-list-item-Workout")).first();
		await expect(teamItem).toBeVisible();
		await expect(workoutItem).toBeVisible();

		await expect(teamItem.locator(GROUP_SUBTITLE_SEL)).toHaveText("2 events");
		await expect(workoutItem.locator(GROUP_SUBTITLE_SEL)).toHaveText("2 events");

		// Exactly two name groups — no third leaked group from missing-title or zettel-id strip bugs.
		await expect(calendar.page.locator(GROUP_COUNT_SEL).first()).toHaveText("2 name groups");
		await expect(calendar.page.locator('[data-testid^="prisma-event-list-item-"]')).toHaveCount(2);

		// Drill into "Team meeting" — series modal lists exactly the 2 Team Meeting events.
		await clickEventListItem(calendar.page, "Team meeting");
		const seriesModal = calendar.page.locator(SERIES_MODAL_SEL).first();
		await expect(seriesModal).toBeVisible();

		await expect(seriesModal.locator(SERIES_ROW_SEL)).toHaveCount(2);
		const titles = await seriesModal.locator(SERIES_TITLE_SEL).allTextContents();
		expect(titles.every((t) => t === "Team Meeting")).toBe(true);
		await expect(seriesModal.locator(SERIES_STATS_SEL).first()).toContainText("Total: 2");

		// Single-tab series modal: drilled in with only `nameKey` set, so no
		// category/recurring tab and the tab bar is suppressed (see source-level
		// `tabs.length >= 2` guard). Pin this so a regression that started passing
		// `categoryValues` here can't silently widen the modal.
		await expect(seriesModal.locator('[data-testid^="prisma-event-series-tab-"]')).toHaveCount(0);

		// Bases footer is wired for the name series too.
		await expect(seriesModal.locator(sel("prisma-event-series-bases-timeline")).first()).toBeVisible();
	});

	test("Bases visualisations receive the right payload (timeline rows, heatmap pro gate)", async ({ calendar }) => {
		await calendar.clickToolbar("show-recurring");
		await calendar.page.locator(".modal").first().waitFor({ state: "visible" });
		await switchEventsModalTab(calendar.page, "byCategory");
		await clickEventListItem(calendar.page, "Work");

		// Baseline modal count — the Events modal + Series modal are open on top of each other.
		const baseline = await calendar.page.locator(".modal").count();

		// Timeline: opens with a header `<h2>` carrying the action's title string
		// from `createCategorySeriesBasesActions` and renders one
		// `.prisma-timeline-item` per event passed in (vis-timeline stamps the
		// className onto the wrapping `.vis-item`). Two Work events → exactly two
		// items; a regression that leaked Workout events would push this to 4.
		await pickSeriesBasesView(calendar.page, "timeline");
		await calendar.page.waitForFunction((prev) => document.querySelectorAll(".modal").length > prev, baseline);
		const timelineContainer = calendar.page.locator(sel("prisma-timeline-container")).first();
		await expect(timelineContainer).toBeVisible();
		await expect(calendar.page.locator(".prisma-timeline-modal-header h2").first()).toHaveText(
			"Timeline for Category - Work"
		);
		await expect(timelineContainer.locator(".prisma-timeline-item")).toHaveCount(2);
		await closeOpenModal(calendar.page);
		await expect(calendar.page.locator(".modal")).toHaveCount(baseline);

		// Heatmap: pro-gated. The unlicensed e2e vault (see pro-gates.spec.ts)
		// gets the upgrade banner instead of the canvas, stamped with
		// `prisma-pro-gate-HEATMAP`. Asserting the banner specifically (not just
		// "any modal opened") proves the gate path is wired through the Bases
		// footer too.
		await pickSeriesBasesView(calendar.page, "heatmap");
		await expect(calendar.page.locator(sel("prisma-pro-gate-HEATMAP")).first()).toBeVisible();
		await closeOpenModal(calendar.page);
		await expect(calendar.page.locator(".modal")).toHaveCount(baseline);
	});
});

// Recurring tab lives in its own describe so the daily-source seed (which
// generates two on-disk instances + populates `recurringEventManager`) doesn't
// contaminate the byCategory/byName precise-count assertions above. Default
// `futureInstancesCount` is 2 — see `CalendarSettingsSchema` in settings.ts.
const DEFAULT_FUTURE_INSTANCES = 2;

test.describe("analytics: events-list modal — Recurring tab", () => {
	test("Recurring tab lists each source event once with its physical instance count", async ({ calendar }) => {
		const todayStr = todayISO();

		const evt = await calendar.createEvent({
			title: "Daily Standup",
			start: `${todayStr}T09:00`,
			end: `${todayStr}T09:30`,
			recurring: { rruleType: "daily" },
		});
		await evt.expectInstanceCount(DEFAULT_FUTURE_INSTANCES);

		await calendar.clickToolbar("show-recurring");
		await calendar.page.locator(".modal").first().waitFor({ state: "visible" });

		// Default tab is whichever has data; recurringCount > 0 → Recurring wins.
		const recurringTab = calendar.page.locator(sel("prisma-events-modal-tab-recurring")).first();
		await expect(recurringTab).toContainText("Recurring (1)");
		await expect(recurringTab).toHaveClass(/is-active/);

		// Count chip and rows are owned by `RecurringEventsModalPanel`. One
		// source → one row, regardless of how many physical instances exist.
		await expect(calendar.page.locator(GROUP_COUNT_SEL).first()).toHaveText("1 event");
		const recurringRows = calendar.page.locator(GROUP_LIST_ITEM_SEL);
		await expect(recurringRows).toHaveCount(1);

		const onlyRow = recurringRows.first();
		await expect(onlyRow.locator(".prisma-generic-event-title")).toHaveText("Daily Standup");
		await expect(onlyRow.locator(".prisma-generic-event-subtitle")).toHaveText(`${DEFAULT_FUTURE_INSTANCES} instances`);
	});
});
