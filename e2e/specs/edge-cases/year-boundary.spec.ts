import { test } from "../../fixtures/electron";
import { assertFrontmatterRoundTrip } from "../../fixtures/frontmatter-assertions";

// Event spanning Dec 31 → Jan 1. Assert storage + index round-trip across
// the year boundary; rendering specifics are FullCalendar's responsibility.

test("year-boundary event: Dec 31 → Jan 1 stores and indexes correctly", async ({ obsidian }) => {
	await assertFrontmatterRoundTrip(obsidian.page, obsidian.vaultDir, {
		seed: { title: "New Year Crossover", startDate: "2026-12-31T23:00", endDate: "2027-01-01T01:00" },
		expectFrontmatter: { "Start Date": "2026-12-31T23:00", "End Date": "2027-01-01T01:00" },
	});
});
