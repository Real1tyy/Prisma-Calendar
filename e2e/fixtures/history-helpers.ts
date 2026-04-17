// Additive helpers for the undo/redo history specs. Main's
// `fixtures/helpers.ts` already covers open-ribbon / create-event / right-click
// / context-menu / modal-save flows — this file only adds the pieces those
// helpers don't have yet:
//
//   - batch-selection toolbar (enter, exit, toggle event, click action button,
//     confirm destructive modal)
//   - undo / redo via the command palette (no ribbon button exists for these)
//   - disk-level waiters for frontmatter / existence / count assertions
//
// If any of these grow to be reused outside `specs/history/`, hoist them into
// `fixtures/helpers.ts` and delete the duplicate here.

import { expect, type Page } from "@playwright/test";
import { listEventFiles, readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { openCreateModal, snapshotEventFiles, waitForNewEventFiles } from "../specs/events/events-helpers";
import { fillEventModal, saveEventModal } from "../specs/events/fill-event-modal";

const ACTIVE_CALENDAR_LEAF = ".workspace-leaf.mod-active";

const BATCH_SELECT_BUTTON = `${ACTIVE_CALENDAR_LEAF} [data-testid="prisma-cal-toolbar-batch-select"]`;
const BATCH_EXIT_BUTTON = `${ACTIVE_CALENDAR_LEAF} [data-testid="prisma-cal-toolbar-batch-exit"]`;
const BATCH_COUNTER = `${ACTIVE_CALENDAR_LEAF} [data-testid="prisma-cal-batch-counter"]`;
const BATCH_CONFIRM_SUBMIT = '[data-testid="prisma-batch-confirm-submit"]';

/**
 * Create a single event via the toolbar → modal flow and return its
 * vault-relative path. Consolidates the snapshot+fill+save+diff pattern that
 * every history spec needs. Each call seeds exactly one file with a unique
 * title — passing duplicate titles across calls confuses the right-click
 * locators in follow-up assertions.
 */
export async function createEventViaToolbar(
	page: Page,
	vaultDir: string,
	input: { title: string; start: string; end: string; allDay?: boolean }
): Promise<string> {
	const baseline = snapshotEventFiles(vaultDir);
	await openCreateModal(page);
	await fillEventModal(page, input);
	await saveEventModal(page);
	const [newPath] = await waitForNewEventFiles(vaultDir, baseline);
	return newPath!;
}

export async function enterBatchMode(page: Page): Promise<void> {
	await page.locator(BATCH_SELECT_BUTTON).first().click();
	await page.locator(BATCH_COUNTER).first().waitFor({ state: "visible" });
}

export async function exitBatchMode(page: Page): Promise<void> {
	const exit = page.locator(BATCH_EXIT_BUTTON).first();
	if (await exit.isVisible().catch(() => false)) {
		await exit.click();
	}
}

/** Click an event (by title) while in batch mode — toggles its selection. */
export async function toggleEventInBatch(page: Page, title: string): Promise<void> {
	const event = page
		.locator(`${ACTIVE_CALENDAR_LEAF} [data-testid="prisma-cal-event"][data-event-title="${title}"]`)
		.first();
	await event.waitFor({ state: "visible" });
	await event.click();
}

/** Click a batch-mode toolbar action button by its stamped suffix. */
export async function clickBatchButton(page: Page, suffix: string): Promise<void> {
	const btn = page.locator(`${ACTIVE_CALENDAR_LEAF} [data-testid="prisma-cal-batch-${suffix}"]`).first();
	await btn.waitFor({ state: "visible" });
	await btn.click();
}

/** Confirm the destructive-action modal (currently only batch delete). */
export async function confirmBatchAction(page: Page): Promise<void> {
	const confirm = page.locator(BATCH_CONFIRM_SUBMIT).first();
	await confirm.waitFor({ state: "visible" });
	await confirm.click();
	await confirm.waitFor({ state: "hidden" });
}

/**
 * Run a plugin command through the command palette — Ctrl+P, type, Enter.
 * Exactly how a user triggers `Prisma Calendar: Undo` / `Redo`: the plugin
 * exposes no toolbar button for these.
 */
export async function runCommandFromPalette(page: Page, commandName: string): Promise<void> {
	const isMac = process.platform === "darwin";
	await page.keyboard.press(isMac ? "Meta+P" : "Control+P");
	const input = page.locator(".prompt-input").first();
	await input.waitFor({ state: "visible" });
	await input.fill(commandName);
	await page.locator(".suggestion-item").first().waitFor({ state: "visible" });
	await page.keyboard.press("Enter");
	await page
		.locator(".prompt-input")
		.first()
		.waitFor({ state: "hidden" })
		.catch(() => {});
}

export async function undoViaPalette(page: Page, times = 1): Promise<void> {
	for (let i = 0; i < times; i++) await runCommandFromPalette(page, "Prisma Calendar: Undo");
}

export async function redoViaPalette(page: Page, times = 1): Promise<void> {
	for (let i = 0; i < times; i++) await runCommandFromPalette(page, "Prisma Calendar: Redo");
}

// ── Disk waiters ─────────────────────────────────────────────────────────
// Assertions against persisted state must read the vault, not the DOM: the
// metadata cache lags file writes and FC event state is not authoritative.

export async function waitForEventFileCount(vaultDir: string, n: number): Promise<void> {
	await expect.poll(() => listEventFiles(vaultDir).length, { message: `expected ${n} event files` }).toBe(n);
}

export async function waitForFrontmatter(
	vaultDir: string,
	filePath: string,
	key: string,
	matcher: (v: unknown) => boolean
): Promise<void> {
	await expect
		.poll(() => matcher(readEventFrontmatter(vaultDir, filePath)[key]), {
			message: `frontmatter ${key} did not match in ${filePath}`,
		})
		.toBe(true);
}

export async function waitForFileExists(vaultDir: string, filePath: string, shouldExist: boolean): Promise<void> {
	await expect
		.poll(() => listEventFiles(vaultDir).some((abs) => abs.endsWith(`/${filePath}`)), {
			message: `${filePath} existence != ${shouldExist}`,
		})
		.toBe(shouldExist);
}

/** ISO local string for a date N days ahead at the given HH:mm. */
export function isoLocal(daysFromToday: number, hh = 10, mm = 0): string {
	const d = new Date();
	d.setDate(d.getDate() + daysFromToday);
	d.setHours(hh, mm, 0, 0);
	const pad = (n: number): string => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
