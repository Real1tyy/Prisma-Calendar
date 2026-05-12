import { expect } from "@playwright/test";

import { fromAnchor } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import { expectNoticeText } from "../../fixtures/helpers";
import { eventTileByTitle, PREREQ_SELECTION_BANNER_CLASS, sel, TID } from "../../fixtures/testids";

// User-facing error copy is invisible to the rest of the suite — no spec
// reads `.notice-container` text outside of two narrow paths
// (data-integrity slashed-title, move-by-modal all-day). Notice strings
// are part of the product contract: a silent change to "Event title
// cannot contain" → "Title not allowed" would slip past every existing
// assertion. This spec pins the exact wording across three distinct
// error paths that are reproducible through real UI:
//
//   1. Batch toggle in list view — wording: "Batch selection is not
//      available in list view"
//   2. Self-prerequisite click — wording: "Cannot assign an event as its
//      own prerequisite"
//   3. Empty-selection batch delete — wording: "No events selected"

test.describe("shared: Notice toast wording across user-facing error paths", () => {
	test("batch selection in list view surfaces the disallowed-view notice", async ({ calendar }) => {
		const page = calendar.page;
		await calendar.seedMany([{ title: "Notice List Probe", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 10, 0) }]);
		await calendar.goToAnchor();

		// Switching to list mode is a precondition — the batch manager checks
		// `currentView.includes("list")` and rejects with a Notice. Use the
		// FullCalendar toolbar button (`prisma-cal-toolbar-batch-select`) since
		// the page-header toggle is the same command but lives in the secondary
		// toolbar.
		await calendar.switchMode("list");
		await page
			.locator(sel(TID.toolbar("batch-select")))
			.first()
			.click();

		await expectNoticeText(page, "Batch selection is not available in list view");

		// Selection mode must not be active despite the click.
		await expect(page.locator(sel(TID.batchCounter))).toHaveCount(0);
	});

	test("clicking the target event as its own prerequisite surfaces the cycle-rejection notice", async ({
		calendar,
	}) => {
		const page = calendar.page;
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		const [solo] = await calendar.seedMany([
			{ title: "Notice Self Prereq", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 10, 0) },
		]);

		await solo.rightClick("assignPrerequisites");
		await expect(page.locator(PREREQ_SELECTION_BANNER_CLASS).first()).toBeVisible();

		// Click the same event tile that started selection mode.
		const tile = page.locator(eventTileByTitle("Notice Self Prereq")).first();
		await tile.click();

		await expectNoticeText(page, "Cannot assign an event as its own prerequisite");
	});

	test("batch delete with no events selected surfaces the empty-selection notice", async ({ calendar }) => {
		const page = calendar.page;
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		await calendar.seedMany([
			{ title: "Notice Empty Selection", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 10, 0) },
		]);

		// Enter batch mode via the FC toolbar batch-select button (canonical
		// entry point that other specs use). Do NOT select any event.
		await page
			.locator(sel(TID.toolbar("batch-select")))
			.first()
			.click();
		await expect(page.locator(sel(TID.batchCounter))).toBeVisible();

		const deleteBtn = page.locator(sel(TID.batch("delete"))).first();
		await deleteBtn.waitFor({ state: "visible" });
		await deleteBtn.click();

		await expectNoticeText(page, "No events selected");
	});
});
