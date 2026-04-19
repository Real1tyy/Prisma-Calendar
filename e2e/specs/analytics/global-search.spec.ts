import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";

// Global search toolbar action (`global-search`) opens a modal that can match
// events by title or frontmatter across the entire vault. This spec seeds a
// few events, opens the modal, types a query, and asserts the search
// surfaces the matching row.

test.describe("analytics: global search modal", () => {
	test("opens on toolbar click, lists events, filters on typed query", async ({ calendar }) => {
		await calendar.seedOnDiskMany([
			{ title: "Project Planning", start: todayStamp(9, 0), end: todayStamp(10, 0) },
			{ title: "Weekly Review", start: todayStamp(11, 0), end: todayStamp(12, 0) },
		]);

		await calendar.clickToolbar("global-search");
		await expect(calendar.page.locator(".modal").first()).toBeVisible();

		const searchInput = calendar.page.locator(sel("prisma-event-list-search")).first();
		await searchInput.waitFor({ state: "visible" });

		// Unfiltered — both events should be present.
		await expect(calendar.page.locator(sel("prisma-event-list-item-Project Planning")).first()).toBeVisible();
		await expect(calendar.page.locator(sel("prisma-event-list-item-Weekly Review")).first()).toBeVisible();

		// Filter by "Weekly" — only the Weekly Review row remains.
		await searchInput.fill("Weekly");
		await expect(calendar.page.locator(sel("prisma-event-list-item-Project Planning"))).toHaveCount(0);
		await expect(calendar.page.locator(sel("prisma-event-list-item-Weekly Review")).first()).toBeVisible();
	});
});
