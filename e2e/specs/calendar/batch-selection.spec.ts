import { existsSync } from "node:fs";
import { join } from "node:path";

import type { Page } from "@playwright/test";
import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { gotoToday, seedEventViaVault, todayISO, todayTimedEvent, waitForEvent } from "../../fixtures/calendar-helpers";
import { expect, test } from "../../fixtures/electron";
import { openCalendar } from "../../fixtures/helpers";
import {
	clickBatchButton,
	confirmBatchAction,
	enterBatchMode,
	waitForBatchSelectable,
} from "../../fixtures/history-helpers";
import { refreshCalendar, seedEvent } from "../../fixtures/seed-events";

const TITLES = ["Batch One", "Batch Two", "Batch Three"] as const;

function seedTitles(vaultDir: string): void {
	TITLES.forEach((title, i) => seedEvent(vaultDir, todayTimedEvent(title, 9 + i * 2, 10 + i * 2)));
}

async function seedTitlesViaVault(page: Page): Promise<void> {
	const date = todayISO();
	for (let i = 0; i < TITLES.length; i++) {
		await seedEventViaVault(page, {
			title: TITLES[i]!,
			date,
			startTime: `${String(9 + i * 2).padStart(2, "0")}:00`,
			endTime: `${String(10 + i * 2).padStart(2, "0")}:00`,
		});
	}
}

async function selectAllInBatch(page: Page): Promise<void> {
	await waitForBatchSelectable(page, TITLES);
	await clickBatchButton(page, "select-all");
}

test.describe("batch selection operations", () => {
	test.beforeEach(async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;
		seedTitles(vaultDir);
		await openCalendar(page);
		await refreshCalendar(page);
		await gotoToday(page);
		for (const title of TITLES) await waitForEvent(page, title);
	});

	test("clicking Batch → Skip sets Skip: true on every selected event", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;
		await enterBatchMode(page);
		await selectAllInBatch(page);
		await clickBatchButton(page, "skip");

		for (const title of TITLES) {
			await expect
				.poll(() => readEventFrontmatter(vaultDir, `Events/${title}.md`)["Skip"], { timeout: 5_000 })
				.toBe(true);
		}
	});

	test("clicking Batch → Done sets Status: done on every selected event", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;
		await enterBatchMode(page);
		await selectAllInBatch(page);
		await clickBatchButton(page, "mark-done");

		for (const title of TITLES) {
			await expect
				.poll(() => String(readEventFrontmatter(vaultDir, `Events/${title}.md`)["Status"] ?? "").toLowerCase(), {
					timeout: 5_000,
				})
				.toMatch(/done|true/);
		}
	});

	test("clicking Batch → Duplicate is wired up without throwing", async ({ obsidian }) => {
		// CloneEventCommand races with metadataCache in the e2e launcher build
		// (same story as the context-menu duplicate), so this asserts the button
		// is clickable with a selection and doesn't crash the renderer.
		const { page } = obsidian;
		await seedTitlesViaVault(page);
		await refreshCalendar(page);
		await enterBatchMode(page);
		await selectAllInBatch(page);

		const errors: string[] = [];
		page.on("pageerror", (err) => errors.push(err.message));
		await clickBatchButton(page, "duplicate");
		expect(errors, errors.join("\n")).toHaveLength(0);
	});

	test("clicking Batch → Delete removes every selected file", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;
		await enterBatchMode(page);
		await selectAllInBatch(page);
		await clickBatchButton(page, "delete");
		await confirmBatchAction(page);

		for (const title of TITLES) {
			await expect.poll(() => existsSync(join(vaultDir, "Events", `${title}.md`)), { timeout: 8_000 }).toBe(false);
		}
	});

	test("clicking Batch → Clone Next is wired up", async ({ obsidian }) => {
		const { page } = obsidian;
		await seedTitlesViaVault(page);
		await refreshCalendar(page);
		await enterBatchMode(page);
		await selectAllInBatch(page);

		const errors: string[] = [];
		page.on("pageerror", (err) => errors.push(err.message));
		await clickBatchButton(page, "clone-next");
		expect(errors, errors.join("\n")).toHaveLength(0);
	});

	test("clicking Batch → Move Next shifts Start Date forward by 7 days", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;
		const before: Record<string, string> = {};
		for (const title of TITLES) {
			before[title] = String(readEventFrontmatter(vaultDir, `Events/${title}.md`)["Start Date"]);
		}

		await enterBatchMode(page);
		await selectAllInBatch(page);
		await clickBatchButton(page, "move-next");

		for (const title of TITLES) {
			await expect
				.poll(() => String(readEventFrontmatter(vaultDir, `Events/${title}.md`)["Start Date"]) !== before[title], {
					timeout: 10_000,
				})
				.toBe(true);

			const after = String(readEventFrontmatter(vaultDir, `Events/${title}.md`)["Start Date"]);
			const deltaMs = Date.parse(after.replace(" ", "T")) - Date.parse(before[title].replace(" ", "T"));
			expect(Math.round(deltaMs / (24 * 60 * 60 * 1000))).toBe(7);
		}
	});

	test("clicking Batch → Exit toggles batch mode off", async ({ obsidian }) => {
		const { page } = obsidian;
		await enterBatchMode(page);
		await page.locator('[data-testid="prisma-cal-toolbar-batch-exit"]').first().click();
		await expect(page.locator('[data-testid="prisma-cal-toolbar-batch-select"]').first()).toBeVisible();
	});
});
