import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { boundingBoxOrThrow, centerOf, drag } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import {
	eventBlockLocator,
	formatLocalDate,
	UNTRACKED_BUTTON_SELECTOR,
	UNTRACKED_DROPDOWN_SELECTOR,
	UNTRACKED_ITEM_SELECTOR,
} from "./events-helpers";

const UNTRACKED_SYNC_TIMEOUT_MS = 10_000;

// The untracked dropdown is the plugin's "parking lot" for events without a
// date/time. Two drag flows join it with the calendar grid:
//   1. calendar block → dropdown button/panel = strip Start/End/Date/All Day
//   2. dropdown item   → calendar time/all-day slot = write them back
// Both paths must round-trip frontmatter and keep the DOM coherent.

test.describe("drag event ↔ untracked dropdown", () => {
	test("dragging a timed block onto the untracked button strips its schedule", async ({ calendar }) => {
		const today = formatLocalDate(new Date());
		const evt = await calendar.seedOnDisk("Parked Event", {
			"Start Date": `${today}T09:00`,
			"End Date": `${today}T10:00`,
			"All Day": false,
		});

		await calendar.switchMode("week");
		await evt.expectVisible();

		const block = eventBlockLocator(calendar.page, "Parked Event").first();
		const blockBox = await boundingBoxOrThrow(block, "Parked Event block");

		const untrackedBtn = calendar.page.locator(UNTRACKED_BUTTON_SELECTOR);
		await untrackedBtn.waitFor({ state: "visible" });
		const btnBox = await boundingBoxOrThrow(untrackedBtn, "untracked-dropdown button");

		// `isDraggingCalendarEvent` only flips true inside FC's dragstart, and
		// the pointerup handler that moves the event to untracked returns early
		// when that flag is false — so the jitter move is load-bearing here.
		await drag(calendar.page, centerOf(blockBox), centerOf(btnBox), { mode: "jitter" });

		await evt.expectFrontmatter("Start Date", (v) => String(v ?? "") === "");

		const fm = readEventFrontmatter(calendar.vaultDir, evt.path);
		expect(String(fm["Start Date"] ?? "")).toBe("");
		expect(String(fm["End Date"] ?? "")).toBe("");
		expect(String(fm["Date"] ?? "")).toBe("");

		await evt.expectVisible(false);

		await calendar.openUntrackedDropdown();
		await calendar.page.locator(UNTRACKED_DROPDOWN_SELECTOR).waitFor({ state: "visible" });
		await expect(calendar.page.locator(UNTRACKED_ITEM_SELECTOR, { hasText: "Parked Event" })).toHaveCount(1);
	});

	test("dragging an untracked item onto a time slot promotes it to a timed event", async ({ calendar }) => {
		const today = formatLocalDate(new Date());
		const evt = await calendar.seedOnDisk("Unscheduled Task", {
			Location: "Home Office",
		});

		await calendar.switchMode("week");

		await calendar.openUntrackedDropdown();
		const dropdown = calendar.page.locator(UNTRACKED_DROPDOWN_SELECTOR);
		await dropdown.waitFor({ state: "visible" });

		const item = calendar.page.locator(UNTRACKED_ITEM_SELECTOR, { hasText: "Unscheduled Task" }).first();
		await item.waitFor({ state: "visible" });
		const itemBox = await boundingBoxOrThrow(item, "Unscheduled Task dropdown item");

		const timedSlot = calendar.page.locator('.fc-timegrid-slot-lane[data-time="10:00:00"]').first();
		const timedColumn = calendar.page.locator(`.fc-timegrid-col[data-date="${today}"]`).first();
		await timedSlot.waitFor({ state: "visible" });
		const slotBox = await boundingBoxOrThrow(timedSlot, "10:00 slot lane");
		const colBox = await boundingBoxOrThrow(timedColumn, "timed column for today");

		await drag(
			calendar.page,
			centerOf(itemBox),
			{ x: colBox.x + colBox.width / 2, y: slotBox.y + slotBox.height / 2 },
			{ mode: "jitter", jitterDx: 10 }
		);

		await expect
			.poll(() => String(readEventFrontmatter(calendar.vaultDir, evt.path)["Start Date"] ?? ""), {
				timeout: UNTRACKED_SYNC_TIMEOUT_MS,
			})
			.not.toBe("");

		const fm = readEventFrontmatter(calendar.vaultDir, evt.path);
		expect(String(fm["Start Date"] ?? "").startsWith(today), "Start Date should be on today").toBe(true);
		expect(String(fm["End Date"] ?? "").startsWith(today), "End Date should be on today").toBe(true);
		expect(String(fm["All Day"] ?? "")).toBe("false");

		await evt.expectVisible();
	});

	test("dragging an untracked item onto the all-day row promotes it to an all-day event", async ({ calendar }) => {
		const today = formatLocalDate(new Date());
		const evt = await calendar.seedOnDisk("Unscheduled AllDay", {
			Location: "Nowhere",
		});

		await calendar.switchMode("week");

		await calendar.openUntrackedDropdown();
		await calendar.page.locator(UNTRACKED_DROPDOWN_SELECTOR).waitFor({ state: "visible" });

		const item = calendar.page.locator(UNTRACKED_ITEM_SELECTOR, { hasText: "Unscheduled AllDay" }).first();
		const itemBox = await boundingBoxOrThrow(item, "Unscheduled AllDay dropdown item");

		const allDayCell = calendar.page.locator(`.fc-timegrid .fc-daygrid-body .fc-day[data-date="${today}"]`).first();
		await allDayCell.waitFor({ state: "visible" });
		const cellBox = await boundingBoxOrThrow(allDayCell, "all-day cell for today");

		// The untracked dropdown overlays the calendar header + all-day row,
		// so a straight drag from the dropdown item to the all-day cell drops
		// on the dropdown itself. The dropdown auto-hides after the pointer
		// hovers inside it for DRAG_HOVER_HIDE_DELAY_MS (1.5s) mid-drag, so
		// pause over the item post-jitter long enough to trigger that hide,
		// then continue onto the revealed all-day cell.
		await calendar.page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
		await calendar.page.mouse.down();
		await calendar.page.waitForTimeout(50);
		await calendar.page.mouse.move(itemBox.x + itemBox.width / 2 + 10, itemBox.y + itemBox.height / 2, { steps: 4 });
		await calendar.page.waitForTimeout(1_700);
		await calendar.page.mouse.move(cellBox.x + cellBox.width / 2, cellBox.y + cellBox.height / 2, { steps: 25 });
		await calendar.page.waitForTimeout(100);
		await calendar.page.mouse.up();

		await expect
			.poll(() => String(readEventFrontmatter(calendar.vaultDir, evt.path)["Date"] ?? ""), {
				timeout: UNTRACKED_SYNC_TIMEOUT_MS,
			})
			.toBe(today);

		const fm = readEventFrontmatter(calendar.vaultDir, evt.path);
		expect(String(fm["All Day"] ?? "")).toBe("true");
		expect(String(fm["Start Date"] ?? "")).toBe("");
		expect(String(fm["End Date"] ?? "")).toBe("");

		await evt.expectVisible();
	});
});
