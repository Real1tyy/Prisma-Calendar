import { fromAnchor } from "../../fixtures/dates";
import type { CalendarHandle, EventCreate } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { assignPrerequisiteViaUI, ganttBarLocator } from "../../fixtures/helpers";
import { enterMobileLayout } from "../../fixtures/viewport";

// Gantt is a special case for cross-view assertions: the renderer FILTERS
// events to only those connected in the prerequisite graph
// (`normalize-events.ts`: `tracker.isConnected(filePath)`). A standalone
// event never produces a bar — so the other cross-view specs (which seed
// one event without prerequisites) skip Gantt by design.
//
// This spec covers the Gantt cross-view contract directly: seed two events,
// connect them via the real "Assign prerequisites" UI flow, verify bars
// appear in Gantt, then verify mutations (edit, delete) propagate to Gantt.

async function seedPrerequisiteChainAndOpenGantt(
	calendar: CalendarHandle,
	seeds: readonly EventCreate[],
	link: { downstream: string; upstream: string }
) {
	await calendar.switchMode("month");
	await calendar.goToAnchor();
	const handles = await calendar.seedMany(seeds);
	await assignPrerequisiteViaUI(calendar.page, link.downstream, link.upstream);
	await calendar.unlockPro();
	await calendar.switchView("gantt");
	return handles;
}

async function leaveGanttForMonthAnchor(calendar: CalendarHandle): Promise<void> {
	await calendar.switchView("calendar");
	await calendar.switchMode("month");
	await calendar.goToAnchor();
}

test.describe("cross-view: gantt reactivity", () => {
	test("connected events render as gantt bars and updates propagate", async ({ calendar }) => {
		await seedPrerequisiteChainAndOpenGantt(
			calendar,
			[
				{ title: "Upstream Task", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 10, 0) },
				{ title: "Downstream Task", start: fromAnchor(10, 14, 0), end: fromAnchor(10, 15, 0) },
			],
			{ downstream: "Downstream Task", upstream: "Upstream Task" }
		);

		await expect(ganttBarLocator(calendar.page, "Upstream Task")).toBeVisible();
		await expect(ganttBarLocator(calendar.page, "Downstream Task")).toBeVisible();
	});

	test("connected gantt bars render at a phone viewport", async ({ calendar }) => {
		await seedPrerequisiteChainAndOpenGantt(
			calendar,
			[
				{ title: "Upstream Task", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 10, 0) },
				{ title: "Downstream Task", start: fromAnchor(2, 14, 0), end: fromAnchor(2, 15, 0) },
			],
			{ downstream: "Downstream Task", upstream: "Upstream Task" }
		);

		// The gantt is inherently wide; on a phone it must still render its bars (not
		// a black void) and pan internally rather than collapsing. Connected events
		// are the only ones the gantt draws, so seeing a bar proves it rendered.
		await enterMobileLayout(calendar.page);
		await expect(ganttBarLocator(calendar.page, "Upstream Task")).toBeVisible();
	});

	test("editing a connected event's title updates its gantt bar", async ({ calendar }) => {
		const [upstream] = await seedPrerequisiteChainAndOpenGantt(
			calendar,
			[
				{ title: "Original Upstream", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 10, 0) },
				{ title: "Connected Downstream", start: fromAnchor(10, 14, 0), end: fromAnchor(10, 15, 0) },
			],
			{ downstream: "Connected Downstream", upstream: "Original Upstream" }
		);

		await expect(ganttBarLocator(calendar.page, "Original Upstream")).toBeVisible();

		await leaveGanttForMonthAnchor(calendar);
		await upstream.edit({ title: "Renamed Upstream" });

		await calendar.switchView("gantt");
		await expect(ganttBarLocator(calendar.page, "Renamed Upstream")).toBeVisible();
		await expect(ganttBarLocator(calendar.page, "Original Upstream")).toHaveCount(0);
	});

	test("deleting a connected event removes its gantt bar", async ({ calendar }) => {
		await seedPrerequisiteChainAndOpenGantt(
			calendar,
			[
				{ title: "Keep Bar", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 10, 0) },
				{ title: "Delete Bar", start: fromAnchor(10, 14, 0), end: fromAnchor(10, 15, 0) },
			],
			{ downstream: "Delete Bar", upstream: "Keep Bar" }
		);

		await expect(ganttBarLocator(calendar.page, "Keep Bar")).toBeVisible();
		await expect(ganttBarLocator(calendar.page, "Delete Bar")).toBeVisible();

		await leaveGanttForMonthAnchor(calendar);
		const target = await calendar.eventByTitle("Delete Bar");
		await target.rightClick("deleteEvent");
		// Non-recurring deletes don't gate on the confirmation modal, but the
		// modal can fire when the prerequisite graph reports physical instances —
		// dismiss it if it appears, otherwise just proceed.
		const confirm = calendar.page.locator('[data-testid="confirmation-modal-confirm"]').first();
		if (await confirm.isVisible().catch(() => false)) await confirm.click();
		await target.expectExists(false);

		await calendar.switchView("gantt");
		await expect(ganttBarLocator(calendar.page, "Delete Bar")).toHaveCount(0);
		// Upstream is now an orphan (no downstream depends on it) so it also
		// drops out of Gantt — that's the documented filter behavior.
		await expect(ganttBarLocator(calendar.page, "Keep Bar")).toHaveCount(0);
	});
});
