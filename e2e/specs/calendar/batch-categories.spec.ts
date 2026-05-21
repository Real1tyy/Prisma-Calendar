import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { fromAnchor } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { clickBatchButton, enterBatchMode, waitForBatchSelectable } from "../../fixtures/history-helpers";
import { sel, sharedTID } from "../../fixtures/testids";

// Batch → "Categories" launches the assignment modal seeded with the union
// of the selected events' current categories. Submitting writes the chosen
// set to every selected file's `Category` frontmatter.
// Per-event right-click → assignCategories is covered at
// calendar/context-menu.spec.ts:71; this spec is the batch fanout case.

test.describe("calendar: batch Categories", () => {
	test("Batch → Categories assigns the chosen category to every selected event", async ({ calendar }) => {
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		const titles = ["BatchCat A", "BatchCat B", "BatchCat C"];
		const handles = await calendar.seedMany(
			titles.map((title, i) => ({
				title,
				start: fromAnchor(0, 9 + i, 0),
				end: fromAnchor(0, 10 + i, 0),
			}))
		);

		// Sanity: no category set yet.
		for (const h of handles) {
			const fm = readEventFrontmatter(calendar.vaultDir, h.path);
			expect(fm["Category"]).toBeFalsy();
		}

		await enterBatchMode(calendar.page);
		await waitForBatchSelectable(calendar.page, titles);
		await clickBatchButton(calendar.page, "select-all");
		await clickBatchButton(calendar.page, "categories");

		const assignModal = calendar.page.locator(`.modal:has(${sel(sharedTID.assignSearch())})`).first();
		await assignModal.waitFor({ state: "visible" });

		// No "Fitness" category exists yet — create it via the search-then-create flow.
		const search = assignModal.locator(sel(sharedTID.assignSearch()));
		await search.fill("Fitness");
		const createNew = assignModal.locator(sel(sharedTID.assignCreateNew()));
		await createNew.waitFor({ state: "visible" });
		await createNew.click();

		await assignModal.locator(sel(sharedTID.assignSubmit())).click();
		await assignModal.waitFor({ state: "hidden" });

		// Every selected event's frontmatter must include the new category.
		for (const h of handles) {
			await expect
				.poll(() => {
					const v = readEventFrontmatter(calendar.vaultDir, h.path)["Category"];
					const arr = Array.isArray(v) ? v : v ? [v] : [];
					return arr.map(String).includes("Fitness");
				})
				.toBe(true);
		}
	});
});
