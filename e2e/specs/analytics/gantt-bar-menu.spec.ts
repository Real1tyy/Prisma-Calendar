import { todayStamp } from "../../fixtures/analytics-helpers";
import { expect, test } from "../../fixtures/electron";
import {
	assignPrerequisiteViaUI,
	clickContextMenuItem,
	ganttBarLocator,
	openCalendarViewViaRibbon,
	rightClickGanttBar,
	seedEvents,
	switchView,
	unlockPro,
	waitForNoticesClear,
} from "../../fixtures/helpers";

// Gantt filters events to only those `isConnected` in the prerequisite graph.
// The spec seeds two events, wires a prerequisite relationship through the
// calendar context menu (so both nodes become connected), switches to Gantt,
// and then right-clicks a bar to verify the shared createContextMenu renders
// the expected entries stamped with `prisma-context-menu-item-<id>`.

test.describe("analytics: gantt bar context menu", () => {
	test("right-clicking a bar opens a menu whose 'edit' item opens the edit modal", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);

		await seedEvents(obsidian.page, [
			{ title: "Upstream Task", start: todayStamp(9, 0), end: todayStamp(10, 0) },
			{ title: "Downstream Task", start: todayStamp(14, 0), end: todayStamp(15, 0) },
		]);

		await assignPrerequisiteViaUI(obsidian.page, "Downstream Task", "Upstream Task");
		await waitForNoticesClear(obsidian.page);

		await unlockPro(obsidian.page);
		await switchView(obsidian.page, "gantt");

		const upstreamBar = ganttBarLocator(obsidian.page, "Upstream Task");
		await expect(upstreamBar).toBeVisible({ timeout: 10_000 });

		await rightClickGanttBar(obsidian.page, "Upstream Task");

		// Menu anchor — wait for it to be rendered before asserting the items.
		await obsidian.page.locator(".menu").first().waitFor({ state: "visible", timeout: 5_000 });

		// Click the `edit` entry — the gantt bar menu uses the bare `edit` id
		// (not `editEvent`, which is the calendar-tile menu id).
		await clickContextMenuItem(obsidian.page, "edit");

		await expect(obsidian.page.locator('[data-testid="prisma-event-control-title"]').first()).toHaveValue(
			"Upstream Task",
			{ timeout: 5_000 }
		);
		await obsidian.page.locator('[data-testid="prisma-event-btn-cancel"]').first().click();
	});
});
