import type { Page } from "@playwright/test";
import { readEventFrontmatter, setTextInput, settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { PLUGIN_ID } from "../../fixtures/constants";
import { expect, testWithSeededFiles as test } from "../../fixtures/electron";
import {
	addCalendar,
	closeSettings,
	openPrismaSettings,
	selectCalendarInSettings,
	setSchemaDropdown,
	switchSettingsTab,
} from "../../fixtures/helpers";
import { refreshCalendar, seedEvent, waitForEventCount } from "../../fixtures/seed-events";

// Production has a 3s debounce on directory-bind / propagation (see
// changelog 2.16). Under tests `window.E2E === true` flips those to 0 via
// debounceMsForEnv, so we don't need to sprinkle waitForTimeout calls —
// settings flow through immediately.
const EXPECTED_SORT_DATE = "2026-01-15T10:00:00";

// Reproduces the "two planning systems pointing at the same directory with
// conflicting sort normalization" incident: the first calendar wrote a
// normalized Sort Date on every parse, the second (default strategy=none)
// used to delete it, and they thrashed each other to the point of corrupting
// the IndexedDB cache. After the fix:
//   - The runtime guard suppresses both calendars' sort-date writes when a
//     conflict is detected (no oscillation possible).
//   - The settings UI shows a banner pointing at the offending calendar by
//     name on both sides of the conflict.
//   - Disabling/aligning one calendar clears the banner.
//
// We don't seed events in this spec — the conflict and its banner are a
// settings-state property, not a per-file property.

const SHARED_DIR = "Tasks";
const CONFLICT_BANNER = '[data-testid^="prisma-normalization-conflict-"]';

async function setDirectory(page: Page, directory: string): Promise<void> {
	await switchSettingsTab(page, "general");
	await setTextInput(page, "prisma-settings-control-directory", directory);
	await settleSettings(page, { pluginId: PLUGIN_ID });
}

async function setSortingStrategy(page: Page, strategy: string): Promise<void> {
	await switchSettingsTab(page, "properties");
	await setSchemaDropdown(page, "sortingStrategy", strategy);
	await settleSettings(page, { pluginId: PLUGIN_ID });
}

function bannerFor(page: Page, calendarId: string) {
	return page.locator(`[data-testid="prisma-normalization-conflict-${calendarId}"]`);
}

test.describe("sort normalization conflict between calendars", () => {
	test("two calendars sharing a directory with different strategies surface the warning banner", async ({
		obsidian,
	}) => {
		const { page } = obsidian;

		// Calendar 1: shared directory + writing strategy ⇒ no conflict yet.
		await openPrismaSettings(page);
		await setDirectory(page, SHARED_DIR);
		await setSortingStrategy(page, "allStartDate");
		await expect(page.locator(CONFLICT_BANNER)).toHaveCount(0);

		// Calendar 2: same directory, default strategy "none" — the (writer +
		// non-writer) pair is the exact conflict the user hit in production.
		const secondId = await addCalendar(page, obsidian.vaultDir);
		await selectCalendarInSettings(page, secondId);
		await setDirectory(page, SHARED_DIR);

		// Both sides of the conflict get the warning banner.
		await expect(bannerFor(page, secondId)).toBeVisible();
		await selectCalendarInSettings(page, "default");
		await expect(bannerFor(page, "default")).toBeVisible();

		// Aligning the second calendar's strategy clears the banner on both sides.
		await selectCalendarInSettings(page, secondId);
		await setSortingStrategy(page, "allStartDate");
		await expect(page.locator(CONFLICT_BANNER)).toHaveCount(0);

		await selectCalendarInSettings(page, "default");
		await expect(page.locator(CONFLICT_BANNER)).toHaveCount(0);

		await closeSettings(page);
	});

	test("conflict banner names the offending peer, shared directory, and explains the pause", async ({ obsidian }) => {
		const { page } = obsidian;

		// Calendar 1 writes; default-strategy peer (none) is added in the same
		// directory, which is the exact (writer + non-writer) pair the user hit.
		await openPrismaSettings(page);
		await setDirectory(page, SHARED_DIR);
		await setSortingStrategy(page, "allStartDate");

		const secondId = await addCalendar(page, obsidian.vaultDir);
		await selectCalendarInSettings(page, secondId);
		await setDirectory(page, SHARED_DIR);

		// Each side of the conflict shows a banner that names the OTHER calendar,
		// names the shared directory, and explains that sort-date writes are paused.
		await expect(bannerFor(page, secondId)).toBeVisible();
		await expect(bannerFor(page, secondId)).toContainText(SHARED_DIR);
		await expect(bannerFor(page, secondId)).toContainText(/sort date writes are paused/i);
		await expect(bannerFor(page, secondId)).toContainText(/Conflicts with /);

		await selectCalendarInSettings(page, "default");
		await expect(bannerFor(page, "default")).toBeVisible();
		await expect(bannerFor(page, "default")).toContainText(SHARED_DIR);
		await expect(bannerFor(page, "default")).toContainText(/sort date writes are paused/i);
		await expect(bannerFor(page, "default")).toContainText(/Conflicts with /);

		// Aligning the peer's strategy resolves the conflict — banner clears.
		await selectCalendarInSettings(page, secondId);
		await setSortingStrategy(page, "allStartDate");
		await expect(page.locator(CONFLICT_BANNER)).toHaveCount(0);

		await closeSettings(page);
	});

	// End-to-end proof of the runtime guard at the disk level: the same
	// (writer + strategy=none) configuration that previously thrashed Sort
	// Date on every parse must leave it untouched while the conflict is
	// active, then resume normalizing once the strategies align.
	test("sort date stays untouched on disk while the conflict is active and resumes after alignment", async ({
		obsidian,
	}) => {
		const { page } = obsidian;

		// Configure the writing calendar BEFORE seeding so the indexer is ready
		// to pick the file up on its first pass. (Production has a 3s directory-
		// bind debounce; under E2E it's flipped to 0 — see debounceMsForEnv.)
		await openPrismaSettings(page);
		await setDirectory(page, SHARED_DIR);
		await setSortingStrategy(page, "allStartDate");
		await closeSettings(page);

		const eventPath = seedEvent(obsidian.vaultDir, {
			title: "Project Planning",
			startDate: "2026-01-15 10:00",
			endDate: "2026-01-15 11:00",
			subdir: SHARED_DIR,
		});
		await refreshCalendar(page);
		await waitForEventCount(page, 1);

		// Sanity: the lone writer normalizes Sort Date from Start Date.
		await expect
			.poll(() => readEventFrontmatter(obsidian.vaultDir, eventPath)["Sort Date"], {
				message: "single-calendar writer must normalize Sort Date from Start Date",
				timeout: 20_000,
			})
			.toBe(EXPECTED_SORT_DATE);
		const writtenSortDate = readEventFrontmatter(obsidian.vaultDir, eventPath)["Sort Date"];

		// Add the conflicting peer (default strategy = none) sharing the directory.
		// The runtime guard must freeze BOTH calendars' sort-date writes; the
		// previously-written value must remain untouched, no oscillation.
		await openPrismaSettings(page);
		const secondId = await addCalendar(page, obsidian.vaultDir);
		await selectCalendarInSettings(page, secondId);
		await setDirectory(page, SHARED_DIR);
		await closeSettings(page);
		await refreshCalendar(page);
		await refreshCalendar(page);

		expect(readEventFrontmatter(obsidian.vaultDir, eventPath)["Sort Date"]).toBe(writtenSortDate);

		// Align the peer's strategy → conflict clears. Existing Sort Date is
		// still intact, AND a fresh event seeded post-alignment must be
		// normalized: the runtime guard has flipped back off and writes resume.
		await openPrismaSettings(page);
		await selectCalendarInSettings(page, secondId);
		await setSortingStrategy(page, "allStartDate");
		await expect(page.locator(CONFLICT_BANNER)).toHaveCount(0);
		await closeSettings(page);
		await refreshCalendar(page);
		expect(readEventFrontmatter(obsidian.vaultDir, eventPath)["Sort Date"]).toBe(writtenSortDate);

		const secondExpectedSortDate = "2026-02-10T14:30:00";
		const secondEventPath = seedEvent(obsidian.vaultDir, {
			title: "Team Review",
			startDate: "2026-02-10 14:30",
			endDate: "2026-02-10 15:30",
			subdir: SHARED_DIR,
		});
		await refreshCalendar(page);
		await waitForEventCount(page, 2);
		await expect
			.poll(() => readEventFrontmatter(obsidian.vaultDir, secondEventPath)["Sort Date"], {
				message: "writes must resume on fresh events once strategies align",
				timeout: 20_000,
			})
			.toBe(secondExpectedSortDate);
	});
});
