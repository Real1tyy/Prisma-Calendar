import { isoLocal, todayISO, todayStamp } from "../../fixtures/dates";
import { boundingBoxOrThrow, drag } from "../../fixtures/dsl";
import { test } from "../../fixtures/electron";
import { eventBlockLocator } from "../events/events-helpers";

// Drag-reschedule on the calendar must propagate: the timeline bar, heatmap
// cell counts must reflect the new date. Uses todayStamp so the timeline view
// shows items by default. Drags to tomorrow's column.

const tomorrowISO = (): string => isoLocal(1).split("T")[0];

test.describe("cross-view: drag-reschedule propagates to other views", () => {
	test("dragging event to next day updates timeline and heatmap", async ({ calendar }) => {
		const [evt] = await calendar.seedMany([{ title: "Drag Target", start: todayStamp(10, 0), end: todayStamp(11, 0) }]);

		const block = eventBlockLocator(calendar.page, "Drag Target").first();
		const blockBox = await boundingBoxOrThrow(block, "Drag Target block");

		const nextDayCol = calendar.page.locator(`.fc-timegrid-col[data-date="${tomorrowISO()}"]`).first();
		await nextDayCol.waitFor({ state: "visible" });
		const nextDayBox = await boundingBoxOrThrow(nextDayCol, "next day column");

		await drag(
			calendar.page,
			{ x: blockBox.x + blockBox.width / 2, y: blockBox.y + blockBox.height / 2 },
			{ x: nextDayBox.x + nextDayBox.width / 2, y: blockBox.y + blockBox.height / 2 },
			{ mode: "jitter" }
		);

		await evt.expectFrontmatter("Start Date", (v) => String(v ?? "").includes(tomorrowISO()));

		await calendar.switchView("timeline");
		await calendar.expectTimelineItem("Drag Target");

		await calendar.unlockPro();
		await calendar.switchView("heatmap");
		await calendar.expectHeatmapCount(tomorrowISO(), 1);
		await calendar.expectHeatmapCount(todayISO(), 0);
	});
});
