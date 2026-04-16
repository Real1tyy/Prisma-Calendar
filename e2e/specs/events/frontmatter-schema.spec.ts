import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import { createEventViaModal, openCalendarReady } from "./events-helpers";

// Deterministic schema check: the set of keys Prisma writes for a fully
// populated event must match the keys the plugin's settings claim it writes.
// Any extra or missing key → fail with a diff. Catches silent schema drift
// without requiring a hand-maintained golden file.
test.describe("frontmatter schema", () => {
	test("create writes exactly the expected key set", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);

		const relativePath = await createEventViaModal(obsidian, {
			title: "Team Meeting",
			start: "2026-05-10T09:00",
			end: "2026-05-10T10:00",
			categories: ["Work"],
			prerequisites: ["[[Project Planning]]"],
			participants: ["Alice"],
			location: "Room A",
			icon: "calendar",
			breakMinutes: 5,
			minutesBefore: 15,
			customProperties: { Priority: "high" },
		});
		const fm = readEventFrontmatter(obsidian.vaultDir, relativePath);
		const actualKeys = new Set(Object.keys(fm));

		// The expected keys come directly from the plugin's default property
		// names. When a setting is enabled and a value is provided, the plugin
		// writes the corresponding property. This list documents that contract
		// at the e2e level; drift on either side will fail this test.
		// Timed events still get `All Day: false` and an empty `Date` key written
		// — `applyDateFieldsToFrontmatter` writes the full trio regardless of mode
		// so downstream tools don't have to branch on presence.
		const expectedKeys = new Set([
			"Start Date",
			"End Date",
			"All Day",
			"Date",
			"Category",
			"Prerequisite",
			"Participants",
			"Location",
			"Icon",
			"Break",
			"Minutes Before",
			"Priority",
		]);

		const extra = [...actualKeys].filter((k) => !expectedKeys.has(k));
		const missing = [...expectedKeys].filter((k) => !actualKeys.has(k));

		expect(
			{ extra, missing },
			`schema drift in ${relativePath}:\n  extra: ${JSON.stringify(extra)}\n  missing: ${JSON.stringify(missing)}`
		).toEqual({ extra: [], missing: [] });
	});
});
