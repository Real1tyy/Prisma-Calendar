import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";

// Timeline tab renders events via vis-timeline. Individual day markers are
// drawn by the library on a continuous axis — there's no per-day DOM element
// to query. Each seeded event does render as a `.prisma-timeline-item` on
// the axis, so we assert on item count once the container is ready.

test.describe("analytics: timeline (populated)", () => {
	test("seeded events render as timeline items inside the container", async ({ calendar }) => {
		await calendar.seedMany([
			{ title: "Morning Standup", start: todayStamp(9, 0), end: todayStamp(9, 30) },
			{ title: "Design Review", start: todayStamp(13, 0), end: todayStamp(14, 0) },
			{ title: "Workout", start: todayStamp(18, 0), end: todayStamp(19, 0) },
		]);

		await calendar.switchView("timeline");

		const container = calendar.page.locator(sel("prisma-timeline-container")).first();
		await expect(container).toBeVisible();

		// vis-timeline copies our `className` onto each rendered `.vis-item`.
		// At least the three seeded events must be present.
		const items = container.locator(".prisma-timeline-item");
		await expect(items).toHaveCount(3);
	});
});
