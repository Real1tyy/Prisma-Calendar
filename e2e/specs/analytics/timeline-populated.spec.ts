import { todayStamp } from "../../fixtures/analytics-helpers";
import { expect, test } from "../../fixtures/electron";
import { openCalendarViewViaRibbon, seedEvents, switchView } from "../../fixtures/helpers";

// Timeline tab renders events via vis-timeline. Individual day markers are
// drawn by the library on a continuous axis — there's no per-day DOM element
// to query. Each seeded event does render as a `.prisma-timeline-item` on
// the axis, so we assert on item count once the container is ready.

test.describe("analytics: timeline (populated)", () => {
	test("seeded events render as timeline items inside the container", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);

		await seedEvents(obsidian.page, [
			{ title: "Morning Standup", start: todayStamp(9, 0), end: todayStamp(9, 30) },
			{ title: "Design Review", start: todayStamp(13, 0), end: todayStamp(14, 0) },
			{ title: "Workout", start: todayStamp(18, 0), end: todayStamp(19, 0) },
		]);

		await switchView(obsidian.page, "timeline");

		const container = obsidian.page.locator('[data-testid="prisma-timeline-container"]').first();
		await expect(container).toBeVisible({ timeout: 10_000 });

		// vis-timeline copies our `className` onto each rendered `.vis-item`.
		// At least the three seeded events must be present.
		const items = container.locator(".prisma-timeline-item");
		await expect(items).toHaveCount(3, { timeout: 15_000 });
	});
});
