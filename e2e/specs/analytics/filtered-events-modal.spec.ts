import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { expectUniqueVisibleEventCount } from "../../fixtures/stress-helpers";
import { FILTER_EXPRESSION_TID, LIST_MODAL_TID, sel } from "../../fixtures/testids";

// The "Show filtered events" command opens a list of every event that is
// CURRENTLY hidden by the active filter (search input or expression). It
// proves the filter→hidden-set pipeline: expression filter mutates the
// view's hidden array, command reads it, modal renders the diff.
// No unit/RTL tier sees the bundle wiring between filter input and command.

test.describe("analytics: Show filtered events modal", () => {
	test("modal lists the events excluded by the active expression filter", async ({ calendar }) => {
		// Three Work + two Personal events. Filter to Work only — Personal pair
		// is the hidden set we expect the modal to surface.
		await calendar.seedOnDiskMany([
			{ title: "Work Alpha", start: todayStamp(9, 0), end: todayStamp(10, 0), category: "Work" },
			{ title: "Work Beta", start: todayStamp(10, 0), end: todayStamp(11, 0), category: "Work" },
			{ title: "Work Gamma", start: todayStamp(11, 0), end: todayStamp(12, 0), category: "Work" },
			{ title: "Personal Delta", start: todayStamp(13, 0), end: todayStamp(14, 0), category: "Personal" },
			{ title: "Personal Epsilon", start: todayStamp(14, 0), end: todayStamp(15, 0), category: "Personal" },
		]);

		const expr = calendar.page.locator(sel(FILTER_EXPRESSION_TID)).first();
		await expr.fill("Category === 'Work'");
		await expr.press("Enter");

		// Calendar now shows 3 Work events.
		await expectUniqueVisibleEventCount(calendar.page, 3);

		await calendar.runCommand("Prisma Calendar: Show filtered events");

		const modal = calendar.page.locator(sel(LIST_MODAL_TID)).first();
		await expect(modal).toBeVisible();

		// Exactly the two Personal events appear in the filtered list.
		await expect(modal.locator(`[data-event-title="Personal Delta"]`)).toHaveCount(1);
		await expect(modal.locator(`[data-event-title="Personal Epsilon"]`)).toHaveCount(1);
		await expect(modal.locator(`[data-event-title="Work Alpha"]`)).toHaveCount(0);
		await expect(modal.locator(`[data-event-title="Work Beta"]`)).toHaveCount(0);
		await expect(modal.locator(`[data-event-title="Work Gamma"]`)).toHaveCount(0);
	});
});
