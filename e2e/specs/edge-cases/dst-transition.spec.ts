import { test } from "../../fixtures/electron";
import { assertFrontmatterRoundTrip } from "../../fixtures/frontmatter-assertions";

// Prisma stores wall-clock local time in ISO form (no zone suffix) — see
// ics-export.ts's "local-time-as-UTC convention" comment. On DST spring
// forward (US: 2027-03-14 02:00 local) a 02:30 wall-clock is a legal value
// before the jump. We assert the stored literal survives the indexer
// round-trip byte-for-byte, since the DateTime parser must not shift it.

test("DST spring-forward: 02:30 wall-clock on the transition date survives the round-trip", async ({ obsidian }) => {
	await assertFrontmatterRoundTrip(obsidian.page, obsidian.vaultDir, {
		seed: { title: "DST Morning", startDate: "2027-03-14T02:30", endDate: "2027-03-14T03:30" },
		expectFrontmatter: { "Start Date": "2027-03-14T02:30", "End Date": "2027-03-14T03:30" },
	});
});
