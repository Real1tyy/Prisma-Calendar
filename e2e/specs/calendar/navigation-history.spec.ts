import { gotoToday } from "../../fixtures/calendar-helpers";
import { expect, test } from "../../fixtures/electron";
import { FC_TOOLBAR_TITLE, sel, TID } from "../../fixtures/testids";

// `calendar/navigation.spec.ts` covers prev/next/today + view-switching by
// asserting the FC toolbar title. This spec proves the per-bundle
// `NavigationHistoryManager` (a `HistoryStack` of `{date, viewType}` entries)
// — push on `datesSet`, navigate back / forward via the toolbar action
// buttons, and the LIFO invariant that branches forward-history when you
// push after stepping back.
//
// The history records on every FC `datesSet` callback (calendar-view.ts:500),
// so the test drives the user-visible toolbar buttons (`prev`, `next`, view
// chips), and then the page-header `navigate-back`/`navigate-forward`
// actions to walk the stack. We assert on the toolbar title — same surface
// `navigation.spec.ts` uses, but here the assertion sequence proves the
// stack semantics rather than a single button.

test.describe("calendar navigation history", () => {
	test("back/forward walk the recorded view+date stack and rewind to the entry point", async ({ calendar }) => {
		const page = calendar.page;
		await gotoToday(page);
		await calendar.switchMode("week");

		const header = page.locator(FC_TOOLBAR_TITLE).first();
		const week0 = (await header.textContent())?.trim() ?? "";
		expect(week0).toBeTruthy();

		// Push a few date moves: week+1, week+2.
		await page
			.locator(sel(TID.toolbar("next")))
			.first()
			.click();
		const week1 = (await header.textContent())?.trim() ?? "";
		expect(week1).not.toBe(week0);
		await page
			.locator(sel(TID.toolbar("next")))
			.first()
			.click();
		const week2 = (await header.textContent())?.trim() ?? "";
		expect(week2).not.toBe(week1);

		// Push a view change: switch to month while sitting on week+2.
		await calendar.switchMode("month");
		const month2 = (await header.textContent())?.trim() ?? "";
		expect(month2).not.toBe(week2);

		// Walk back through the stack: each "navigate-back" pops one entry off
		// the back stack and restores the previous (viewType, date) snapshot.
		await calendar.clickToolbar("navigate-back");
		await expect(header).toHaveText(week2);
		await calendar.clickToolbar("navigate-back");
		await expect(header).toHaveText(week1);
		await calendar.clickToolbar("navigate-back");
		await expect(header).toHaveText(week0);

		// Forward navigation replays the entries in order.
		await calendar.clickToolbar("navigate-forward");
		await expect(header).toHaveText(week1);
		await calendar.clickToolbar("navigate-forward");
		await expect(header).toHaveText(week2);
		await calendar.clickToolbar("navigate-forward");
		await expect(header).toHaveText(month2);
	});

	test("a fresh push after stepping back truncates the forward branch", async ({ calendar }) => {
		const page = calendar.page;
		await gotoToday(page);
		await calendar.switchMode("week");

		const header = page.locator(FC_TOOLBAR_TITLE).first();
		const start = (await header.textContent())?.trim() ?? "";
		expect(start).toBeTruthy();

		await page
			.locator(sel(TID.toolbar("next")))
			.first()
			.click();
		const week1 = (await header.textContent())?.trim() ?? "";
		await page
			.locator(sel(TID.toolbar("next")))
			.first()
			.click();
		const week2 = (await header.textContent())?.trim() ?? "";
		expect(week2).not.toBe(week1);

		// Step back once → land on week1. Now mutate (push a new entry by
		// clicking prev twice): this should branch — the previous forward
		// (week2) gets discarded so a subsequent forward call cannot reach it.
		await calendar.clickToolbar("navigate-back");
		await expect(header).toHaveText(week1);
		await page
			.locator(sel(TID.toolbar("prev")))
			.first()
			.click();
		const newBranch = (await header.textContent())?.trim() ?? "";
		expect(newBranch).toBe(start);

		// Forward now restores the new branch entry, not the discarded week2.
		// canGoForward should still be true (we have one prior entry on the
		// truncated forward stack -> the new branch), and going forward lands
		// on `newBranch` rather than `week2`.
		await calendar.clickToolbar("navigate-back");
		await expect(header).toHaveText(week1);
		await calendar.clickToolbar("navigate-forward");
		await expect(header).toHaveText(newBranch);

		// One more forward should be a no-op — the original week2 was pruned.
		const beforeNoop = (await header.textContent())?.trim() ?? "";
		await calendar.clickToolbar("navigate-forward");
		await expect(header).toHaveText(beforeNoop);
	});
});
