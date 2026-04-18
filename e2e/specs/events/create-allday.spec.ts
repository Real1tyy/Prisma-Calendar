import { expectFrontmatter, readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import { monthsFromTodayTo, navigateCalendar } from "./events-helpers";

test.describe("create event — all-day", () => {
	test("writes Date + All Day, no timed datetime values, renders block", async ({ calendar }) => {
		const date = "2026-06-01";
		const evt = await calendar.createEvent({ title: "Project Planning", allDay: true, date });
		expect(evt.path).toMatch(/^Events\/Project Planning.*\.md$/);

		expectFrontmatter(calendar.vaultDir, evt.path, { Date: date, "All Day": true });

		const fm = readEventFrontmatter(calendar.vaultDir, evt.path);
		expect(fm["Start Date"] || "").toBe("");
		expect(fm["End Date"] || "").toBe("");

		await navigateCalendar(calendar.page, monthsFromTodayTo(date));
		await evt.expectVisible();
	});
});
