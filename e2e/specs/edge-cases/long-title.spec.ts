import { expect, test } from "../../fixtures/electron";
import { assertFrontmatterRoundTrip } from "../../fixtures/frontmatter-assertions";

// Most filesystems cap filenames at 255 bytes. We stay under that but well
// past any realistic display width and verify the frontmatter title
// round-trips verbatim + the event still indexes.

test("long titles: 240-char title round-trips without truncation", async ({ obsidian }) => {
	const title = "LongEvent-" + "x".repeat(230);
	expect(title.length).toBe(240);

	await assertFrontmatterRoundTrip(obsidian.page, obsidian.vaultDir, {
		seed: { title, startDate: "2026-05-04T09:00", endDate: "2026-05-04T10:00" },
		expectFrontmatter: { "Start Date": "2026-05-04T09:00" },
	});
});
