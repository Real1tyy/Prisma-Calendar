import { expect } from "@playwright/test";

import { fromAnchor } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import { assignPrerequisiteViaUI } from "../../fixtures/helpers";
import { CONNECTION_ARROW_TID, eventTileByTitle, PREREQ_SELECTION_BANNER_CLASS, sel } from "../../fixtures/testids";

// `calendar-connections.spec.ts` proves prerequisite ARROWS render correctly
// when wiring exists. Neither it nor any other spec verifies the wiring
// itself end-to-end: right-click → "Assign prerequisites" → click-to-select
// banner → second click → frontmatter on disk + tracker `isConnected` →
// arrow renders.
//
// This spec covers the assignment flow specifically and checks:
//   1. The sticky banner appears and Notices fire when the selection mode
//      enters and exits.
//   2. Frontmatter writes the correct wiki-link string on the dependant.
//   3. Self-assignment is rejected without mutating disk.
//   4. The tracker's `isConnected` flag flips for both endpoints, which the
//      gantt renderer (and connection renderer) consume.

const PREREQUISITE_PROP = "Prerequisite";

function isEmptyPrereq(v: unknown): boolean {
	if (v === undefined || v === null) return true;
	if (typeof v === "string") return v.trim() === "";
	if (Array.isArray(v)) return v.length === 0 || v.every((entry) => typeof entry === "string" && entry.trim() === "");
	return false;
}

test.describe("events: prerequisites assigned via context menu", () => {
	test("right-click → Assign prerequisites → click an event writes the wiki-link to frontmatter", async ({
		calendar,
	}) => {
		const page = calendar.page;
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		const [upstream, downstream] = await calendar.seedMany([
			{ title: "Prereq Upstream", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 10, 0) },
			{ title: "Prereq Downstream", start: fromAnchor(1, 14, 0), end: fromAnchor(1, 15, 0) },
		]);

		// Wire the prerequisite through the real UI flow.
		await assignPrerequisiteViaUI(page, "Prereq Downstream", "Prereq Upstream");

		// Banner has unmounted by the time the helper returns.
		await expect(page.locator(PREREQ_SELECTION_BANNER_CLASS)).toHaveCount(0);

		// Frontmatter on the dependant carries a wiki-link to the upstream.
		await downstream.expectFrontmatter(PREREQUISITE_PROP, (v) => {
			// addPrerequisite writes a list; parseIntoList returns either string or array.
			const list = Array.isArray(v) ? v : [v];
			return list.some((entry) => typeof entry === "string" && entry.includes("Prereq Upstream"));
		});

		// Upstream's frontmatter is left untouched — the relation lives on the
		// dependant only.
		await upstream.expectFrontmatter(PREREQUISITE_PROP, isEmptyPrereq);
	});

	test("self-assignment is rejected and exits selection mode without mutating frontmatter", async ({ calendar }) => {
		const page = calendar.page;
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		const [solo] = await calendar.seedMany([
			{ title: "Lone Event", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 10, 0) },
		]);

		await solo.rightClick("assignPrerequisites");
		await expect(page.locator(PREREQ_SELECTION_BANNER_CLASS).first()).toBeVisible();

		// Clicking the same event must NOT assign it as its own prerequisite.
		const tile = page.locator(eventTileByTitle("Lone Event")).first();
		await tile.click();

		// Selection mode stays active OR cleanly exits — but no frontmatter mutation.
		await page.waitForTimeout(200);
		await solo.expectFrontmatter(PREREQUISITE_PROP, isEmptyPrereq);

		// Escape the banner via the cancel button if it's still up.
		const cancel = page.locator(`${PREREQ_SELECTION_BANNER_CLASS} button`).first();
		if (await cancel.isVisible().catch(() => false)) await cancel.click();
		await expect(page.locator(PREREQ_SELECTION_BANNER_CLASS)).toHaveCount(0);
	});

	test("after assignment both endpoints report isConnected and the arrow renders when Pro is unlocked", async ({
		calendar,
	}) => {
		const page = calendar.page;
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		await calendar.seedMany([
			{ title: "Connected Upstream", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 10, 0) },
			{ title: "Connected Downstream", start: fromAnchor(1, 14, 0), end: fromAnchor(1, 15, 0) },
		]);

		await assignPrerequisiteViaUI(page, "Connected Downstream", "Connected Upstream");

		// Tracker reports both endpoints as connected — used by the gantt
		// renderer to decide which events get a bar.
		await expect
			.poll(() => calendar.isPrereqConnectedByTitle(["Connected Upstream", "Connected Downstream"]))
			.toEqual({
				"Connected Upstream": true,
				"Connected Downstream": true,
			});

		await calendar.unlockPro();
		await calendar.clickToolbar("toggle-prerequisites");
		await expect(page.locator(sel(CONNECTION_ARROW_TID))).toHaveCount(1);
	});
});
