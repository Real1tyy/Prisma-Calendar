import { test } from "../../fixtures/electron";
import { assertFrontmatterRoundTrip } from "../../fixtures/frontmatter-assertions";

// Event starting 23:30 day N and ending 00:30 day N+1. Prisma stores the
// raw Start/End Date as written and does not split the file into two notes —
// rendering is FullCalendar's responsibility. This spec asserts the data
// layer round-trip + single-file storage.

test("midnight-crossing event: frontmatter round-trips across the day boundary", async ({ obsidian }) => {
	await assertFrontmatterRoundTrip(obsidian.page, obsidian.vaultDir, {
		seed: {
			title: "Late Work",
			startDate: "2026-05-04T23:30",
			endDate: "2026-05-05T00:30",
			category: "Work",
		},
		expectFrontmatter: { "Start Date": "2026-05-04T23:30", "End Date": "2026-05-05T00:30" },
	});
});
