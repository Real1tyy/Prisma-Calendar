import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { isoLocal } from "../../fixtures/dates";
import { expect, testWithNotifications as test } from "../../fixtures/electron";

// Schema drift canary: a UI-driven create with every field populated must
// land EXACTLY the expected frontmatter — every key, every value, every type.
// The strict `toEqual` shape catches three regression classes in one assertion:
//   1. Drift — a new key gets stamped, or an existing one disappears.
//   2. Type regression — `Category` collapses from list to scalar
//      (assignListToFrontmatter's branch boundary), `Break` degrades from
//      number to string, etc.
//   3. Value regression — any field's serialized payload changes shape.
//
// Notable invariants the shape pins:
//   - Plugin always emits `All Day: false` + empty `Date` for timed events
//     so downstream tools don't have to branch on presence.
//   - `assignListToFrontmatter` collapses an empty list to `""`, the canonical
//     empty-list form (used here for `Prerequisite`).
//   - 2-item lists are arrays; a single-item input would collapse to a scalar
//     — using ≥2-item arrays keeps the array branch under test.
//   - `dtstart` is seeded 7 days from today so `skipNewlyCreatedNotifications`
//     does NOT stamp `Already Notified` — the field must NOT appear in the
//     output. A hardcoded date drifts into the past as the wall-clock advances
//     and flips that branch, so we compute it relative to today.

test.describe("frontmatter schema", () => {
	test("create via toolbar writes exactly the expected frontmatter shape", async ({ calendar }) => {
		const start = isoLocal(7, 9, 0);
		const end = isoLocal(7, 10, 0);

		const evt = await calendar.createEvent({
			title: "Team Meeting",
			start,
			end,
			categories: ["Work", "Personal"],
			prerequisites: [],
			participants: ["Alice", "Bob"],
			location: "Room A",
			icon: "calendar",
			breakMinutes: 5,
			minutesBefore: 15,
			customProperties: { Priority: "high" },
		});

		expect(readEventFrontmatter(calendar.vaultDir, evt.path)).toEqual({
			"Start Date": `${start}:00.000Z`,
			"End Date": `${end}:00.000Z`,
			"All Day": false,
			Date: "",
			Category: ["Work", "Personal"],
			Prerequisite: "",
			Participants: ["Alice", "Bob"],
			Location: "Room A",
			Icon: "calendar",
			Break: 5,
			"Minutes Before": 15,
			Priority: "high",
		});
	});
});
