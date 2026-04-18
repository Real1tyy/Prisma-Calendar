import { eventByTitle, gotoToday, todayISO, todayTimedEvent, waitForEvent } from "../../fixtures/calendar-helpers";
import { expect, test } from "../../fixtures/electron";
import { refreshCalendar, seedEvent } from "../../fixtures/seed-events";
import { sel } from "../../fixtures/testids";

test.describe("search and filter", () => {
	test("typing into the search input narrows visible events", async ({ calendar }) => {
		const { page, vaultDir } = calendar;
		seedEvent(vaultDir, todayTimedEvent("Alpha Standup", 9, 10));
		seedEvent(vaultDir, todayTimedEvent("Beta Sync", 11, 12));

		await refreshCalendar(page);
		await gotoToday(page);
		await waitForEvent(page, "Alpha Standup");
		await waitForEvent(page, "Beta Sync");

		const search = page.locator(sel("prisma-filter-search")).first();
		await search.fill("Alpha");

		await expect.poll(() => eventByTitle(page, "Alpha Standup").count()).toBeGreaterThan(0);
		await expect.poll(() => eventByTitle(page, "Beta Sync").count()).toBe(0);

		await search.fill("");
		await expect.poll(() => eventByTitle(page, "Beta Sync").count()).toBeGreaterThan(0);
	});

	test("typing into the expression filter hides events by property", async ({ calendar }) => {
		const { page, vaultDir } = calendar;
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

		await refreshCalendar(page);
		await gotoToday(page);
		await waitForEvent(page, "Keep Event");
		await waitForEvent(page, "Hide Event");

		const expr = page.locator(sel("prisma-filter-expression")).first();
		await expr.fill("Category === 'Work'");
		await expr.press("Enter");

		await expect.poll(() => eventByTitle(page, "Keep Event").count()).toBeGreaterThan(0);
		await expect.poll(() => eventByTitle(page, "Hide Event").count()).toBe(0);
	});
});
