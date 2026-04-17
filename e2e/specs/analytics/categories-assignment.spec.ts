import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { todayStamp } from "../../fixtures/analytics-helpers";
import { expect, test } from "../../fixtures/electron";
import { createEventViaUI, openCalendarViewViaRibbon, waitForNoticesClear } from "../../fixtures/helpers";

// Categories are assigned via the shared assignment modal, stamped with
// `prisma-assign-item` + `data-assign-name` rows. `createEventViaUI(..,
// { categories: [...] })` drives the full flow including the "Create new"
// fallback when a category doesn't exist yet. This spec asserts the
// frontmatter side-effect (the value lands on disk under the configured
// category property) and that the tile still renders after assignment.
// Category → colour mapping is exercised separately in color-rules.spec.

const TILE = '[data-testid="prisma-cal-event"]';

test.describe("categories assignment", () => {
	test("assigns a category via the picker and persists it in frontmatter", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);

		await createEventViaUI(obsidian.page, {
			title: "Categorised Task",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
			categories: ["Work"],
		});
		await waitForNoticesClear(obsidian.page);

		const tile = obsidian.page.locator(`${TILE}[data-event-title="Categorised Task"]`).first();
		await expect(tile).toBeVisible();

		// The category property name is configurable but defaults to "Category".
		// Obsidian may append a disambiguation suffix when a file of the same
		// name exists — glob the Events folder for any "Categorised Task*.md".
		const eventsDir = join(obsidian.vaultDir, "Events");
		const match = readdirSync(eventsDir).find((f) => f.startsWith("Categorised Task") && f.endsWith(".md"));
		expect(match, "event file not written to disk").toBeDefined();
		const content = readFileSync(join(eventsDir, match!), "utf8");
		expect(content).toMatch(/Category:\s*Work/);
	});
});
