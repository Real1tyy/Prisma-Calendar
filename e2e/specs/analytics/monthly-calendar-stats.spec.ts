import { anchorDayISO, fromAnchor } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";

const LEFT_CELL = ".prisma-monthly-calendar-stats-grid-cell[data-col='0']";

// Monthly + Stats is the new default tab — a month-locked FullCalendar on the
// left paired with the monthly stats renderer on the right. This spec covers:
//   1. It is the active tab on first paint (no click needed).
//   2. The legacy Heatmap Monthly + Stats tab is hidden from the tab bar by
//      default — users must restore it via the tab manager.
//   3. Seeded events surface in the right-hand stats panel (event count,
//      duration stat) for the anchor month.
//   4. Prev/next/today toolbar buttons on the embedded calendar sync the
//      stats panel's rendered month — proves the `onDateChange` wire.
// The electron fixture fails any test that emits a renderer console.error,
// so the monthly calendar's full refresh path is implicitly exercised too.

test.describe("analytics: monthly + stats (populated)", () => {
	test("seeded anchor-month events surface in the stats panel", async ({ calendar }) => {
		await calendar.seedOnDiskMany([
			{ title: "Morning Standup", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 9, 30) },
			{ title: "Design Review", start: fromAnchor(0, 13, 0), end: fromAnchor(0, 14, 0) },
			{ title: "Workout", start: fromAnchor(0, 18, 0), end: fromAnchor(0, 19, 0) },
		]);

		await calendar.switchView("monthly-calendar-stats");
		await calendar.page.locator(sel("prisma-stats-date-label")).first().waitFor({ state: "visible" });
		await calendar.goToEmbeddedAnchor(LEFT_CELL);

		const statsCell = calendar.page.locator(".prisma-monthly-calendar-stats-grid-cell[data-col='1']").first();
		await expect(calendar.page.locator(sel("prisma-stats-empty"))).toHaveCount(0);
		await expect(statsCell.locator(sel("prisma-stats-total-count"))).toContainText("3 events");
		await expect(statsCell).toContainText("Morning Standup");
		await expect(statsCell).toContainText("Design Review");
		await expect(statsCell).toContainText("Workout");
	});

	test("calendar month navigation syncs the stats panel", async ({ calendar }) => {
		const nextMonthOffsetDays = 30;
		await calendar.seedOnDiskMany([
			{ title: "Anchor Event", start: fromAnchor(0, 10, 0), end: fromAnchor(0, 11, 0) },
			{
				title: "Next Month Event",
				start: fromAnchor(nextMonthOffsetDays, 10, 0),
				end: fromAnchor(nextMonthOffsetDays, 11, 0),
			},
		]);

		await calendar.switchView("monthly-calendar-stats");
		await calendar.goToEmbeddedAnchor(LEFT_CELL);

		const anchorD = new Date(anchorDayISO(0));
		const anchorMonthLabel = anchorD.toLocaleDateString("en-US", { month: "long", year: "numeric" });
		const dateLabel = calendar.page.locator(sel("prisma-stats-date-label")).first();
		const countLabel = calendar.page.locator(sel("prisma-stats-total-count")).first();
		const statsCell = calendar.page.locator(".prisma-monthly-calendar-stats-grid-cell[data-col='1']").first();

		await expect(dateLabel).toHaveText(anchorMonthLabel);
		await expect(countLabel).toHaveText(/1 events/);
		await expect(statsCell).toContainText("Anchor Event");

		const leftCell = calendar.page.locator(LEFT_CELL).first();
		await leftCell.locator(".fc-next-button").click();
		await expect(dateLabel).not.toHaveText(anchorMonthLabel);
		await expect(statsCell).toContainText("Next Month Event");
		await expect(statsCell).not.toContainText("Anchor Event");

		await leftCell.locator(".fc-prev-button").click();
		await expect(dateLabel).toHaveText(anchorMonthLabel);
		await expect(statsCell).toContainText("Anchor Event");
		await expect(statsCell).not.toContainText("Next Month Event");
	});
});
