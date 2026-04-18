import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, testWithNotifications as test } from "../../fixtures/electron";

// Schema drift canary: a UI-driven create with every field populated must
// land exactly the expected set of keys — nothing extra, nothing missing.
// Uses the notifications-on fixture so the "Minutes Before" field renders in
// the create modal.
test.describe("frontmatter schema", () => {
	test("create via toolbar writes exactly the expected key set", async ({ calendar }) => {
		const evt = await calendar.createEvent({
			title: "Team Meeting",
			start: "2026-05-10T09:00",
			end: "2026-05-10T10:00",
			categories: ["Work"],
			prerequisites: [],
			participants: ["Alice"],
			location: "Room A",
			icon: "calendar",
			breakMinutes: 5,
			minutesBefore: 15,
			customProperties: { Priority: "high" },
		});

		const fm = readEventFrontmatter(calendar.vaultDir, evt.path);
		const actualKeys = new Set(Object.keys(fm));

		// The plugin writes a consistent schema regardless of user input — it
		// always emits `All Day: false` + empty `Date` for timed events (so
		// downstream tools don't have to branch on presence), and always stamps
		// `Prerequisite` even when the user never opened the assignment modal.
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
			`schema drift in ${evt.path}:\n  extra: ${JSON.stringify(extra)}\n  missing: ${JSON.stringify(missing)}`
		).toEqual({ extra: [], missing: [] });
	});
});
