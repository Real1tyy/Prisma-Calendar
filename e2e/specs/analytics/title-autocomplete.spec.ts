import { todayStamp } from "../../fixtures/analytics-helpers";
import { expect, test } from "../../fixtures/electron";
import {
	createEventViaToolbar,
	createEventViaUI,
	openCalendarViewViaRibbon,
	saveEventModal,
	waitForNoticesClear,
} from "../../fixtures/helpers";

// `TitleInputSuggest` surfaces matches from three sources: categories,
// event presets, and past event-name series. It renders inside Obsidian's
// `.suggestion-container` portal and now stamps each row with
// `prisma-title-suggest-item`. This spec drives a category-sourced
// suggestion — categories are deterministic (created on the fly by the
// first event) unlike name-series which relies on frequency history.

const TITLE_INPUT = '.modal [data-testid="prisma-event-control-title"]';
const SUGGEST_ITEM = '[data-testid="prisma-title-suggest-item"]';

test.describe("title autocomplete", () => {
	test("typing a category prefix surfaces the category suggestion and fills the input on click", async ({
		obsidian,
	}) => {
		await openCalendarViewViaRibbon(obsidian.page);

		// Seed the categoryTracker by creating an event that uses the category.
		await createEventViaUI(obsidian.page, {
			title: "Focus Block",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
			categories: ["Deep Work"],
		});
		await waitForNoticesClear(obsidian.page);

		await createEventViaToolbar(obsidian.page);

		const titleInput = obsidian.page.locator(TITLE_INPUT).first();
		await titleInput.focus();
		await titleInput.fill("Deep");
		await titleInput.dispatchEvent("input");

		const suggestion = obsidian.page
			.locator(`${SUGGEST_ITEM}[data-suggest-source="category"][data-suggest-text="Deep Work"]`)
			.first();
		await expect(suggestion).toBeVisible();
		await suggestion.click();

		await expect(titleInput).toHaveValue("Deep Work");

		await obsidian.page.locator('.modal [data-testid="prisma-event-btn-cancel"]').first().click();
	});
});
