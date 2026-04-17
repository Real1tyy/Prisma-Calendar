import { todayStamp } from "../../fixtures/analytics-helpers";
import { expect, test } from "../../fixtures/electron";
import {
	clickContextMenuItem,
	createEventViaUI,
	openCalendarViewViaRibbon,
	rightClickEvent,
	waitForNoticesClear,
} from "../../fixtures/helpers";

// Each context-menu entry has a stable id stamped as `prisma-context-menu-item-<id>`.
// These specs exercise the high-value single-event actions: edit, duplicate,
// mark-done, skip, delete. Each creates a fresh event so side effects don't
// bleed across tests.

const tileSelector = '[data-testid="prisma-cal-event"]';

test.describe("analytics: event context menu (full)", () => {
	test.beforeEach(async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);
	});

	test("'Edit event' opens the edit modal prefilled with the tile's title", async ({ obsidian }) => {
		await createEventViaUI(obsidian.page, {
			title: "Edit Target",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
		});
		await waitForNoticesClear(obsidian.page);

		await rightClickEvent(obsidian.page, { title: "Edit Target" });
		await clickContextMenuItem(obsidian.page, "editEvent");

		await expect(obsidian.page.locator('[data-testid="prisma-event-control-title"]').first()).toHaveValue(
			"Edit Target",
			{ timeout: 5_000 }
		);
		await obsidian.page.locator('[data-testid="prisma-event-btn-cancel"]').first().click();
	});

	test("'Duplicate' clones the tile so two tiles with the same title coexist", async ({ obsidian }) => {
		await createEventViaUI(obsidian.page, {
			title: "Duplicate Target",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
		});
		await waitForNoticesClear(obsidian.page);

		const selector = `${tileSelector}[data-event-title="Duplicate Target"]`;
		await expect(obsidian.page.locator(selector)).toHaveCount(1, { timeout: 5_000 });

		await rightClickEvent(obsidian.page, { title: "Duplicate Target" });
		await clickContextMenuItem(obsidian.page, "duplicateEvent");

		await expect(obsidian.page.locator(selector)).toHaveCount(2, { timeout: 10_000 });
	});

	test("'Delete event' removes the tile from the calendar", async ({ obsidian }) => {
		await createEventViaUI(obsidian.page, {
			title: "Delete Target",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
		});
		await waitForNoticesClear(obsidian.page);

		const selector = `${tileSelector}[data-event-title="Delete Target"]`;
		await expect(obsidian.page.locator(selector)).toHaveCount(1, { timeout: 5_000 });

		await rightClickEvent(obsidian.page, { title: "Delete Target" });
		await clickContextMenuItem(obsidian.page, "deleteEvent");

		await expect(obsidian.page.locator(selector)).toHaveCount(0, { timeout: 10_000 });
	});

	test("'Mark as done' flips the menu label to 'Mark as undone' on re-open", async ({ obsidian }) => {
		await createEventViaUI(obsidian.page, {
			title: "Done Target",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
		});
		await waitForNoticesClear(obsidian.page);

		await rightClickEvent(obsidian.page, { title: "Done Target" });
		await clickContextMenuItem(obsidian.page, "markDone");
		await waitForNoticesClear(obsidian.page);

		// Re-open the menu — the `markDone` row now carries the undone title override.
		await rightClickEvent(obsidian.page, { title: "Done Target" });
		const markDoneItem = obsidian.page.locator('[data-testid="prisma-context-menu-item-markDone"]').first();
		await expect(markDoneItem).toContainText("undone", { timeout: 5_000 });
		await obsidian.page.keyboard.press("Escape");
	});

	test("'Skip event' hides the tile from the calendar (skipped events are filtered)", async ({ obsidian }) => {
		await createEventViaUI(obsidian.page, {
			title: "Skip Target",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
		});
		await waitForNoticesClear(obsidian.page);

		const selector = `${tileSelector}[data-event-title="Skip Target"]`;
		await expect(obsidian.page.locator(selector)).toHaveCount(1, { timeout: 5_000 });

		await rightClickEvent(obsidian.page, { title: "Skip Target" });
		await clickContextMenuItem(obsidian.page, "skipEvent");

		// `eventStore.getEvents` returns non-skipped only, so the tile must vanish.
		await expect(obsidian.page.locator(selector)).toHaveCount(0, { timeout: 10_000 });
	});
});
