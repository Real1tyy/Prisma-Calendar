import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { sel, TID } from "../../fixtures/testids";

// Each context-menu entry has a stable id stamped as `prisma-context-menu-item-<id>`.
// These specs exercise the high-value single-event actions: edit, duplicate,
// mark-done, skip, delete. Each creates a fresh event so side effects don't
// bleed across tests.

test.describe("analytics: event context menu (full)", () => {
	test("'Edit event' opens the edit modal prefilled with the tile's title", async ({ calendar }) => {
		const evt = await calendar.createEvent({ title: "Edit Target", start: todayStamp(9, 0), end: todayStamp(10, 0) });
		await calendar.waitForNoticesClear();

		await evt.rightClick("editEvent");
		await expect(calendar.page.locator(sel(TID.event.control("title"))).first()).toHaveValue("Edit Target");
		await calendar.page
			.locator(sel(TID.event.btn("cancel")))
			.first()
			.click();
	});

	test("'Duplicate' clones the tile so two tiles with the same title coexist", async ({ calendar }) => {
		const evt = await calendar.createEvent({
			title: "Duplicate Target",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
		});
		await calendar.waitForNoticesClear();

		const tiles = calendar.page.locator(`${sel(TID.block)}[data-event-title="Duplicate Target"]`);
		await expect(tiles).toHaveCount(1);

		await evt.rightClick("duplicateEvent");
		await expect(tiles).toHaveCount(2);
	});

	test("'Delete event' removes the tile from the calendar", async ({ calendar }) => {
		const evt = await calendar.createEvent({
			title: "Delete Target",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
		});
		await calendar.waitForNoticesClear();

		await evt.expectVisible();
		await evt.rightClick("deleteEvent");
		await evt.expectVisible(false);
	});

	test("'Mark as done' flips the menu label to 'Mark as undone' on re-open", async ({ calendar }) => {
		const evt = await calendar.createEvent({
			title: "Done Target",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
		});
		await calendar.waitForNoticesClear();

		await evt.rightClick("markDone");
		await calendar.waitForNoticesClear();

		// Re-open the menu — the `markDone` row now carries the undone title override.
		const block = calendar.page.locator(`${sel(TID.block)}[data-event-title="Done Target"]`).first();
		await block.click({ button: "right" });
		const markDoneItem = calendar.page.locator(sel(TID.ctxMenu("markDone"))).first();
		await expect(markDoneItem).toContainText("undone");
		await calendar.page.keyboard.press("Escape");
	});

	test("'Skip event' hides the tile from the calendar (skipped events are filtered)", async ({ calendar }) => {
		const evt = await calendar.createEvent({
			title: "Skip Target",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
		});
		await calendar.waitForNoticesClear();

		await evt.expectVisible();
		await evt.rightClick("skipEvent");
		// `eventStore.getEvents` returns non-skipped only, so the tile must vanish.
		await evt.expectVisible(false);
	});
});
