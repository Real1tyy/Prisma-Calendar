import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import {
	boundingBoxOrThrow,
	dragWithJitter,
	eventBlockLocator,
	expectEventVisible,
	formatLocalDate,
	openCalendarReady,
	seedEventFile,
	switchToWeekView,
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
	test("dragging a timed block onto the untracked button strips its schedule", async ({ obsidian }) => {
		const today = formatLocalDate(new Date());
		const seedPath = seedEventFile(obsidian.vaultDir, "Parked Event", {
			"Start Date": `${today}T09:00`,
			"End Date": `${today}T10:00`,
			"All Day": false,
		});

		await openCalendarReady(obsidian.page);
		await switchToWeekView(obsidian.page);
		await expectEventVisible(obsidian.page, "Parked Event");

		const block = eventBlockLocator(obsidian.page, "Parked Event").first();
		const blockBox = await boundingBoxOrThrow(block, "Parked Event block");

		const untrackedBtn = obsidian.page.locator(UNTRACKED_BUTTON_SELECTOR);
		await untrackedBtn.waitFor({ state: "visible", timeout: 10_000 });
		const btnBox = await boundingBoxOrThrow(untrackedBtn, "untracked-dropdown button");

		// `isDraggingCalendarEvent` only flips true inside FC's dragstart, and
		// the pointerup handler that moves the event to untracked returns early
		// when that flag is false — so the jitter move is load-bearing here.
		await dragWithJitter(
			obsidian.page,
			{ x: blockBox.x + blockBox.width / 2, y: blockBox.y + blockBox.height / 2 },
			{ x: btnBox.x + btnBox.width / 2, y: btnBox.y + btnBox.height / 2 }
		);

		await expect
			.poll(
				() => {
					const fm = readEventFrontmatter(obsidian.vaultDir, seedPath);
					return String(fm["Start Date"] ?? "");
				},
				{ timeout: UNTRACKED_SYNC_TIMEOUT_MS }
			)
			.toBe("");

		const fm = readEventFrontmatter(obsidian.vaultDir, seedPath);
		expect(String(fm["Start Date"] ?? "")).toBe("");
		expect(String(fm["End Date"] ?? "")).toBe("");
		expect(String(fm["Date"] ?? "")).toBe("");

		await expect(eventBlockLocator(obsidian.page, "Parked Event")).toHaveCount(0, { timeout: 15_000 });

		await obsidian.page.locator(UNTRACKED_BUTTON_SELECTOR).click();
		await obsidian.page.locator(UNTRACKED_DROPDOWN_SELECTOR).waitFor({ state: "visible", timeout: 5_000 });
		await expect(obsidian.page.locator(UNTRACKED_ITEM_SELECTOR, { hasText: "Parked Event" })).toHaveCount(1);
	});

	test("dragging an untracked item onto a time slot promotes it to a timed event", async ({ obsidian }) => {
		const today = formatLocalDate(new Date());
		const seedPath = seedEventFile(obsidian.vaultDir, "Unscheduled Task", {
			Location: "Home Office",
		});

		await openCalendarReady(obsidian.page);
		await switchToWeekView(obsidian.page);

		await obsidian.page.locator(UNTRACKED_BUTTON_SELECTOR).click();
		const dropdown = obsidian.page.locator(UNTRACKED_DROPDOWN_SELECTOR);
		await dropdown.waitFor({ state: "visible", timeout: 10_000 });

		const item = obsidian.page.locator(UNTRACKED_ITEM_SELECTOR, { hasText: "Unscheduled Task" }).first();
		await item.waitFor({ state: "visible", timeout: 10_000 });
		const itemBox = await boundingBoxOrThrow(item, "Unscheduled Task dropdown item");

		const timedSlot = obsidian.page.locator('.fc-timegrid-slot-lane[data-time="10:00:00"]').first();
		const timedColumn = obsidian.page.locator(`.fc-timegrid-col[data-date="${today}"]`).first();
		await timedSlot.waitFor({ state: "visible", timeout: 10_000 });
		const slotBox = await boundingBoxOrThrow(timedSlot, "10:00 slot lane");
		const colBox = await boundingBoxOrThrow(timedColumn, "timed column for today");

		await dragWithJitter(
			obsidian.page,
			{ x: itemBox.x + itemBox.width / 2, y: itemBox.y + itemBox.height / 2 },
			{ x: colBox.x + colBox.width / 2, y: slotBox.y + slotBox.height / 2 },
			{ jitterDx: 10 }
		);

		await expect
			.poll(
				() => {
					const fm = readEventFrontmatter(obsidian.vaultDir, seedPath);
					return String(fm["Start Date"] ?? "");
				},
				{ timeout: UNTRACKED_SYNC_TIMEOUT_MS }
			)
			.not.toBe("");

		const fm = readEventFrontmatter(obsidian.vaultDir, seedPath);
		expect(String(fm["Start Date"] ?? "").startsWith(today), "Start Date should be on today").toBe(true);
		expect(String(fm["End Date"] ?? "").startsWith(today), "End Date should be on today").toBe(true);
		expect(String(fm["All Day"] ?? "")).toBe("false");

		await expectEventVisible(obsidian.page, "Unscheduled Task");
	});

	test("dragging an untracked item onto the all-day row promotes it to an all-day event", async ({ obsidian }) => {
		const today = formatLocalDate(new Date());
		const seedPath = seedEventFile(obsidian.vaultDir, "Unscheduled AllDay", {
			Location: "Nowhere",
		});

		await openCalendarReady(obsidian.page);
		await switchToWeekView(obsidian.page);

		await obsidian.page.locator(UNTRACKED_BUTTON_SELECTOR).click();
		await obsidian.page.locator(UNTRACKED_DROPDOWN_SELECTOR).waitFor({ state: "visible", timeout: 10_000 });

		const item = obsidian.page.locator(UNTRACKED_ITEM_SELECTOR, { hasText: "Unscheduled AllDay" }).first();
		const itemBox = await boundingBoxOrThrow(item, "Unscheduled AllDay dropdown item");

		const allDayCell = obsidian.page.locator(`.fc-timegrid .fc-daygrid-body .fc-day[data-date="${today}"]`).first();
		await allDayCell.waitFor({ state: "visible", timeout: 10_000 });
		const cellBox = await boundingBoxOrThrow(allDayCell, "all-day cell for today");

		// The untracked dropdown overlays the calendar header + all-day row,
		// so a straight drag from the dropdown item to the all-day cell drops
		// on the dropdown itself. The dropdown auto-hides after the pointer
		// hovers inside it for DRAG_HOVER_HIDE_DELAY_MS (1.5s) mid-drag, so
		// pause over the item post-jitter long enough to trigger that hide,
		// then continue onto the revealed all-day cell.
		await obsidian.page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
		await obsidian.page.mouse.down();
		await obsidian.page.waitForTimeout(50);
		await obsidian.page.mouse.move(itemBox.x + itemBox.width / 2 + 10, itemBox.y + itemBox.height / 2, {
			steps: 4,
		});
		await obsidian.page.waitForTimeout(1_700);
		await obsidian.page.mouse.move(cellBox.x + cellBox.width / 2, cellBox.y + cellBox.height / 2, { steps: 25 });
		await obsidian.page.waitForTimeout(100);
		await obsidian.page.mouse.up();

		await expect
			.poll(
				() => {
					const fm = readEventFrontmatter(obsidian.vaultDir, seedPath);
					return String(fm["Date"] ?? "");
				},
				{ timeout: UNTRACKED_SYNC_TIMEOUT_MS }
			)
			.toBe(today);

		const fm = readEventFrontmatter(obsidian.vaultDir, seedPath);
		expect(String(fm["All Day"] ?? "")).toBe("true");
		expect(String(fm["Start Date"] ?? "")).toBe("");
		expect(String(fm["End Date"] ?? "")).toBe("");

		await expectEventVisible(obsidian.page, "Unscheduled AllDay");
	});
});
