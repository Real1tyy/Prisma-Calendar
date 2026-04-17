import { eventByTitle, gotoToday, todayISO, todayTimedEvent, waitForEvent } from "../../fixtures/calendar-helpers";
import { expect, test } from "../../fixtures/electron";
import { openCalendar } from "../../fixtures/helpers";
import { refreshCalendar, seedEvent } from "../../fixtures/seed-events";

test.describe("search and filter", () => {
	test("typing into the search input narrows visible events", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;
		seedEvent(vaultDir, todayTimedEvent("Alpha Standup", 9, 10));
		seedEvent(vaultDir, todayTimedEvent("Beta Sync", 11, 12));

		await openCalendar(page);
		await refreshCalendar(page);
		await gotoToday(page);
		await waitForEvent(page, "Alpha Standup");
		await waitForEvent(page, "Beta Sync");

		const search = page.locator('[data-testid="prisma-filter-search"]').first();
		await search.fill("Alpha");

		await expect.poll(() => eventByTitle(page, "Alpha Standup").count(), { timeout: 5_000 }).toBeGreaterThan(0);
		await expect.poll(() => eventByTitle(page, "Beta Sync").count(), { timeout: 5_000 }).toBe(0);

		await search.fill("");
		await expect.poll(() => eventByTitle(page, "Beta Sync").count(), { timeout: 5_000 }).toBeGreaterThan(0);
	});

	test("typing into the expression filter hides events by property", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;
		const date = todayISO();
		seedEvent(vaultDir, {
			title: "Keep Event",
			startDate: `${date}T09:00`,
			endDate: `${date}T10:00`,
			category: "Work",
		});
		seedEvent(vaultDir, {
			title: "Hide Event",
			startDate: `${date}T11:00`,
			endDate: `${date}T12:00`,
			category: "Personal",
		});

		await openCalendar(page);
		await refreshCalendar(page);
		await gotoToday(page);
		await waitForEvent(page, "Keep Event");
		await waitForEvent(page, "Hide Event");

		const expr = page.locator('[data-testid="prisma-filter-expression"]').first();
		await expr.fill("Category === 'Work'");
		await expr.press("Enter");

		await expect.poll(() => eventByTitle(page, "Keep Event").count(), { timeout: 5_000 }).toBeGreaterThan(0);
		await expect.poll(() => eventByTitle(page, "Hide Event").count(), { timeout: 5_000 }).toBe(0);
	});
});
