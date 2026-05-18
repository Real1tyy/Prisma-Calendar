import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { createEventViaToolbar, saveEventModal } from "../../fixtures/helpers";
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

	// Bug regression: typing "Planni" with the ghost suggesting "Planning",
	// pressing Enter to accept, then Save resulted in `Planni-<zettel>.md`
	// — the suggester wrote "Planning" into the DOM but never told the React
	// form-state controller, so Save committed the typed prefix instead of
	// the chosen text. The on-disk filename is the only truth here.
	test("accepting a suggestion then saving writes the suggestion text to disk (not the typed prefix)", async ({
		calendar,
	}) => {
		// Seed a name-series entry so typing a prefix produces a ghost match.
		// The prior event becomes a frequency-1 name-series item under "Planning".
		await calendar.createEvent({
			title: "Planning",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
		});

		const eventsDir = join(calendar.vaultDir, "Events");
		const beforeFiles = existsSync(eventsDir) ? readdirSync(eventsDir) : [];
		expect(beforeFiles.filter((f) => f.startsWith("Planning-")).length).toBe(1);

		await createEventViaToolbar(calendar.page);

		const titleInput = calendar.page.locator(`.modal ${sel(TID.event.control("title"))}`).first();
		await titleInput.focus();
		// Type the prefix that the ghost completes to the existing "Planning".
		await titleInput.fill("Planni");
		await titleInput.dispatchEvent("input");

		const suggestion = calendar.page
			.locator(`${SUGGEST_ITEM}[data-suggest-source="name-series"][data-suggest-text="Planning"]`)
			.first();
		await expect(suggestion).toBeVisible();
		// Click is equivalent to pressing Enter on a highlighted suggestion —
		// both route through AbstractInputSuggest.selectSuggestion → onAcceptTitle.
		await suggestion.click();

		// React picked up the hand-off and re-rendered the input to the chosen text.
		await expect(titleInput).toHaveValue("Planning");

		await saveEventModal(calendar.page);

		// Two events with that name on disk — the seeded one plus the just-
		// saved suggestion-accepted one. Critically: zero files whose basename
		// is just "Planni" (the bug fingerprint).
		await expect
			.poll(() => readdirSync(eventsDir).filter((f) => f.startsWith("Planning-") && f.endsWith(".md")).length, {
				message: "Save must persist the suggestion text (Planning), not the typed prefix (Planni)",
			})
			.toBe(2);
		expect(readdirSync(eventsDir).filter((f) => /^Planni-\d{14}\.md$/.test(f))).toEqual([]);
	});
});
