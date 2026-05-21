import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { expectUniqueVisibleEventCount } from "../../fixtures/stress-helpers";
import { LIST_MODAL_TID, sel } from "../../fixtures/testids";

// The "Show skipped events" command opens a list of every event currently
// hidden by `Skip: true`. Un-skipping from the modal must:
//   1. clear `Skip` on disk
//   2. drop the row from the modal
//   3. re-render the event on the calendar
//
// Each step crosses a different boundary (palette → React modal → command
// manager → metadataCache → calendar render). RTL can't fake the full chain.

test.describe("analytics: Show skipped events modal", () => {
	test("Un-skip from modal restores the event on the calendar and clears Skip in frontmatter", async ({ calendar }) => {
		// Two events pre-skipped via frontmatter at seed time (arrange state,
		// not the act under test) + one visible event so the modal must
		// filter down to exactly the skipped pair.
		const skippedA = await calendar.seedOnDisk("Skipped Alpha", {
			"Start Date": todayStamp(9, 0),
			"End Date": todayStamp(10, 0),
			Skip: true,
		});
		await calendar.seedOnDisk("Skipped Beta", {
			"Start Date": todayStamp(11, 0),
			"End Date": todayStamp(12, 0),
			Skip: true,
		});
		await calendar.seedOnDisk("Visible Gamma", {
			"Start Date": todayStamp(13, 0),
			"End Date": todayStamp(14, 0),
		});

		// Sanity: calendar shows only the visible one.
		await expectUniqueVisibleEventCount(calendar.page, 1);

		await calendar.runCommand("Prisma Calendar: Show skipped events");

		const modal = calendar.page.locator(sel(LIST_MODAL_TID)).first();
		await expect(modal).toBeVisible();

		const skippedRow = modal.locator(`[data-event-title="Skipped Alpha"]`);
		const otherSkipped = modal.locator(`[data-event-title="Skipped Beta"]`);
		const visibleRow = modal.locator(`[data-event-title="Visible Gamma"]`);
		await expect(skippedRow).toHaveCount(1);
		await expect(otherSkipped).toHaveCount(1);
		await expect(visibleRow).toHaveCount(0);

		// Un-skip Alpha — its row drops, Beta stays.
		await skippedRow.getByRole("button", { name: "Un-skip" }).click();
		await expect(skippedRow).toHaveCount(0);
		await expect(otherSkipped).toHaveCount(1);

		// Frontmatter on disk no longer carries Skip: true.
		await expect.poll(() => readEventFrontmatter(calendar.vaultDir, skippedA.path)["Skip"]).toBeUndefined();

		// Calendar now renders Alpha alongside the original visible event.
		await expectUniqueVisibleEventCount(calendar.page, 2);
	});
});
