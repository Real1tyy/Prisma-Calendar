import { expectFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, testWithNotifications as test } from "../../fixtures/electron";
import {
	createEventViaModal,
	expectEventVisible,
	monthsFromTodayTo,
	navigateCalendar,
	openCalendarReady,
	openCreateModal,
} from "./events-helpers";
import { fillEventModal } from "./fill-event-modal";

// One big UI-driven happy-path test — a real user clicking Create, typing into
// every field, then clicking Save. Mirrors the workflow we expect end users
// to hit, validates that every modal input round-trips to frontmatter, and
// confirms the saved block renders in the calendar grid. Uses the
// notifications-on fixture so the "Notify minutes before" input renders.
test.describe("create event — all fields", () => {
	test("every field lands in frontmatter on save and renders in calendar", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);

		const date = "2026-05-10";
		const relativePath = await createEventViaModal(obsidian, {
			title: "Team Meeting",
			allDay: false,
			start: `${date}T09:00`,
			end: `${date}T10:30`,
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
		expect(relativePath).toMatch(/^Events\/Team Meeting.*\.md$/);

		expectFrontmatter(obsidian.vaultDir, relativePath, {
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

		await navigateCalendar(obsidian.page, monthsFromTodayTo(date));
		await expectEventVisible(obsidian.page, "Team Meeting");
	});

	test("duration field recomputes when end changes", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
		await openCreateModal(obsidian.page);

		await fillEventModal(obsidian.page, {
			title: "Workout",
			start: "2026-05-10T09:00",
			end: "2026-05-10T10:00",
		});

		const duration60 = await obsidian.page.locator('[data-testid="prisma-event-control-duration"]').inputValue();
		expect(duration60).toBe("60");

		await fillEventModal(obsidian.page, { end: "2026-05-10T10:45" });
		const duration105 = await obsidian.page.locator('[data-testid="prisma-event-control-duration"]').inputValue();
		expect(duration105).toBe("105");
	});
});
