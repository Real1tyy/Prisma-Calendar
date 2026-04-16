import { expectFrontmatter, readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import { createEventViaModal, openCalendarReady } from "./events-helpers";

test.describe("create event — all-day", () => {
	test("writes Date + All Day, no timed datetime values", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);

		const relativePath = await createEventViaModal(obsidian, {
			title: "Project Planning",
			allDay: true,
			date: "2026-06-01",
		});
		expect(relativePath).toMatch(/^Events\/Project Planning.*\.md$/);

		expectFrontmatter(obsidian.vaultDir, relativePath, {
			Date: "2026-06-01",
			"All Day": true,
		});

		const fm = readEventFrontmatter(obsidian.vaultDir, relativePath);
		expect(fm["Start Date"] || "").toBe("");
		expect(fm["End Date"] || "").toBe("");
	});
});
