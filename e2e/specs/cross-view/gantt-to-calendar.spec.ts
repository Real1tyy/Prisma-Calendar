import { expect } from "@playwright/test";

import { fromAnchor } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import {
	assignPrerequisiteViaUI,
	ganttBarLocator,
	openCalendarView,
	rightClickGanttBar,
	startsWithStamp,
} from "../../fixtures/helpers";
import { eventTileByTitle, OBSIDIAN_MENU_ROOT, sel } from "../../fixtures/testids";
import { fillEventModal, saveEventModal } from "../events/fill-event-modal";

// `cross-view-gantt.spec.ts` proves calendar → gantt propagation (mutate in
// the calendar tab → bars in gantt update). The reverse direction — a
// mutation originated from the **gantt tab** propagating back to the
// calendar — has no spec. This spec closes that gap: drive a right-click →
// "edit" → modal save entirely from the gantt surface, switch back to the
// calendar week view, and assert the rescheduled bar lands on the new day.
//
// Gantt bars only render for events connected in the prerequisite graph,
// so we seed two events and wire them via `assignPrerequisiteViaUI` before
// switching to gantt. The mutation under test changes the upstream event's
// start time — the test asserts disk frontmatter, calendar week tile, AND
// gantt bar (after returning to the gantt tab) all reflect the new value.

test.describe("cross-view: mutations originating in gantt propagate back to calendar", () => {
	test("editing a gantt bar's date moves the calendar tile and rewrites frontmatter", async ({ calendar }) => {
		const page = calendar.page;
		await calendar.collapseLeftSidebar();

		await calendar.switchMode("month");
		await calendar.goToAnchor();
		const [upstream] = await calendar.seedMany([
			{ title: "Gantt Upstream", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 10, 0) },
			{ title: "Gantt Downstream", start: fromAnchor(2, 14, 0), end: fromAnchor(2, 15, 0) },
		]);
		await assignPrerequisiteViaUI(page, "Gantt Downstream", "Gantt Upstream");

		await calendar.unlockPro();
		await calendar.switchView("gantt");
		// Gantt viewport centers on today; seeded events are at the anchor
		// (last Wednesday) — pan back so the anchor-dated bars sit inside
		// the visible scroll region, otherwise right-click hits an
		// outside-viewport bar and times out.
		await page.locator('.prisma-gantt-nav button[aria-label="Back 1 week"]').click();
		await expect(ganttBarLocator(page, "Gantt Upstream")).toBeVisible();
		await expect(ganttBarLocator(page, "Gantt Downstream")).toBeVisible();

		// Mutate from the gantt tab — right-click → "edit" reuses the same
		// shared event modal that the calendar tile context menu opens.
		await rightClickGanttBar(page, "Gantt Upstream");
		await page.locator(OBSIDIAN_MENU_ROOT).first().waitFor({ state: "visible" });
		await page.locator(sel("prisma-context-menu-item-edit")).first().click();

		const newStart = fromAnchor(1, 11, 0);
		const newEnd = fromAnchor(1, 12, 0);
		await fillEventModal(page, { start: newStart, end: newEnd });
		await saveEventModal(page);

		// Frontmatter on disk reflects the gantt-originated edit. Prisma
		// normalises stored datetimes to `YYYY-MM-DDTHH:mm:ss.SSSZ` so the
		// short input form is matched on its prefix.
		await upstream.expectFrontmatter("Start Date", startsWithStamp(newStart));
		await upstream.expectFrontmatter("End Date", startsWithStamp(newEnd));

		// Calendar week view shows the bar on the new day. Switch through the
		// tabbed-container back to the calendar tab first — `openCalendarView`
		// alone leaves the gantt tab active even after the bundle re-activates.
		await openCalendarView(page);
		await calendar.switchView("calendar");
		await calendar.switchMode("week");
		await calendar.goToAnchor();
		const tile = page.locator(eventTileByTitle("Gantt Upstream")).first();
		await expect(tile).toBeVisible();

		// Gantt bar still renders and now sits on the new date.
		await calendar.switchView("gantt");
		await expect(ganttBarLocator(page, "Gantt Upstream")).toBeVisible();
	});
});
