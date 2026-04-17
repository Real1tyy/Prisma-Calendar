import { isoLocal } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import {
	assignPrerequisiteViaUI,
	clickToolbar,
	openCalendarViewViaRibbon,
	seedEvents,
	switchCalendarViewMode,
	unlockPro,
	waitForNoticesClear,
} from "../../fixtures/helpers";

// Prerequisite connections are a Pro feature. The calendar view draws SVG
// arrows between dependent/prerequisite events via `ConnectionRenderer`:
// full cubic arrows when both sides are in-frame, dashed stubs when one
// side is off-screen. This spec proves both flows end-to-end: same-week
// (full arrow) and cross-week (stub arrow, because the prereq lives in a
// different week than the dependant).

const ARROW_SELECTOR = '[data-testid="prisma-connection-arrow"]';
const STUB_SELECTOR = '[data-testid="prisma-connection-arrow"][data-arrow-stub="true"]';

test.describe("analytics: prerequisite connections on calendar view", () => {
	test("full arrow renders when both events sit in the same week", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);
		await switchCalendarViewMode(obsidian.page, "week");

		await seedEvents(obsidian.page, [
			{ title: "Upstream Task", start: isoLocal(0, 9, 0), end: isoLocal(0, 10, 0) },
			{ title: "Downstream Task", start: isoLocal(1, 14, 0), end: isoLocal(1, 15, 0) },
		]);

		await assignPrerequisiteViaUI(obsidian.page, "Downstream Task", "Upstream Task");
		await waitForNoticesClear(obsidian.page);

		await unlockPro(obsidian.page);
		await clickToolbar(obsidian.page, "toggle-prerequisites");

		const arrows = obsidian.page.locator(ARROW_SELECTOR);
		await expect(arrows).toHaveCount(1, { timeout: 10_000 });
		await expect(obsidian.page.locator(STUB_SELECTOR)).toHaveCount(0);
	});

	test("stub arrow renders when prerequisite lives in a different week", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);

		// Month view first so both tiles are clickable while wiring the prereq.
		await switchCalendarViewMode(obsidian.page, "month");
		await seedEvents(obsidian.page, [
			{ title: "Upstream Task", start: isoLocal(0, 9, 0), end: isoLocal(0, 10, 0) },
			{ title: "Downstream Task", start: isoLocal(10, 14, 0), end: isoLocal(10, 15, 0) },
		]);

		await assignPrerequisiteViaUI(obsidian.page, "Downstream Task", "Upstream Task");
		await waitForNoticesClear(obsidian.page);

		// Back to week view — with 10 days between the two events, at most one
		// is visible at a time, so the renderer must draw a dashed stub.
		await switchCalendarViewMode(obsidian.page, "week");
		await unlockPro(obsidian.page);
		await clickToolbar(obsidian.page, "toggle-prerequisites");

		const stubs = obsidian.page.locator(STUB_SELECTOR);
		await expect(stubs).toHaveCount(1, { timeout: 10_000 });
	});
});
