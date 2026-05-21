import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import {
	eventTileByTitle,
	FORM_SUBMIT_TID,
	sel,
	UNTRACKED_CREATE_BTN_TID,
	UNTRACKED_CREATE_MODAL_TID,
	UNTRACKED_CREATE_NAME_TID,
	UNTRACKED_DROPDOWN_TID,
	UNTRACKED_ITEM_START_TID,
	UNTRACKED_ITEM_TID,
} from "../../fixtures/testids";
import { snapshotEventFiles, waitForNewEventFiles } from "./events-helpers";

// Untracked-event lifecycle: create via dropdown → file on disk has no
// schedule → re-open dropdown → item visible → click ▶ → frontmatter gains
// a Start/End Date and the event materialises on the calendar. Spans every
// cross-boundary the dropdown owns (react modal → createUntrackedEvent →
// vault file → untrackedEventStore observable → re-render →
// MinimizedModalManager.startStopwatchSession → writeStopwatchStart →
// metadataCache → calendar render).
//
// In-modal stopwatch ticking + minimize/restore is covered by
// integrations/stopwatch-lifecycle.spec.ts. This spec is the entry-path
// fanout: how an untracked file becomes a tracked event.

test.describe("events: untracked lifecycle", () => {
	test("create from dropdown → click ▶ → file gains Start Date and renders on the calendar", async ({ calendar }) => {
		const title = "Untracked Lifecycle Subject";

		// Snapshot Events/ so we can diff for the new file
		// (createUntrackedEvent suffixes the filename with a zettel id, so
		// the path isn't predictable from the title alone).
		const baseline = snapshotEventFiles(calendar.vaultDir);

		// Open dropdown + create modal, fill name + submit.
		await calendar.openUntrackedDropdown();
		await calendar.page.locator(sel(UNTRACKED_CREATE_BTN_TID)).first().click();

		const createModal = calendar.page.locator(sel(UNTRACKED_CREATE_MODAL_TID)).first();
		await expect(createModal).toBeVisible();

		await createModal.locator(sel(UNTRACKED_CREATE_NAME_TID)).fill(title);
		await createModal.locator(sel(FORM_SUBMIT_TID)).click();
		await expect(createModal).toBeHidden();

		// Pick up the new file path after the async create lands.
		const [filePath] = await waitForNewEventFiles(calendar.vaultDir, baseline, 1);
		if (!filePath) throw new Error("untracked-lifecycle: no new event file appeared");

		// On disk with no Start/End Date — untracked by definition.
		const initialFm = readEventFrontmatter(calendar.vaultDir, filePath);
		expect(initialFm["Start Date"]).toBeFalsy();
		expect(initialFm["End Date"]).toBeFalsy();

		// New untracked event does NOT render on the calendar (no schedule).
		await expect(calendar.page.locator(eventTileByTitle(title))).toHaveCount(0);

		// Re-open dropdown → newly created event appears as an item.
		await calendar.openUntrackedDropdown();
		const dropdown = calendar.page.locator(sel(UNTRACKED_DROPDOWN_TID)).first();
		const item = dropdown.locator(sel(UNTRACKED_ITEM_TID)).filter({ hasText: title }).first();
		await expect(item).toBeVisible();

		// Click ▶ — starts tracking. The handler closes the dropdown and
		// writes Start Date/End Date to the file via writeStopwatchStart.
		await item.locator(sel(UNTRACKED_ITEM_START_TID)).click();
		await expect(dropdown).toBeHidden();

		// Frontmatter is truth: Start Date is now populated.
		await expect.poll(() => readEventFrontmatter(calendar.vaultDir, filePath)["Start Date"]).toBeTruthy();
		const trackedFm = readEventFrontmatter(calendar.vaultDir, filePath);
		expect(trackedFm["End Date"]).toBeTruthy();

		// The event now renders on the calendar — tile materialises with its title.
		await expect(calendar.page.locator(eventTileByTitle(title))).toHaveCount(1);
	});
});
