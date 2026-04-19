import { fromAnchor } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { type ContextMenuItemKey, sel, TID } from "../../fixtures/testids";

// Defensive "nothing got silently unwired" check: right-clicking a normal,
// file-backed event must surface every item a user expects. If a refactor
// accidentally drops an item from the menu, this spec fails before the more
// specific behaviour specs do — making the breakage easier to spot.

const EXPECTED_ITEMS: readonly ContextMenuItemKey[] = [
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
];

test.describe("context menu: item coverage (UI-driven)", () => {
	test("every expected item is reachable by right-click on a normal event", async ({ calendar }) => {
		await calendar.goToAnchor();
		await calendar.createEvent({
			title: "Menu Probe",
			start: fromAnchor(1, 9),
			end: fromAnchor(1, 10),
		});

		await calendar.page.locator(".fc-event", { hasText: "Menu Probe" }).first().click({ button: "right" });

		for (const id of EXPECTED_ITEMS) {
			await expect(
				calendar.page.locator(sel(TID.ctxMenu(id))),
				`context menu missing "${id}" on normal event`
			).toBeVisible();
		}
	});
});
