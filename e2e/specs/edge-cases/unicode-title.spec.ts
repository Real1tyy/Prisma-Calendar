import { test } from "../../fixtures/electron";
import { assertFrontmatterRoundTrip } from "../../fixtures/frontmatter-assertions";

// Emoji, CJK, RTL text in titles. Obsidian's TFile + Prisma's seed path
// preserve the raw title in the filename (seed-events.ts sanitises only the
// Windows-illegal set). The indexer round-trips the title back verbatim.

const UNICODE_TITLES = ["Lunch 🍱", "会議", "مشروع", "café ☕️"];

for (const title of UNICODE_TITLES) {
	test(`unicode titles: ${title} round-trips through frontmatter`, async ({ obsidian }) => {
		await assertFrontmatterRoundTrip(obsidian.page, obsidian.vaultDir, {
			seed: { title, startDate: "2026-05-04T12:00", endDate: "2026-05-04T13:00" },
			expectFrontmatter: { "Start Date": "2026-05-04T12:00" },
		});
	});
}
