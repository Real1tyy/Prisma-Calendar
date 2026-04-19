import { PLUGIN_ID } from "../../fixtures/constants";
import { fromAnchor } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import { expectEventsVisibleByTitle } from "../../fixtures/history-helpers";
import { openCalendarReady } from "../events/events-helpers";

// The undo stack lives only in memory. Its behaviour across a renderer
// reload is a product decision, not a bug. This spec locks in today's
// behaviour (reload clears the undo stack; subsequent undo is a no-op) so a
// future change forces the spec to be updated explicitly.

test.describe("undo boundary: reload (UI-driven)", () => {
	test("undo after renderer reload is a no-op — the created file stays", async ({ calendar }) => {
		await calendar.goToAnchor();
		const event = await calendar.createEvent({
			title: "Reload Probe",
			start: fromAnchor(1, 9),
			end: fromAnchor(1, 10),
		});

		await calendar.page.reload();
		await calendar.page.waitForFunction((pid) => {
			const w = window as unknown as {
				app?: { plugins?: { plugins?: Record<string, { calendarBundles?: unknown[] }> } };
			};
			return Boolean(w.app?.plugins?.plugins?.[pid]?.calendarBundles?.length);
		}, PLUGIN_ID);
		await openCalendarReady(calendar.page);

		await calendar.undo();
		await event.expectExists(true);
		await expectEventsVisibleByTitle(calendar.page, ["Reload Probe"]);

		await calendar.undo();
		await event.expectExists(true);
		await expectEventsVisibleByTitle(calendar.page, ["Reload Probe"]);
	});
});
