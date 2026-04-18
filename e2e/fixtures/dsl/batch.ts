import type { Page } from "@playwright/test";

import { ACTIVE_CALENDAR_LEAF } from "../constants";
import { type BatchBtnKey, sel, TID } from "../testids";
import type { EventHandle } from "./event";

// BatchHandle — a short-lived wrapper around a batch-selection session.
// Instantiated with a list of EventHandles, enters batch mode, toggles each
// into selection. `.do(action)` fires a batch button; `.confirm()` accepts
// the destructive-action modal; `.exit()` returns to normal mode.
//
// Lifecycle is manual (rather than try/finally) so specs can interleave
// assertions before exiting. `batchActionRoundTrip` in templates.ts wraps the
// full enter → do → exit cycle for the common case.

export interface BatchHandle {
	do(action: BatchBtnKey): Promise<void>;
	confirm(): Promise<void>;
	exit(): Promise<void>;
}

const BATCH_SELECT_BTN = `${ACTIVE_CALENDAR_LEAF} ${sel(TID.toolbar("batch-select"))}`;
const BATCH_EXIT_BTN = `${ACTIVE_CALENDAR_LEAF} ${sel(TID.toolbar("batch-exit"))}`;
const BATCH_COUNTER = `${ACTIVE_CALENDAR_LEAF} ${sel(TID.batchCounter)}`;

/**
 * Enter batch mode, toggle each given event into selection, return a handle
 * on the active session. Assumes every event is currently rendered in the
 * active calendar leaf.
 */
export async function openBatch(page: Page, events: readonly EventHandle[]): Promise<BatchHandle> {
	await page.locator(BATCH_SELECT_BTN).first().click();
	await page.locator(BATCH_COUNTER).first().waitFor({ state: "visible" });

	for (const e of events) {
		const block = page.locator(`${ACTIVE_CALENDAR_LEAF} ${sel(TID.block)}[data-event-title="${e.title}"]`).first();
		await block.waitFor({ state: "visible" });
		await block.click();
	}

	return {
		async do(action) {
			const btn = page.locator(`${ACTIVE_CALENDAR_LEAF} ${sel(TID.batch(action))}`).first();
			await btn.waitFor({ state: "visible" });
			await btn.click();
		},

		async confirm() {
			const confirm = page.locator(sel(TID.batchConfirm)).first();
			await confirm.waitFor({ state: "visible" });
			await confirm.click();
			await confirm.waitFor({ state: "hidden" });
		},

		async exit() {
			const exit = page.locator(BATCH_EXIT_BTN).first();
			if (await exit.isVisible().catch(() => false)) await exit.click();
		},
	};
}
