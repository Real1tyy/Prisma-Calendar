import { fromAnchor } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { startsWithStamp } from "../../fixtures/helpers";
import { clickBatchButton, enterBatchMode, waitForBatchSelectable } from "../../fixtures/history-helpers";
import { FORM_SUBMIT_TID, MOVE_BY_MODAL_TID, MOVE_BY_VALUE_TID, moveByUnit, sel } from "../../fixtures/testids";

// Batch → "Move By" opens the same offset modal as the per-event right-click
// (covered for the single-event path by events/move-by-modal.spec.ts), but
// the batch path commits the shift to every selected file. The single-event
// spec proves modal UI; this spec proves the batch fanout.

// Add N calendar days to a `YYYY-MM-DDTHH:mm` stamp, keeping the same local
// time of day. Mirrors the addHours helper from move-by-modal.spec.ts.
function addDays(stamp: string, days: number): string {
	const [datePart, timePart] = stamp.split("T");
	if (!datePart || !timePart) throw new Error(`addDays: invalid stamp ${stamp}`);
	const [y, m, d] = datePart.split("-").map((n) => Number.parseInt(n, 10));
	const date = new Date(y!, m! - 1, d!);
	date.setDate(date.getDate() + days);
	const pad = (n: number): string => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${timePart}`;
}

test.describe("calendar: batch Move-by", () => {
	test("Batch → Move By +3 days shifts Start/End on every selected event", async ({ calendar }) => {
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		const titles = ["BatchMoveBy A", "BatchMoveBy B", "BatchMoveBy C"];
		const seeds = titles.map((title, i) => ({
			title,
			start: fromAnchor(0, 9 + i, 0),
			end: fromAnchor(0, 10 + i, 0),
		}));
		const handles = await calendar.seedMany(seeds);

		await enterBatchMode(calendar.page);
		await waitForBatchSelectable(calendar.page, titles);
		await clickBatchButton(calendar.page, "select-all");
		await clickBatchButton(calendar.page, "move-by");

		const modal = calendar.page.locator(sel(MOVE_BY_MODAL_TID)).first();
		await expect(modal).toBeVisible();

		await modal.locator(sel(MOVE_BY_VALUE_TID)).fill("3");
		await modal.locator(sel(moveByUnit("days"))).click();
		await modal.locator(sel(FORM_SUBMIT_TID)).click();
		await expect(modal).toBeHidden();

		// Frontmatter is truth: every selected event's Start Date and End Date
		// must have shifted forward 3 calendar days while keeping local time.
		for (const [i, h] of handles.entries()) {
			await h.expectFrontmatter("Start Date", startsWithStamp(addDays(seeds[i]!.start, 3)));
			await h.expectFrontmatter("End Date", startsWithStamp(addDays(seeds[i]!.end, 3)));
		}
	});
});
