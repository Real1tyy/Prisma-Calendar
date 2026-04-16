import { expectFrontmatter, readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import {
	createEventViaModal,
	expectEventVisible,
	monthsFromTodayTo,
	navigateCalendar,
	openCalendarReady,
} from "./events-helpers";

test.describe("create event — all-day", () => {
	test("writes Date + All Day, no timed datetime values, renders block", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);

		const date = "2026-06-01";
		const relativePath = await createEventViaModal(obsidian, {
			title: "Project Planning",
			allDay: true,
			date,
		});
		expect(relativePath).toMatch(/^Events\/Project Planning.*\.md$/);

		expectFrontmatter(obsidian.vaultDir, relativePath, {
			Date: date,
			"All Day": true,
		});

		const fm = readEventFrontmatter(obsidian.vaultDir, relativePath);
		expect(fm["Start Date"] || "").toBe("");
		expect(fm["End Date"] || "").toBe("");

		await navigateCalendar(obsidian.page, monthsFromTodayTo(date));
		await expectEventVisible(obsidian.page, "Project Planning");
	});
});
