import { expectFrontmatter, readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

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

	test("prerequisites assignment and mark-as-done land in frontmatter alongside every other field", async ({
		calendar,
	}) => {
		const date = anchorISO();
		// Seed a prereq target on disk so the assign modal can resolve it —
		// driveAssignModal uses { allowCreateNew: false } for prerequisites, which
		// matches production: prereqs are wiki-links to *existing* events only.
		const prereqHandle = await calendar.seedOnDisk("Prerequisite Source", {
			"Start Date": `${date}T08:00`,
			"End Date": `${date}T08:30`,
		});

		const evt = await calendar.createEvent({
			title: "Done Event",
			allDay: false,
			start: fromAnchor(0, 9, 0),
			end: fromAnchor(0, 10, 30),
			categories: ["Work"],
			prerequisites: ["Prerequisite Source"],
			participants: ["Alice"],
			location: "Room B",
			icon: "check",
			breakMinutes: 5,
			markAsDone: true,
			customProperties: { Priority: "high" },
		});

		expectFrontmatter(calendar.vaultDir, evt.path, {
			"Start Date": `${date}T09:00:00.000Z`,
			"End Date": `${date}T10:30:00.000Z`,
			Category: "Work",
			Participants: "Alice",
			Location: "Room B",
			Icon: "check",
			Break: 5,
			Priority: "high",
			// statusProperty/doneValue default to "Status"/"Done" per
			// CustomCalendarSettingsSchema in src/types/settings.ts.
			Status: "Done",
		});

		// Prerequisite is written by `toDisplayLink(filePath)` → full
		// `[[path/without-ext|displayName]]` wiki-link (shared/src/core/file/file.ts).
		// YAML serializer may emit it as scalar or 1-element list — normalise.
		const fm = readEventFrontmatter(calendar.vaultDir, evt.path);
		const prereqValue = fm["Prerequisite"];
		const prereqPathWithoutExt = prereqHandle.path.replace(/\.md$/, "");
		const prereqDisplayName = prereqPathWithoutExt.replace(/^.*\//, "");
		const expectedLink = `[[${prereqPathWithoutExt}|${prereqDisplayName}]]`;
		const prereqList = Array.isArray(prereqValue) ? prereqValue : [prereqValue];
		expect(prereqList).toEqual([expectedLink]);

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
