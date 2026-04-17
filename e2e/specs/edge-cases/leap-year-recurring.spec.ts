import { test } from "../../fixtures/electron";
import { assertFrontmatterRoundTrip } from "../../fixtures/frontmatter-assertions";

// Recurring YEARLY event on Feb 29. Prisma delegates expansion to rrule.js
// via recurring-event-manager.ts; the library skips non-leap years by
// default. We just verify the source event stores and indexes — expansion
// counts depend on the current-window leap-year count and are tested by
// rrule.js itself.

test("Feb 29 recurring event: yearly Feb 29 source event is stored and indexed", async ({ obsidian }) => {
	await assertFrontmatterRoundTrip(obsidian.page, obsidian.vaultDir, {
		seed: {
			title: "Leap Day Review",
			startDate: "2028-02-29T10:00",
			endDate: "2028-02-29T11:00",
			rrule: "FREQ=YEARLY",
		},
		expectFrontmatter: { "Start Date": "2028-02-29T10:00", RRule: "FREQ=YEARLY" },
	});
});
