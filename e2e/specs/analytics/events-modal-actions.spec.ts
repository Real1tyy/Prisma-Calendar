import type { Page } from "@playwright/test";

import { todayISO, todayStamp } from "../../fixtures/dates";
import { expectAssignmentModal, expectSeriesModalOpen } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { updateCalendarSettings, type SeedEventInput } from "../../fixtures/seed-events";
import type { PrismaWindow } from "../../fixtures/window-types";

// Phase-3 coverage from docs/specs/e2e-events-modal-coverage.md.
// Round-trips and link-out behaviour for the EventsModal + EventSeriesModal:
// per-row Category button, per-row Nav button, ctrl-click → new tab, series-
// modal title click, series-row click, multi-category picker, and the
// `--source-category-color` CSS var on the series-modal root.
//
// The "real workspace" assertions read `app.workspace.getActiveFile()?.path`
// directly — opening a file via Obsidian's link API doesn't bubble through
// the calendar grid, so DOM-only assertions miss the path that ships in prod.

const DEFAULT_FUTURE_INSTANCES = 2;

function markdownLeafCount(page: Page): Promise<number> {
	return page.evaluate(() => {
		const w = window as unknown as PrismaWindow;
		return w.app.workspace.getLeavesOfType("markdown").length;
	});
}

test.describe("events modal — recurring row action buttons", () => {
	test("Category button opens the assign modal and persists the chosen categories to frontmatter", async ({
		calendar,
	}) => {
		const today = todayISO();

		const evt = await calendar.createEvent({
			title: "Daily Standup",
			start: `${today}T09:00`,
			end: `${today}T09:30`,
			recurring: { rruleType: "daily" },
		});
		await evt.expectInstanceCount(DEFAULT_FUTURE_INSTANCES);

		const events = await calendar.openEventsModal();
		await events.recurringRow("Daily Standup").clickCategory();

		const assign = await expectAssignmentModal(calendar.page);
		await assign.pick("Work", { createIfMissing: true });
		await assign.submit();

		// Disk-truth: the source frontmatter Category field carries our pick.
		await evt.expectFrontmatter(
			"Category",
			(v) => (Array.isArray(v) ? v.includes("Work") : v === "Work"),
			"expected Category to contain Work after assign-modal submit"
		);
	});

	test("Nav button closes the events modal and switches the calendar into week view", async ({ calendar }) => {
		const today = todayISO();

		const evt = await calendar.createEvent({
			title: "Daily Standup",
			start: `${today}T09:00`,
			end: `${today}T09:30`,
			recurring: { rruleType: "daily" },
		});
		await evt.expectInstanceCount(DEFAULT_FUTURE_INSTANCES);

		// Land on month view first so Nav has somewhere to navigate FROM.
		await calendar.switchMode("month");
		await expect(calendar.page.locator(".fc-daygrid").first()).toBeVisible();

		const events = await calendar.openEventsModal();
		await events.recurringRow("Daily Standup").clickNav();

		// Modal goes away; calendar is now in week view (handleNavigate hard-codes timeGridWeek).
		await expect(events.modal).toHaveCount(0);
		await expect(calendar.page.locator(".fc-timegrid").first()).toBeVisible();
		await evt.expectVisible();
	});

	test("Ctrl/Cmd+click on a recurring row opens the source file in a new workspace leaf", async ({ calendar }) => {
		const today = todayISO();

		const evt = await calendar.createEvent({
			title: "Daily Standup",
			start: `${today}T09:00`,
			end: `${today}T09:30`,
			recurring: { rruleType: "daily" },
		});
		await evt.expectInstanceCount(DEFAULT_FUTURE_INSTANCES);

		const baselineLeafCount = await markdownLeafCount(calendar.page);

		const events = await calendar.openEventsModal();
		await events.recurringRow("Daily Standup").openInNewTab();

		// New workspace leaf opened on top of the modal — the source file is now active.
		await expect.poll(() => calendar.activeFilePath()).toBe(evt.path);
		await expect.poll(() => markdownLeafCount(calendar.page)).toBe(baselineLeafCount + 1);
	});
});

test.describe("event series modal — click-to-open + category-color affordances", () => {
	test("clicking the source-title heading opens the source markdown file (recurring tab)", async ({ calendar }) => {
		const today = todayISO();

		const evt = await calendar.createEvent({
			title: "Daily Standup",
			start: `${today}T09:00`,
			end: `${today}T09:30`,
			recurring: { rruleType: "daily" },
		});
		await evt.expectInstanceCount(DEFAULT_FUTURE_INSTANCES);

		const events = await calendar.openEventsModal();
		const series = await events.recurringRow("Daily Standup").open();

		await series.clickTitle();
		await expect.poll(() => calendar.activeFilePath()).toBe(evt.path);
	});

	test("clicking an instance row opens that physical instance's file", async ({ calendar }) => {
		const today = todayISO();

		const evt = await calendar.createEvent({
			title: "Daily Standup",
			start: `${today}T09:00`,
			end: `${today}T09:30`,
			recurring: { rruleType: "daily" },
		});
		await evt.expectInstanceCount(DEFAULT_FUTURE_INSTANCES);

		const events = await calendar.openEventsModal();
		const series = await events.recurringRow("Daily Standup").open();
		await series.expectRowCount(DEFAULT_FUTURE_INSTANCES);

		// Capture the file path of the first row before clicking — assertion
		// then reads the active file and confirms it matches that exact instance.
		const firstRow = series.row(0).row;
		const targetPath = await firstRow.getAttribute("data-event-file-path");
		expect(targetPath).toBeTruthy();
		expect(targetPath).not.toBe(evt.path); // physical instance, not source

		await series.row(0).click();
		await expect.poll(() => calendar.activeFilePath()).toBe(targetPath);
	});

	test("multi-category event drills into a picker; pick → series → back returns to picker", async ({ calendar }) => {
		const today = todayISO();

		const evt = await calendar.createEvent({
			title: "Cross-team Sync",
			start: `${today}T10:00`,
			end: `${today}T11:00`,
			categories: ["Work", "Urgent"],
		});
		await evt.expectVisible();

		// Right-click → "View category series" — passes both categoryValues, so
		// the modal renders the picker first instead of jumping to one category.
		await evt.rightClick("viewCategorySeries");

		const series = await expectSeriesModalOpen(calendar.page);

		// Picker is the "Select a category" branch — both categories surface as picker rows.
		await series.expectPickerVisible();
		await expect(series.pickerRows()).toHaveCount(2);

		// Drill into "Work" — picker dismisses and the series view appears with the back button.
		await series.pickCategory("Work");
		await series.expectRowCount(1);

		// Back to picker — series rows disappear, picker rows reappear.
		await series.backToCategories();
		await series.expectRowCount(0);
		await expect(series.pickerRows()).toHaveCount(2);

		// Pick the other side — proves the picker → drill is repeatable.
		await series.pickCategory("Urgent");
		await series.expectRowCount(1);
	});

	test("a colored category drills in with `--source-category-color` set on the modal root", async ({ calendar }) => {
		const CATEGORY_COLOR = "#fa00aa";

		// Color rule for Category-includes('Work') with our hex — `categoryTracker.getCategoryColor("Work")`
		// reads this back through `resolveCategoryColor` and the series modal picks it up.
		await updateCalendarSettings(calendar.page, {
			colorRules: [
				{
					id: "rule-work",
					expression: "Category.includes('Work')",
					color: CATEGORY_COLOR,
					enabled: true,
				},
			],
		});

		const events: SeedEventInput[] = [
			{
				title: "Team Meeting",
				startDate: todayStamp(9, 0),
				endDate: todayStamp(10, 0),
				category: "Work",
			},
			{
				title: "Strategy Review",
				startDate: todayStamp(11, 0),
				endDate: todayStamp(12, 0),
				category: "Work",
			},
		];
		await calendar.seedAndStabilize(events);

		const eventsModal = await calendar.openEventsModal();
		await eventsModal.switchTab("byCategory");
		const series = await eventsModal.drillInto("Work");

		await series.expectCategoryColorVar(CATEGORY_COLOR);
	});
});
