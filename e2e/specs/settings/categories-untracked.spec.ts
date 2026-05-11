import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import { closeSettings, openPrismaSettings, switchSettingsTab } from "../../fixtures/helpers";
import { refreshCalendar } from "../../fixtures/seed-events";

// "Untracked events" are notes that carry a category in frontmatter but have
// no Start Date / End Date / Date — they live in `UntrackedEventStore`, not
// `EventStore`.
// This spec drives the user-visible flow end-to-end: seed an untracked file
// with a unique category, open the Categories settings tab, then run rename
// and delete with the "Also apply to untracked events" toggle ticked. The
// spec asserts on disk that the untracked file's frontmatter is rewritten.

const UNTRACKED_PATH = "Events/untracked-category-target.md";

function seedUntrackedFile(vaultDir: string, category: string, title = "Untracked Note"): string {
	const content = `---\nCategory: ${category}\n---\n\n# ${title}\n`;
	writeFileSync(join(vaultDir, UNTRACKED_PATH), content, "utf8");
	return UNTRACKED_PATH;
}

test.describe("settings: Categories operations on untracked events", () => {
	test("untracked-only category appears in the list with proper counts", async ({ calendar, obsidian }) => {
		const { vaultDir, page } = calendar;
		seedUntrackedFile(vaultDir, "OnlyUntracked");
		await refreshCalendar(page);

		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "categories");

		const row = obsidian.page.locator('[data-testid="prisma-category-settings-item"][data-category="OnlyUntracked"]');
		await expect(row).toBeVisible();

		// The count line must reflect the untracked event — total = 1, untracked = 1,
		const countText = await row.locator(".prisma-category-settings-count").textContent();
		expect(countText).toContain("1 total");
		expect(countText).toContain("1 untracked");

		await closeSettings(obsidian.page);
	});

	test("renaming includes untracked events when the checkbox is left checked", async ({ calendar, obsidian }) => {
		const { vaultDir, page } = calendar;
		const relativePath = seedUntrackedFile(vaultDir, "RenameMe");
		await refreshCalendar(page);

		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "categories");

		const row = obsidian.page.locator('[data-testid="prisma-category-settings-item"][data-category="RenameMe"]');
		await expect(row).toBeVisible();
		await row.locator('[data-testid="prisma-category-settings-rename-button"]').click();

		// The toggle defaults to ON — surface it and confirm the default state.
		const toggle = obsidian.page.locator('[data-testid="prisma-category-include-untracked-toggle"]');
		await expect(toggle).toBeVisible();
		await expect(toggle).toBeChecked();

		const input = obsidian.page.locator('[data-testid="prisma-category-rename-input"]');
		await input.waitFor({ state: "visible" });
		await input.fill("RenamedFromUntracked");
		await obsidian.page.locator('[data-testid="prisma-category-rename-submit"]').click();

		await expect
			.poll(() => readEventFrontmatter(vaultDir, relativePath)["Category"], {
				message: "untracked file Category should rewrite to the new name",
			})
			.toBe("RenamedFromUntracked");

		await closeSettings(obsidian.page);
	});

	test("deleting includes untracked events when the checkbox is left checked", async ({ calendar, obsidian }) => {
		const { vaultDir, page } = calendar;
		const relativePath = seedUntrackedFile(vaultDir, "DeleteMe");
		await refreshCalendar(page);

		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "categories");

		const row = obsidian.page.locator('[data-testid="prisma-category-settings-item"][data-category="DeleteMe"]');
		await expect(row).toBeVisible();
		await row.locator('[data-testid="prisma-category-settings-delete-button"]').click();

		const toggle = obsidian.page.locator('[data-testid="prisma-category-include-untracked-toggle"]');
		await expect(toggle).toBeVisible();
		await expect(toggle).toBeChecked();

		await obsidian.page.locator('[data-testid="prisma-category-delete-confirmation-modal-confirm"]').click();

		await expect
			.poll(() => readEventFrontmatter(vaultDir, relativePath)["Category"], {
				message: "untracked file Category should be removed",
			})
			.toBeUndefined();

		await closeSettings(obsidian.page);
	});

	test("unchecking the toggle leaves untracked frontmatter intact", async ({ calendar, obsidian }) => {
		const { vaultDir, page } = calendar;
		const relativePath = seedUntrackedFile(vaultDir, "KeepUntracked");
		await refreshCalendar(page);

		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "categories");

		const row = obsidian.page.locator('[data-testid="prisma-category-settings-item"][data-category="KeepUntracked"]');
		await expect(row).toBeVisible();
		await row.locator('[data-testid="prisma-category-settings-rename-button"]').click();

		// Uncheck the toggle: the rename should target only tracked files. With
		// no tracked files in scope, the on-disk frontmatter must stay intact.
		await obsidian.page.locator('[data-testid="prisma-category-include-untracked-toggle"]').uncheck();
		await obsidian.page.locator('[data-testid="prisma-category-rename-input"]').fill("DidNotRename");
		await obsidian.page.locator('[data-testid="prisma-category-rename-submit"]').click();

		// Wait briefly for any pending writes; then assert the untracked file is unchanged.
		await obsidian.page.waitForTimeout(500);
		expect(readEventFrontmatter(vaultDir, relativePath)["Category"]).toBe("KeepUntracked");

		await closeSettings(obsidian.page);
	});
});
