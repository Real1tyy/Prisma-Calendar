import { expect } from "@playwright/test";

import { todayStamp } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import { closeSettings, openPrismaSettings, switchSettingsTab } from "../../fixtures/helpers";
import { updateCalendarSettings } from "../../fixtures/seed-events";

// Regression: renaming a category through the Categories settings tab used to
// leave the calendar's in-memory cache pointing at the old name even though
// the event files on disk were rewritten. Two layers contributed: VaultTable's
// same-mtime dedup (fixed separately) and EventStore's same-mtime dedup that
// swallowed the file-changed indexer event when processFrontMatter kept the
// mtime. This spec exercises the full user path — disk rewrite, settings list
// refresh, and (crucially) the calendar tile picking up the updated category
// via the color rule that was rewritten in the same settings transaction.

const RULE_COLOR = "#ff00aa";

test.describe("settings: Categories rename propagation", () => {
	test("renames the category on disk, refreshes the settings list, and re-colors calendar tiles", async ({
		calendar,
		obsidian,
	}) => {
		// Pre-seed a color rule so the calendar tiles render a distinctive
		// colour tied to the "Renamable" expression. The rename modal rewrites
		// both the file frontmatter *and* the matching colorRule expression,
		// so if both layers update coherently the tiles keep the same colour
		// after the rename. If EventStore holds stale frontmatter, the rule no
		// longer matches and the tile falls back to the default colour — which
		// is exactly the user-visible symptom we're guarding against.
		await updateCalendarSettings(calendar.page, {
			colorRules: [
				{
					id: "rule-renamable",
					expression: "Category.includes('Renamable')",
					color: RULE_COLOR,
					enabled: true,
				},
			],
		});

		// Two events so the bulk rename operation iterates more than once —
		// the real-world trigger for the same-mtime dedup bug.
		const evt1 = await calendar.createEvent({
			title: "Rename Target Alpha",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
			categories: ["Renamable"],
		});
		await evt1.expectVisible();
		await evt1.expectColor(RULE_COLOR);

		const evt2 = await calendar.createEvent({
			title: "Rename Target Beta",
			start: todayStamp(11, 0),
			end: todayStamp(12, 0),
			categories: ["Renamable"],
		});
		await evt2.expectVisible();
		await evt2.expectColor(RULE_COLOR);

		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "categories");

		const originalRow = obsidian.page.locator(
			'[data-testid="prisma-category-settings-item"][data-category="Renamable"]'
		);
		await expect(originalRow).toBeVisible();

		await originalRow.locator('[data-testid="prisma-category-settings-rename-button"]').click();

		const input = obsidian.page.locator('[data-testid="prisma-category-rename-input"]');
		await input.waitFor({ state: "visible" });
		await input.fill("Renamed");

		const modal = obsidian.page.locator(".prisma-calendar-category-rename-modal");
		const submit = modal.locator(".mod-cta").last();
		await submit.click();

		// Files on disk must carry the new category value.
		await expect.poll(() => evt1.readCategory()).toEqual(["Renamed"]);
		await expect.poll(() => evt2.readCategory()).toEqual(["Renamed"]);

		// The Categories settings list (driven by CategoryTracker, which sits
		// on top of the VaultTable cache we fixed) must reflect the new name.
		const renamedRow = obsidian.page.locator('[data-testid="prisma-category-settings-item"][data-category="Renamed"]');
		const staleRow = obsidian.page.locator('[data-testid="prisma-category-settings-item"][data-category="Renamable"]');

		await expect(renamedRow).toBeVisible();
		await expect(staleRow).toHaveCount(0);

		await closeSettings(obsidian.page);

		// Calendar tiles must still resolve to the rule color: both halves of
		// the rename (event frontmatter + color rule expression) must have
		// flowed through the event store for the match to hold. If EventStore
		// kept the old category, the rule no longer matches and --event-color
		// drops to empty/default.
		await evt1.expectColor(RULE_COLOR);
		await evt2.expectColor(RULE_COLOR);
	});
});
