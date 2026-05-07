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

		const modalRoot = calendar.page.locator(sel("prisma-list-modal")).first();
		await expect(modalRoot).toBeVisible();

		const searchInput = modalRoot.locator(sel("prisma-list-search")).first();
		await searchInput.waitFor({ state: "visible" });

		// Scope to the modal — calendar tiles also use `data-event-title` behind the overlay.
		const rowByTitle = (title: string) => modalRoot.locator(`[data-event-title="${title}"]`);

		await expect(rowByTitle("Project Planning").first()).toBeVisible();
		await expect(rowByTitle("Weekly Review").first()).toBeVisible();

		await searchInput.fill("Weekly");
		await expect(rowByTitle("Project Planning")).toHaveCount(0);
		await expect(rowByTitle("Weekly Review").first()).toBeVisible();
	});
});
