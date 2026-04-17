import { expect, test } from "../../fixtures/electron";
import { createEventViaToolbar, isoLocal } from "../../fixtures/history-helpers";
import { openCalendarReady } from "../events/events-helpers";

// Defensive "nothing got silently unwired" check: right-clicking a normal,
// file-backed event must surface every item a user expects. If a refactor
// accidentally drops an item from the menu, this spec fails before the more
// specific behaviour specs do — making the breakage easier to spot.

const EXPECTED_ITEMS = [
	"enlarge",
	"preview",
	"editEvent",
	"assignCategories",
	"duplicateEvent",
	"moveBy",
	"markDone",
	"moveToNextWeek",
	"cloneToNextWeek",
	"moveToPreviousWeek",
	"cloneToPreviousWeek",
	"deleteEvent",
	"skipEvent",
	"openFile",
	"openFileNewWindow",
] as const;

test.describe("context menu: item coverage (UI-driven)", () => {
	test("every expected item is reachable by right-click on a normal event", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
		await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Menu Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await obsidian.page.locator(".fc-event", { hasText: "Menu Probe" }).first().click({ button: "right" });

		for (const id of EXPECTED_ITEMS) {
			await expect(
				obsidian.page.locator(`[data-testid="prisma-context-menu-item-${id}"]`),
				`context menu missing "${id}" on normal event`
			).toBeVisible();
		}
	});
});
