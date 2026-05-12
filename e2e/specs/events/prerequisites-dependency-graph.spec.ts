import { expect } from "@playwright/test";

import { fromAnchor } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import { assignPrerequisiteViaUI } from "../../fixtures/helpers";
import { CONFIRMATION_MODAL_CONFIRM_TID, CONNECTION_ARROW_TID, sel } from "../../fixtures/testids";

// The dependency graph (PrerequisiteTracker) drives the gantt renderer
// AND the prerequisite-arrow overlay on the calendar. Existing specs
// only prove arrow rendering and assignment; this spec covers the graph
// cleanup contract:
//
//   1. Deleting a prerequisite event must drop its entry from the
//      tracker's in-memory `dependents` map AND remove dangling refs
//      from the dependent's tracker list. (Frontmatter is intentionally
//      left untouched — see prerequisite-tracker.ts `removeFileFromGraph`.)
//   2. After cleanup, the dependent stops reporting `isConnected` if it
//      had no other prereqs, and the arrow overlay vanishes without a
//      manual page refresh.
//   3. The toggle-prerequisites command idempotently shows/hides arrows
//      across multiple invocations.

test.describe("events: dependency graph cleanup on prereq deletion", () => {
	test("deleting a prerequisite event clears its dependents from the connected set", async ({ calendar }) => {
		const page = calendar.page;
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		await calendar.seedMany([
			{ title: "Graph Upstream", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 10, 0) },
			{ title: "Graph Downstream", start: fromAnchor(1, 14, 0), end: fromAnchor(1, 15, 0) },
		]);

		await assignPrerequisiteViaUI(page, "Graph Downstream", "Graph Upstream");

		// Both endpoints connected post-assignment.
		await expect
			.poll(() => calendar.isPrereqConnectedByTitle(["Graph Upstream", "Graph Downstream"]))
			.toEqual({
				"Graph Upstream": true,
				"Graph Downstream": true,
			});

		// Unlock + show arrows — count must be 1 (one connection).
		await calendar.unlockPro();
		await calendar.clickToolbar("toggle-prerequisites");
		await expect(page.locator(sel(CONNECTION_ARROW_TID))).toHaveCount(1);

		// Delete the upstream event. The tracker's `removeFileFromGraph` walks
		// every dependent and filters out the dangling reference; without that
		// step, `isConnected(Graph Downstream)` would stay `true` (false-positive)
		// even though the underlying event no longer exists.
		const upstream = await calendar.eventByTitle("Graph Upstream");
		await upstream.rightClick("deleteEvent");
		const confirm = page.locator(sel(CONFIRMATION_MODAL_CONFIRM_TID)).first();
		if (await confirm.isVisible().catch(() => false)) await confirm.click();
		await upstream.expectExists(false);

		// Tracker no longer reports either endpoint as connected.
		await expect
			.poll(() => calendar.isPrereqConnectedByTitle(["Graph Upstream", "Graph Downstream"]))
			.toEqual({
				"Graph Upstream": false,
				"Graph Downstream": false,
			});

		// Arrow vanishes — no orphaned overlay after graph cleanup.
		await expect(page.locator(sel(CONNECTION_ARROW_TID))).toHaveCount(0);
	});

	test("toggle-prerequisites is idempotent: show → hide → show across multiple invocations", async ({ calendar }) => {
		const page = calendar.page;
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		await calendar.seedMany([
			{ title: "Toggle Up", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 10, 0) },
			{ title: "Toggle Down", start: fromAnchor(1, 14, 0), end: fromAnchor(1, 15, 0) },
		]);

		await assignPrerequisiteViaUI(page, "Toggle Down", "Toggle Up");

		await calendar.unlockPro();

		// Arrows hidden initially (default state) — assert and then toggle on.
		await expect(page.locator(sel(CONNECTION_ARROW_TID))).toHaveCount(0);
		await calendar.clickToolbar("toggle-prerequisites");
		await expect(page.locator(sel(CONNECTION_ARROW_TID))).toHaveCount(1);

		await calendar.clickToolbar("toggle-prerequisites");
		await expect(page.locator(sel(CONNECTION_ARROW_TID))).toHaveCount(0);

		await calendar.clickToolbar("toggle-prerequisites");
		await expect(page.locator(sel(CONNECTION_ARROW_TID))).toHaveCount(1);
	});
});
