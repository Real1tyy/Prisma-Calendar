import { expectFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import { createEventViaModal, openCalendarReady, openCreateModal } from "./events-helpers";
import { fillEventModal } from "./fill-event-modal";

// One big happy-path test that fills every modal field. The goal is to prove
// the deterministic round-trip from modal input → file on disk in a single
// bootstrap rather than paying the ~2s bootstrap cost per field.
test.describe("create event — all fields", () => {
	test("every field lands in frontmatter on save", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);

		const relativePath = await createEventViaModal(obsidian, {
			title: "Team Meeting",
			allDay: false,
			start: "2026-05-10T09:00",
			end: "2026-05-10T10:30",
			categories: ["Work", "Personal"],
			prerequisites: ["[[Project Planning]]"],
			participants: ["Alice", "Bob"],
			location: "Room A",
			icon: "calendar",
			skip: false,
			breakMinutes: 5,
			minutesBefore: 15,
			customProperties: { Priority: "high" },
		});
		expect(relativePath).toMatch(/^Events\/Team Meeting.*\.md$/);

		// `ensureISOSuffix` appends `:00.000Z` without TZ conversion; a single
		// prerequisite serializes as a scalar, not a list.
		expectFrontmatter(obsidian.vaultDir, relativePath, {
			"Start Date": "2026-05-10T09:00:00.000Z",
			"End Date": "2026-05-10T10:30:00.000Z",
			Category: ["Work", "Personal"],
			Prerequisite: "[[Project Planning]]",
			Participants: ["Alice", "Bob"],
			Location: "Room A",
			Icon: "calendar",
			Break: 5,
			"Minutes Before": 15,
			Priority: "high",
		});
	});

	test("duration field recomputes when end changes", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
		await openCreateModal(obsidian.page);

		await fillEventModal(obsidian.page, {
			title: "Workout",
			start: "2026-05-10T09:00",
			end: "2026-05-10T10:00",
		});

		const durationAfter60 = await obsidian.page.locator('[data-testid="prisma-event-control-duration"]').inputValue();
		expect(durationAfter60).toBe("60");

		await fillEventModal(obsidian.page, { end: "2026-05-10T10:45" });
		const durationAfter105 = await obsidian.page.locator('[data-testid="prisma-event-control-duration"]').inputValue();
		expect(durationAfter105).toBe("105");
	});
});
