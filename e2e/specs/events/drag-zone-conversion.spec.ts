import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { anchorISO } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { boundingBoxOrThrow, eventBlockLocator } from "./events-helpers";

// FullCalendar's timeGridWeek splits the visible area into two drop zones: an
// all-day strip at the top and the timed slot column below. Dragging an event
// across that divider should flip its frontmatter between timed (Start Date /
// End Date) and all-day (Date, All Day: true). These canaries lock that in.
//
// Seeded and navigated against `anchorISO()` (past-Wednesday) so the target
// day-column is always inside the rendered week regardless of what day of
// the week the suite runs on — see `docs/specs/e2e-date-anchor-robustness.md`.

const CONVERSION_TIMEOUT_MS = 10_000;

test.describe("drag event → convert between timed and all-day", () => {
	test("dragging a timed block to the all-day row marks it All Day", async ({ calendar }) => {
		const anchor = anchorISO();
		const evt = await calendar.seedOnDisk("Timed To AllDay", {
			"Start Date": `${anchor}T09:00`,
			"End Date": `${anchor}T10:00`,
			"All Day": false,
		});

		await calendar.switchMode("week");
		await calendar.goToAnchor();
		await evt.expectVisible();

		const block = eventBlockLocator(calendar.page, "Timed To AllDay").first();
		const blockBox = await boundingBoxOrThrow(block, "Timed To AllDay block");

		const allDayCell = calendar.page.locator(`.fc-timegrid .fc-daygrid-body .fc-day[data-date="${anchor}"]`).first();
		await allDayCell.waitFor({ state: "visible" });
		const allDayBox = await boundingBoxOrThrow(allDayCell, "all-day cell for anchor day");

		await calendar.page.mouse.move(blockBox.x + blockBox.width / 2, blockBox.y + blockBox.height / 2);
		await calendar.page.mouse.down();
		await calendar.page.mouse.move(allDayBox.x + allDayBox.width / 2, allDayBox.y + allDayBox.height / 2, {
			steps: 15,
		});
		await calendar.page.mouse.up();

		await expect
			.poll(() => readEventFrontmatter(calendar.vaultDir, evt.path)["All Day"], {
				timeout: CONVERSION_TIMEOUT_MS,
			})
			.toBe(true);

		const fm = readEventFrontmatter(calendar.vaultDir, evt.path);
		expect(fm["Date"], "Date should be populated after drop onto all-day row").toBe(anchor);
		expect(String(fm["Start Date"] ?? ""), "Start Date should be cleared when flipping to all-day").toBe("");
		expect(String(fm["End Date"] ?? ""), "End Date should be cleared when flipping to all-day").toBe("");
	});

	test("dragging an all-day block to a time slot marks it timed", async ({ calendar }) => {
		const anchor = anchorISO();
		const evt = await calendar.seedOnDisk("AllDay To Timed", {
			Date: anchor,
			"All Day": true,
		});

		await calendar.switchMode("week");
		await calendar.goToAnchor();
		await evt.expectVisible();

		const block = eventBlockLocator(calendar.page, "AllDay To Timed").first();
		const blockBox = await boundingBoxOrThrow(block, "AllDay To Timed block");

		// Pick a time slot inside the anchor day's column so the drop lands on
		// a valid hit. Scope to a visible slot by picking `[data-time="10:00:00"]`
		// — FC stamps slot TRs with `data-time`, and morning slots are always
		// scrolled into view by default.
		const slotLane = calendar.page.locator('.fc-timegrid-slot-lane[data-time="10:00:00"]').first();
		await slotLane.waitFor({ state: "visible" });
		const timedColumn = calendar.page.locator(`.fc-timegrid-col[data-date="${anchor}"]`).first();
		const slotBox = await boundingBoxOrThrow(slotLane, "10:00 slot lane");
		const colBox = await boundingBoxOrThrow(timedColumn, "timed column for anchor day");

		const fromX = blockBox.x + blockBox.width / 2;
		const fromY = blockBox.y + blockBox.height / 2;
		const dropX = colBox.x + colBox.width / 2;
		const dropY = slotBox.y + slotBox.height / 2;

		// Two-axis jitter: the all-day→timed conversion needs to cross both the
		// horizontal drag-min-distance AND clear the all-day strip vertically
		// before FC dispatches the drop onto the time grid.
		await calendar.page.mouse.move(fromX, fromY);
		await calendar.page.mouse.down();
		await calendar.page.waitForTimeout(50);
		await calendar.page.mouse.move(fromX + 10, fromY, { steps: 5 });
		await calendar.page.mouse.move(fromX, fromY + 20, { steps: 5 });
		await calendar.page.mouse.move(dropX, dropY, { steps: 30 });
		await calendar.page.waitForTimeout(100);
		await calendar.page.mouse.up();

		await expect
			.poll(() => readEventFrontmatter(calendar.vaultDir, evt.path)["All Day"], {
				timeout: CONVERSION_TIMEOUT_MS,
			})
			.toBe(false);

		const fm = readEventFrontmatter(calendar.vaultDir, evt.path);
		expect(String(fm["Start Date"] ?? ""), "Start Date should be populated after drop onto time slot").not.toBe("");
		expect(String(fm["End Date"] ?? ""), "End Date should be populated after drop onto time slot").not.toBe("");
		expect(String(fm["Date"] ?? ""), "Date should be cleared when flipping to timed").toBe("");
	});
});
