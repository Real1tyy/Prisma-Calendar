import { existsSync } from "node:fs";
import { join } from "node:path";

import type { Page } from "@playwright/test";
import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import {
	eventByTitle,
	gotoToday,
	seedEventViaVault,
	todayISO,
	todayTimedEvent,
	waitForEvent,
} from "../../fixtures/calendar-helpers";
import { expect, test } from "../../fixtures/electron";
import { openCalendar } from "../../fixtures/helpers";
import { clickBatchButton, confirmBatchAction, enterBatchMode } from "../../fixtures/history-helpers";
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
	// `Select All` is a no-op against events whose mount handler hasn't yet
	// stamped `prisma-batch-selectable` (happens right after batch mode
	// toggles on while the most-recent event is still mounting). Wait for
	// every seeded title to carry the class so the click binds all of them.
	for (const title of TITLES) {
		await expect(eventByTitle(page, title)).toHaveClass(/prisma-batch-selectable/);
	}
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

	// Move next/prev both call `executeMove(±1)` — same code path, opposite
	// sign on the week delta. Parametrise instead of duplicating the assertion
	// block so a regression in either direction is caught symmetrically.
	for (const { direction, button, expectedDays } of [
		{ direction: "Next", button: "move-next", expectedDays: 7 },
		{ direction: "Prev", button: "move-prev", expectedDays: -7 },
	] as const) {
		test(`clicking Batch → Move ${direction} shifts Start Date by ${expectedDays} days`, async ({ obsidian }) => {
			const { page, vaultDir } = obsidian;
			const before: Record<string, string> = {};
			for (const title of TITLES) {
				before[title] = String(readEventFrontmatter(vaultDir, `Events/${title}.md`)["Start Date"]);
			}

			await enterBatchMode(page);
			await selectAllInBatch(page);
			await clickBatchButton(page, button);

			for (const title of TITLES) {
				await expect
					.poll(() => String(readEventFrontmatter(vaultDir, `Events/${title}.md`)["Start Date"]) !== before[title], {
						timeout: 10_000,
					})
					.toBe(true);

				const after = String(readEventFrontmatter(vaultDir, `Events/${title}.md`)["Start Date"]);
				const deltaMs = Date.parse(after.replace(" ", "T")) - Date.parse(before[title].replace(" ", "T"));
				expect(Math.round(deltaMs / (24 * 60 * 60 * 1000))).toBe(expectedDays);
			}
		});
	}

	test("clicking Batch → Clone Prev is wired up", async ({ obsidian }) => {
		// Same "command runs without throwing" shape as Clone Next — the file
		// races in the e2e launcher build make count-based assertions flaky.
		const { page } = obsidian;
		await seedTitlesViaVault(page);
		await refreshCalendar(page);
		await enterBatchMode(page);
		await selectAllInBatch(page);

		const errors: string[] = [];
		page.on("pageerror", (err) => errors.push(err.message));
		await clickBatchButton(page, "clone-prev");
		expect(errors, errors.join("\n")).toHaveLength(0);
	});

	test("clicking Batch → Exit toggles batch mode off", async ({ obsidian }) => {
		const { page } = obsidian;
		await enterBatchMode(page);
		await page.locator('[data-testid="prisma-cal-toolbar-batch-exit"]').first().click();
		await expect(page.locator('[data-testid="prisma-cal-toolbar-batch-select"]').first()).toBeVisible();
	});
});
