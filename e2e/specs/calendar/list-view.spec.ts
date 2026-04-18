import { gotoToday, listEventRow, todayTimedEvent } from "../../fixtures/calendar-helpers";
import { expect, test } from "../../fixtures/electron";
import { refreshCalendar, seedEvent } from "../../fixtures/seed-events";
import { sel, TID } from "../../fixtures/testids";

test.describe("list view", () => {
	test("switching to list view shows the list table", async ({ calendar }) => {
		await gotoToday(calendar.page);
		await calendar.switchMode("list");

		await expect(calendar.page.locator(".fc-list").first()).toBeVisible();
	});

	test("seeded event appears as a list row with its title", async ({ calendar }) => {
		const { page, vaultDir } = calendar;
		seedEvent(vaultDir, todayTimedEvent("List Event", 10, 11));

		await refreshCalendar(page);
		await gotoToday(page);
		await calendar.switchMode("list");

		const row = listEventRow(page, "List Event");
		await expect(row).toBeVisible();
	});

	test("empty week renders the no-events message, not a crash", async ({ calendar }) => {
		const { page } = calendar;
		const errors: string[] = [];
		page.on("pageerror", (err) => errors.push(err.message));

		await gotoToday(page);
		await calendar.switchMode("list");

		// Jump far enough forward that no seeded event can land in the visible
		// week. 52 Next clicks = roughly one year — well clear of anything the
		// default vault seeds. FullCalendar renders `.fc-list-empty` when the
		// week has zero events; just assert it appears and nothing threw.
		const next = page.locator(sel(TID.toolbar("next"))).first();
		for (let i = 0; i < 52; i++) {
			await next.click();
		}

		await expect(page.locator(".fc-list-empty").first()).toBeVisible();
		expect(errors, errors.join("\n")).toHaveLength(0);
	});
});
