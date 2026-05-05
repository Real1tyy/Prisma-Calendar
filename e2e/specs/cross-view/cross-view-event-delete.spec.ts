import { todayISO, todayStamp } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";

// Deleting an event must propagate to every view — no stale ghost tiles.
// Seeds via seedMany (UI modal) so all reactive trackers fire.

test.describe("cross-view: event deletion propagates to all views", () => {
	test("deleted event disappears from calendar and timeline", async ({ calendar }) => {
		const [evt] = await calendar.seedMany([
			{ title: "Ephemeral Task", start: todayStamp(10, 0), end: todayStamp(11, 0) },
		]);

		await calendar.switchView("timeline");
		await calendar.expectTimelineItem("Ephemeral Task");

		await calendar.switchView("calendar");

		await evt.rightClick("deleteEvent");

		await evt.expectExists(false);
		await evt.expectVisible(false);

		await calendar.switchView("timeline");
		await calendar.expectTimelineItem("Ephemeral Task", false);
	});

	test("deleted event disappears from heatmap cell count", async ({ calendar }) => {
		await calendar.seedMany([
			{ title: "Keep Event", start: todayStamp(9, 0), end: todayStamp(10, 0) },
			{ title: "Delete Me", start: todayStamp(11, 0), end: todayStamp(12, 0) },
		]);

		await calendar.unlockPro();
		await calendar.switchView("heatmap");
		await calendar.expectHeatmapCount(todayISO(), 2);

		await calendar.switchView("calendar");

		const deleteTarget = await calendar.eventByTitle("Delete Me");
		await deleteTarget.rightClick("deleteEvent");
		await deleteTarget.expectExists(false);

		await calendar.switchView("heatmap");
		await calendar.expectHeatmapCount(todayISO(), 1);
	});
});
