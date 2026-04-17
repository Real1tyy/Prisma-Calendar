import { todayStamp } from "../../fixtures/analytics-helpers";
import { expect, test } from "../../fixtures/electron";
import { clickToolbar, openCalendarViewViaRibbon, seedEvents } from "../../fixtures/helpers";

// Global search toolbar action (`global-search`) opens a modal that can match
// events by title or frontmatter across the entire vault. This spec seeds a
// few events, opens the modal, types a query, and asserts the search
// surfaces the matching row.

test.describe("analytics: global search modal", () => {
	test("opens on toolbar click, lists events, filters on typed query", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);

		// `seedEvents` also drains the notice stack — waiting for notices lets
		// the event-store finish indexing before the search modal opens.
		await seedEvents(obsidian.page, [
			{ title: "Project Planning", start: todayStamp(9, 0), end: todayStamp(10, 0) },
			{ title: "Weekly Review", start: todayStamp(11, 0), end: todayStamp(12, 0) },
		]);

		await clickToolbar(obsidian.page, "global-search");
		await expect(obsidian.page.locator(".modal").first()).toBeVisible({ timeout: 5_000 });

		// Both seeded events must be reachable as list items in the modal.
		const searchInput = obsidian.page.locator('[data-testid="prisma-event-list-search"]').first();
		await searchInput.waitFor({ state: "visible", timeout: 5_000 });

		// Unfiltered — both events should be present.
		await expect(obsidian.page.locator('[data-testid="prisma-event-list-item-Project Planning"]').first()).toBeVisible({
			timeout: 5_000,
		});
		await expect(obsidian.page.locator('[data-testid="prisma-event-list-item-Weekly Review"]').first()).toBeVisible();

		// Filter by "Weekly" — only the Weekly Review row remains.
		await searchInput.fill("Weekly");
		await expect(obsidian.page.locator('[data-testid="prisma-event-list-item-Project Planning"]')).toHaveCount(0, {
			timeout: 5_000,
		});
		await expect(obsidian.page.locator('[data-testid="prisma-event-list-item-Weekly Review"]').first()).toBeVisible();
	});
});
