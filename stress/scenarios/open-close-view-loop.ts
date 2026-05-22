import type { Page } from "@playwright/test";

import { PLUGIN_ID } from "../../e2e/fixtures/constants";
import type { PrismaPlugin, PrismaWindow } from "../../e2e/fixtures/window-types";
import { openCalendarView } from "../../e2e/specs/events/events-helpers";

// Drives the calendar view's mount/unmount lifecycle for the memory-leak
// scenario. Opening reuses the real `activateCalendarView` path (via
// `openCalendarView`); closing detaches every calendar leaf — the same teardown
// Obsidian runs when a user closes the tab, firing the view's `onClose`. A leak
// shows up as heap that never returns after GC, or `activeViews > 0` afterwards.

/** Detach every calendar-view leaf (the real unmount path) and wait for them to clear. */
export async function closeCalendarLeaves(page: Page): Promise<void> {
	await page.evaluate((pid) => {
		const w = window as unknown as PrismaWindow;
		const plugin = w.app.plugins.plugins[pid] as PrismaPlugin | undefined;
		for (const bundle of plugin?.calendarBundles ?? []) {
			for (const leaf of w.app.workspace.getLeavesOfType(bundle.viewType)) leaf.detach();
		}
	}, PLUGIN_ID);
	await page.waitForFunction((pid) => {
		const w = window as unknown as PrismaWindow;
		const plugin = w.app.plugins.plugins[pid] as PrismaPlugin | undefined;
		return (plugin?.calendarBundles ?? []).every(
			(bundle) => w.app.workspace.getLeavesOfType(bundle.viewType).length === 0
		);
	}, PLUGIN_ID);
}

/** Open then fully close the calendar view `iterations` times. */
export async function openCloseViewLoop(page: Page, iterations: number): Promise<void> {
	for (let i = 0; i < iterations; i++) {
		await openCalendarView(page);
		await closeCalendarLeaves(page);
	}
}
