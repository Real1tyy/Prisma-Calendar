import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { createEventViaToolbar } from "../../fixtures/helpers";
import { sel, TID } from "../../fixtures/testids";

// `TitleInputSuggest` surfaces matches from three sources: categories,
// event presets, and past event-name series. It renders inside Obsidian's
// `.suggestion-container` portal and now stamps each row with
// `prisma-title-suggest-item`. This spec drives a category-sourced
// suggestion — categories are deterministic (created on the fly by the
// first event) unlike name-series which relies on frequency history.

const SUGGEST_ITEM = sel("prisma-title-suggest-item");

test.describe("title autocomplete", () => {
	test("typing a category prefix surfaces the category suggestion and fills the input on click", async ({
		calendar,
	}) => {
		// Seed the categoryTracker by creating an event that uses the category.
		await calendar.createEvent({
			title: "Focus Block",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
			categories: ["Deep Work"],
		});
		await calendar.waitForNoticesClear();

		await createEventViaToolbar(calendar.page);

		const titleInput = calendar.page.locator(`.modal ${sel(TID.event.control("title"))}`).first();
		await titleInput.focus();
		await titleInput.fill("Deep");
		await titleInput.dispatchEvent("input");

		const suggestion = calendar.page
			.locator(`${SUGGEST_ITEM}[data-suggest-source="category"][data-suggest-text="Deep Work"]`)
			.first();
		await expect(suggestion).toBeVisible();
		await suggestion.click();

		await expect(titleInput).toHaveValue("Deep Work");

		await calendar.page
			.locator(`.modal ${sel(TID.event.btn("cancel"))}`)
			.first()
			.click();
	});
});
