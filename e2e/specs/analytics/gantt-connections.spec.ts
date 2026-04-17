import { isoLocal } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import {
	assignPrerequisiteViaUI,
	ganttBarLocator,
	openCalendarViewViaRibbon,
	seedEvents,
	switchCalendarViewMode,
	switchView,
	unlockPro,
	waitForNoticesClear,
} from "../../fixtures/helpers";

// Prerequisite connections in the Gantt chart are rendered as SVG arrows
// between bars. The renderer stamps each arrow with `prisma-gantt-arrow`
// plus `data-arrow-from` / `data-arrow-to` carrying the sanitised task ids.
//
// This spec proves the arrow pipeline works across time intervals: the
// upstream event is ~10 days from today, the downstream event is today,
// so both bars span across calendar weeks. Month view is used when wiring
// the prerequisite so both tiles are clickable at the same time.

test.describe("analytics: gantt prerequisite connections", () => {
	test("arrow renders between two events that span different weeks", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);
		await switchCalendarViewMode(obsidian.page, "month");

		await seedEvents(obsidian.page, [
			{ title: "Upstream Task", start: isoLocal(0, 9, 0), end: isoLocal(0, 10, 0) },
			{ title: "Downstream Task", start: isoLocal(10, 14, 0), end: isoLocal(10, 15, 0) },
		]);

		// Assign the earlier event as a prerequisite of the later one. Both tiles
		// must be visible in the calendar at once — month view covers the span.
		await assignPrerequisiteViaUI(obsidian.page, "Downstream Task", "Upstream Task");
		await waitForNoticesClear(obsidian.page);

		await unlockPro(obsidian.page);
		await switchView(obsidian.page, "gantt");

		// Both bars must be rendered once the graph has a connection.
		await expect(ganttBarLocator(obsidian.page, "Upstream Task")).toBeVisible({ timeout: 10_000 });
		await expect(ganttBarLocator(obsidian.page, "Downstream Task")).toBeVisible();

		// Exactly one prerequisite arrow was assigned, so exactly one arrow
		// element should be in the DOM — no phantom arrows, no dropped ones.
		const arrows = obsidian.page.locator('[data-testid="prisma-gantt-arrow"]');
		await expect(arrows).toHaveCount(1, { timeout: 10_000 });
	});
});
