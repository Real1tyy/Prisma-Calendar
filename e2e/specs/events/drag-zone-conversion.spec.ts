import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import {
	boundingBoxOrThrow,
	eventBlockLocator,
	expectEventVisible,
	formatLocalDate,
	openCalendarReady,
	seedEventFile,
	switchToWeekView,
} from "./events-helpers";

// FullCalendar's timeGridWeek splits the visible area into two drop zones: an
// all-day strip at the top and the timed slot column below. Dragging an event
// across that divider should flip its frontmatter between timed (Start Date /
// End Date) and all-day (Date, All Day: true). These canaries lock that in.

const CONVERSION_TIMEOUT_MS = 10_000;

test.describe("drag event → convert between timed and all-day", () => {
	test("dragging a timed block to the all-day row marks it All Day", async ({ obsidian }) => {
		const today = formatLocalDate(new Date());
		const seedPath = seedEventFile(obsidian.vaultDir, "Timed To AllDay", {
			"Start Date": `${today}T09:00`,
			"End Date": `${today}T10:00`,
			"All Day": false,
		});

		await openCalendarReady(obsidian.page);
		await switchToWeekView(obsidian.page);
		await expectEventVisible(obsidian.page, "Timed To AllDay");

		const block = eventBlockLocator(obsidian.page, "Timed To AllDay").first();
		const blockBox = await boundingBoxOrThrow(block, "Timed To AllDay block");

		const allDayCell = obsidian.page.locator(`.fc-timegrid .fc-daygrid-body .fc-day[data-date="${today}"]`).first();
		await allDayCell.waitFor({ state: "visible", timeout: 10_000 });
		const allDayBox = await boundingBoxOrThrow(allDayCell, "all-day cell for today");

		await obsidian.page.mouse.move(blockBox.x + blockBox.width / 2, blockBox.y + blockBox.height / 2);
		await obsidian.page.mouse.down();
		await obsidian.page.mouse.move(allDayBox.x + allDayBox.width / 2, allDayBox.y + allDayBox.height / 2, {
			steps: 15,
		});
		await obsidian.page.mouse.up();

		await expect
			.poll(() => readEventFrontmatter(obsidian.vaultDir, seedPath)["All Day"], { timeout: CONVERSION_TIMEOUT_MS })
			.toBe(true);

		const fm = readEventFrontmatter(obsidian.vaultDir, seedPath);
		expect(fm["Date"], "Date should be populated after drop onto all-day row").toBe(today);
		expect(String(fm["Start Date"] ?? ""), "Start Date should be cleared when flipping to all-day").toBe("");
		expect(String(fm["End Date"] ?? ""), "End Date should be cleared when flipping to all-day").toBe("");
	});

	test("dragging an all-day block to a time slot marks it timed", async ({ obsidian }) => {
		const today = formatLocalDate(new Date());
		const seedPath = seedEventFile(obsidian.vaultDir, "AllDay To Timed", {
			Date: today,
			"All Day": true,
		});

		await openCalendarReady(obsidian.page);
		await switchToWeekView(obsidian.page);
		await expectEventVisible(obsidian.page, "AllDay To Timed");

		const block = eventBlockLocator(obsidian.page, "AllDay To Timed").first();
		const blockBox = await boundingBoxOrThrow(block, "AllDay To Timed block");

		// Pick a time slot inside today's column so the drop lands on a valid
		// hit. Scope to a visible slot by picking `[data-time="10:00:00"]` —
		// FC stamps slot TRs with `data-time`, and morning slots are always
		// scrolled into view by default.
		const slotLane = obsidian.page.locator('.fc-timegrid-slot-lane[data-time="10:00:00"]').first();
		await slotLane.waitFor({ state: "visible", timeout: 10_000 });
		const timedColumn = obsidian.page.locator(`.fc-timegrid-col[data-date="${today}"]`).first();
		const slotBox = await boundingBoxOrThrow(slotLane, "10:00 slot lane");
		const colBox = await boundingBoxOrThrow(timedColumn, "timed column for today");

		const fromX = blockBox.x + blockBox.width / 2;
		const fromY = blockBox.y + blockBox.height / 2;
		const dropX = colBox.x + colBox.width / 2;
		const dropY = slotBox.y + slotBox.height / 2;

		// Two-axis jitter: the all-day→timed conversion needs to cross both the
		// horizontal drag-min-distance AND clear the all-day strip vertically
		// before FC dispatches the drop onto the time grid.
		await obsidian.page.mouse.move(fromX, fromY);
		await obsidian.page.mouse.down();
		await obsidian.page.waitForTimeout(50);
		await obsidian.page.mouse.move(fromX + 10, fromY, { steps: 5 });
		await obsidian.page.mouse.move(fromX, fromY + 20, { steps: 5 });
		await obsidian.page.mouse.move(dropX, dropY, { steps: 30 });
		await obsidian.page.waitForTimeout(100);
		await obsidian.page.mouse.up();

		await expect
			.poll(() => readEventFrontmatter(obsidian.vaultDir, seedPath)["All Day"], { timeout: CONVERSION_TIMEOUT_MS })
			.toBe(false);

		const fm = readEventFrontmatter(obsidian.vaultDir, seedPath);
		expect(String(fm["Start Date"] ?? ""), "Start Date should be populated after drop onto time slot").not.toBe("");
		expect(String(fm["End Date"] ?? ""), "End Date should be populated after drop onto time slot").not.toBe("");
		expect(String(fm["Date"] ?? ""), "Date should be cleared when flipping to timed").toBe("");
	});
});
