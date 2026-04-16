import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, type Page } from "@playwright/test";
import { executeCommand, listEventFiles } from "@real1ty-obsidian-plugins/testing/e2e";

import { openCalendarView } from "../../fixtures/helpers";
import { type EventModalInput, fillEventModal, saveEventModal } from "./fill-event-modal";

export const PLUGIN_ID = "prisma-calendar";

export const EVENT_MODAL_TITLE_SELECTOR = '[data-testid="prisma-event-field-title"]';

const NEW_FILE_POLL_INTERVAL_MS = 100;
const NEW_FILE_TIMEOUT_MS = 10_000;
const MODAL_WAIT_TIMEOUT_MS = 10_000;
const MODAL_CLOSE_TIMEOUT_MS = 5_000;
const CALENDAR_READY_SETTLE_MS = 150;

/** Subset of the Playwright fixture we need to drive the event-create flow. */
export interface ObsidianHandle {
	page: Page;
	vaultDir: string;
}

/** Snapshot the Events/ directory so we can diff the new files after a create. */
export function snapshotEventFiles(vaultDir: string): Set<string> {
	return new Set(listEventFiles(vaultDir, "Events"));
}

/**
 * Wait until the Events/ directory contains `count` more files than the
 * baseline, then return the relative paths of the newly created files.
 * Polls disk because `createEvent` resolves asynchronously — the modal close
 * is not a "file is on disk" signal.
 */
export async function waitForNewEventFiles(
	vaultDir: string,
	baseline: Set<string>,
	count = 1,
	timeoutMs = NEW_FILE_TIMEOUT_MS
): Promise<string[]> {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const current = listEventFiles(vaultDir, "Events");
		const added = current.filter((p) => !baseline.has(p));
		if (added.length >= count) {
			return added.map((absolute) => absolute.slice(vaultDir.length + 1));
		}
		if (Date.now() > deadline) {
			throw new Error(
				`timed out waiting for ${count} new event file(s); baseline=${baseline.size}, current=${current.length}, added=${added.length}`
			);
		}
		await new Promise((resolve) => setTimeout(resolve, NEW_FILE_POLL_INTERVAL_MS));
	}
}

/**
 * Wait for Obsidian's workspace to be layout-ready. Uses the documented
 * `onLayoutReady` callback rather than poking `getLeaf()` — calling getLeaf
 * with `false` actually creates a new leaf when none exists, which competes
 * with the plugin's own view-activation path and leaves the calendar without
 * an active bundle (so subsequent `prisma-calendar:create-event` no-ops).
 */
export async function waitForWorkspaceReady(page: Page): Promise<void> {
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => {
				const w = window as unknown as {
					app: {
						workspace: {
							layoutReady?: boolean;
							onLayoutReady: (cb: () => void) => void;
						};
					};
				};
				if (w.app.workspace.layoutReady) {
					resolve();
					return;
				}
				w.app.workspace.onLayoutReady(() => resolve());
			})
	);
}

/** Open the calendar view once the workspace is guaranteed interactive. */
export async function openCalendarReady(page: Page): Promise<void> {
	await waitForWorkspaceReady(page);
	await openCalendarView(page);
	await page.waitForTimeout(CALENDAR_READY_SETTLE_MS);
}

/**
 * Wait for the event modal's title field to attach and become visible. Shared
 * between the command-triggered create path and the drag-to-create path. On
 * attach timeout, dumps the open-modal HTML into the error so a future
 * React/DOM churn is diagnosable from the failure log alone.
 */
export async function waitForEventModalOpen(page: Page, timeoutMs = MODAL_WAIT_TIMEOUT_MS): Promise<void> {
	const title = page.locator(EVENT_MODAL_TITLE_SELECTOR);
	try {
		await title.waitFor({ state: "attached", timeout: timeoutMs });
	} catch (err) {
		const modalHtml = await page
			.locator(".modal")
			.first()
			.evaluate((el) => (el as HTMLElement).outerHTML.slice(0, 2_000))
			.catch(() => "<no .modal element>");
		throw new Error(`prisma-event-field-title never attached. Modal DOM:\n${modalHtml}\n\nOriginal: ${String(err)}`);
	}
	await title.waitFor({ state: "visible", timeout: timeoutMs });
}

/**
 * Execute the create-event command and wait for the modal to become visible.
 * Mirrors the passing `event-create.spec.ts` flow: the shared `executeCommand`
 * includes a 200ms post-execute settle, then we wait for the generic `.modal`
 * class before narrowing to the stamped testid.
 */
export async function openCreateModal(page: Page): Promise<void> {
	const executed = await executeCommand(page, "prisma-calendar:create-event");
	expect(executed).toBe(true);
	await page.locator(".modal").first().waitFor({ state: "visible", timeout: MODAL_WAIT_TIMEOUT_MS });
	await waitForEventModalOpen(page, MODAL_WAIT_TIMEOUT_MS);
}

/**
 * Wait for the event modal to close (the event modal specifically — the
 * generic `.modal` count can go non-zero due to notices, Obsidian's internal
 * overlays, or the confirmation prompts Prisma shows post-save, which would
 * otherwise race with this wait).
 */
export async function waitForModalClosed(page: Page, timeoutMs = MODAL_CLOSE_TIMEOUT_MS): Promise<void> {
	await page.waitForFunction(
		(selector) => document.querySelectorAll(selector).length === 0,
		EVENT_MODAL_TITLE_SELECTOR,
		{ timeout: timeoutMs }
	);
}

/** Read the raw YAML frontmatter block from an absolute file path. */
export function readRawFrontmatter(absolutePath: string): string {
	const raw = readFileSync(absolutePath, "utf8");
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	return match ? match[1]! : "";
}

/** Read the raw frontmatter of a single vault file relative to the vault root. */
export function readRawFrontmatterFromVault(vaultDir: string, relativePath: string): string {
	return readRawFrontmatter(join(vaultDir, relativePath));
}

/** Format a Date as `YYYY-MM-DD` in local time (matches what the modal accepts). */
export function formatLocalDate(date: Date): string {
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

/**
 * Full create flow: snapshot baseline → open create modal → fill fields →
 * save → wait for modal close → wait for the new file on disk. Returns the
 * relative path of the created event.
 */
export async function createEventViaModal(obsidian: ObsidianHandle, input: EventModalInput): Promise<string> {
	const baseline = snapshotEventFiles(obsidian.vaultDir);
	await openCreateModal(obsidian.page);
	await fillEventModal(obsidian.page, input);
	await saveEventModal(obsidian.page);
	await waitForModalClosed(obsidian.page);
	const [relativePath] = await waitForNewEventFiles(obsidian.vaultDir, baseline, 1);
	if (!relativePath) throw new Error("createEventViaModal: no new event file appeared");
	return relativePath;
}
