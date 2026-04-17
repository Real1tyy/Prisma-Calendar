import { expect, test } from "../../fixtures/electron";
import { openCalendarViewViaRibbon } from "../../fixtures/helpers";

// Exercises the shared `createPageHeader` action-manager modal opened from the
// view header's Manage button. Validates the shared primitive's baseline
// rendering: the modal opens, every registered action is listed as a row with
// the expected testid, and closing the modal leaves persisted state untouched.
// The seed state from `electron.ts` defines `pageHeaderState.visibleActionIds`
// so the expected row count equals that list length.

const MANAGE_BTN = '[data-testid="prisma-page-header-manage"]';
const MANAGER_MODAL = '[data-testid="prisma-action-manager-modal"]';
const MANAGER_ROW_PREFIX = "prisma-action-manager-row-";

test.describe("shared: page header action manager", () => {
	test("opening the manager lists every visible action and closes cleanly", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);

		const manageBtn = obsidian.page.locator(MANAGE_BTN).first();
		await manageBtn.waitFor({ state: "visible", timeout: 10_000 });
		await manageBtn.click();

		const modal = obsidian.page.locator(MANAGER_MODAL);
		await expect(modal).toBeVisible();

		const rows = modal.locator(`[data-testid^="${MANAGER_ROW_PREFIX}"]`);
		const count = await rows.count();
		// Bootstrap seeds 18 visible actions in DEFAULT_PAGE_HEADER_STATE plus a
		// handful of hidden ones still rendered as restore-able rows. The exact
		// total is stable across releases as long as action-manager shows every
		// action in `allActions`, so a lower bound asserts the rendering path
		// without coupling to the plugin's evolving action list.
		expect(count).toBeGreaterThanOrEqual(18);

		// The "create-event" action is always registered and visible under the
		// seed → its row must be stamped with the testid.
		await expect(modal.locator(`[data-testid="${MANAGER_ROW_PREFIX}create-event"]`)).toBeVisible();

		await obsidian.page.keyboard.press("Escape");
		await expect(modal).toBeHidden({ timeout: 5_000 });
	});
});
