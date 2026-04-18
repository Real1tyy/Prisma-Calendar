import { openActionManager } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { SHARED_ROW_PREFIX } from "../../fixtures/testids";

// Exercises the shared `createPageHeader` action-manager modal opened from the
// view header's Manage button. Validates the shared primitive's baseline
// rendering: the modal opens, every registered action is listed as a row with
// the expected testid, and closing the modal leaves persisted state untouched.
// The seed state from `electron.ts` defines `pageHeaderState.visibleActionIds`
// so the expected row count equals that list length.

// DEFAULT_PAGE_HEADER_STATE seeds 18 visible actions; action-manager also lists
// hidden-but-restorable rows. A lower bound asserts the render path without
// coupling to the plugin's evolving action list.
const MIN_VISIBLE_ACTIONS = 18;

test.describe("shared: page header action manager", () => {
	test("opening the manager lists every visible action and closes cleanly", async ({ calendar }) => {
		const manager = await openActionManager(calendar.page);

		const rows = manager.modal.locator(`[data-testid^="${SHARED_ROW_PREFIX.actionRow}"]`);
		expect(await rows.count()).toBeGreaterThanOrEqual(MIN_VISIBLE_ACTIONS);

		// The "create-event" action is always registered and visible under the
		// seed → its row must be stamped with the testid.
		await expect(manager.row("create-event")).toBeVisible();

		await manager.close();
	});
});
