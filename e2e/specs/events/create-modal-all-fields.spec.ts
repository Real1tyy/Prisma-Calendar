import { expectFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { anchorISO, fromAnchor } from "../../fixtures/dates";
import { expect, testWithNotifications as test } from "../../fixtures/electron";
import { sel, TID } from "../../fixtures/testids";
import { openCreateModal } from "./events-helpers";
import { fillEventModal } from "./fill-event-modal";

test.describe("create event — all fields", () => {
	test("every field lands in frontmatter on save and renders in calendar", async ({ calendar }) => {
		const date = anchorISO();
		const evt = await calendar.createEvent({
			title: "Team Meeting",
			allDay: false,
			start: fromAnchor(0, 9, 0),
			end: fromAnchor(0, 10, 30),
			categories: ["Work", "Personal"],
			prerequisites: [],
			participants: ["Alice", "Bob"],
			location: "Room A",
			icon: "calendar",
			skip: false,
			breakMinutes: 5,
			minutesBefore: 15,
			customProperties: { Priority: "high" },
		});
		expect(evt.path).toMatch(/^Events\/Team Meeting.*\.md$/);

		expectFrontmatter(calendar.vaultDir, evt.path, {
			"Start Date": `${date}T09:00:00.000Z`,
			"End Date": `${date}T10:30:00.000Z`,
			Category: ["Work", "Personal"],
			Participants: ["Alice", "Bob"],
			Location: "Room A",
			Icon: "calendar",
			Break: 5,
			"Minutes Before": 15,
			Priority: "high",
		});

		await calendar.goToAnchor();
		await evt.expectVisible();
	});

	test("duration field recomputes when end changes", async ({ calendar }) => {
		await openCreateModal(calendar.page);

		await fillEventModal(calendar.page, {
			title: "Workout",
			start: fromAnchor(0, 9, 0),
			end: fromAnchor(0, 10, 0),
		});

		const duration = calendar.page.locator(sel(TID.event.control("duration")));
		await expect(duration).toHaveValue("60");

		await fillEventModal(calendar.page, { end: fromAnchor(0, 10, 45) });
		await expect(duration).toHaveValue("105");
	});
});
