import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";

// E2E-only assertion: the form ALLOWS adversarial timing (end before start)
// and the save path round-trips both values to disk as entered. Blank-title
// tolerance is a pure-function concern covered by
// tests/utils/build-event-save-data.test.ts.
test.describe("event save — validation canaries", () => {
	test("saving with end before start persists both values and does not corrupt frontmatter", async ({ calendar }) => {
		const evt = await calendar.createEvent({
			title: "Inverted Times",
			start: "2026-05-10T15:00",
			end: "2026-05-10T10:00",
		});

		const fm = readEventFrontmatter(calendar.vaultDir, evt.path);
		expect(fm["Start Date"], "start should round-trip as entered").toBe("2026-05-10T15:00:00.000Z");
		expect(fm["End Date"], "end should round-trip as entered").toBe("2026-05-10T10:00:00.000Z");
	});
});
