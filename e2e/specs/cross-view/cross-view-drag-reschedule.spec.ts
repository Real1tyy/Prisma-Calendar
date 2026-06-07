import { isoLocal, todayISO, todayStamp } from "../../fixtures/dates";
import { boundingBoxOrThrow, drag } from "../../fixtures/dsl";
import { test } from "../../fixtures/electron";
import { eventBlockLocator } from "../events/events-helpers";

// Drag-reschedule on the calendar must propagate: the timeline bar + heatmap cell
// counts must reflect the new date. Stays today-relative (todayStamp) so the
// timeline/heatmap — which default to "today" and have no goToAnchor() — show the
// item without seeding outside their viewport (see dates.ts: anchor helpers are for
// calendar-only specs, not cross-view ones).
//
// Drags to an ADJACENT in-week day rather than always "tomorrow": when today is the
// last column of the visible week (e.g. Saturday under a Sunday-start week) tomorrow
// falls into next week and its column isn't rendered. Preferring tomorrow but falling
// back to yesterday keeps the target inside the rendered week on every day of the
// week, killing the week-boundary flake while preserving the test's intent (move to a
// different day, verify propagation).

const dayISO = (offset: number): string => isoLocal(offset).split("T")[0];

test.describe("cross-view: drag-reschedule propagates to other views", () => {
	test("dragging event to an adjacent day updates timeline and heatmap", async ({ calendar }) => {
		const [evt] = await calendar.seedMany([{ title: "Drag Target", start: todayStamp(10, 0), end: todayStamp(11, 0) }]);

		const block = eventBlockLocator(calendar.page, "Drag Target").first();
		const blockBox = await boundingBoxOrThrow(block, "Drag Target block");

		// Prefer tomorrow; fall back to yesterday when today is the week's last column.
		const dayCol = (iso: string) => calendar.page.locator(`.fc-timegrid-col[data-date="${iso}"]`).first();
		let targetISO = dayISO(1);
		let targetCol = dayCol(targetISO);
		if ((await targetCol.count()) === 0) {
			targetISO = dayISO(-1);
			targetCol = dayCol(targetISO);
		}
		await targetCol.waitFor({ state: "visible" });
		const targetBox = await boundingBoxOrThrow(targetCol, "target day column");

		await drag(
			calendar.page,
			{ x: blockBox.x + blockBox.width / 2, y: blockBox.y + blockBox.height / 2 },
			{ x: targetBox.x + targetBox.width / 2, y: blockBox.y + blockBox.height / 2 },
			{ mode: "jitter" }
		);

		await evt.expectFrontmatter("Start Date", (v) => String(v ?? "").includes(targetISO));

		await calendar.switchView("timeline");
		await calendar.expectTimelineItem("Drag Target");

		await calendar.unlockPro();
		await calendar.switchView("heatmap");
		await calendar.expectHeatmapCount(targetISO, 1);
		await calendar.expectHeatmapCount(todayISO(), 0);
	});
});
