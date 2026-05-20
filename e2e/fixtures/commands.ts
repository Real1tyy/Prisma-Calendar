import type { Page } from "@playwright/test";

import { PLUGIN_ID } from "./constants";
import type { PrismaPlugin, PrismaWindow } from "./window-types";

// Run a registered command via Obsidian's command palette — Ctrl/Cmd+P, type,
// Enter. Exercises the real user path: many Prisma commands expose no toolbar
// button at all (ICS export/import, focus expression filter, open filter
// preset selector, highlight commands, add zettel id) and the palette is the
// only UI entry point. See feedback_e2e_click_buttons.md — palette typing is
// the sanctioned fallback for commands that genuinely lack a button.

export async function runCommand(page: Page, commandName: string): Promise<void> {
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

/**
 * Wait until the default bundle's command manager has no more queued or
 * in-flight work. Use after firing the "Prisma Calendar: Undo" / "...: Redo"
 * palette command — those callbacks are registered as `void undo(plugin)` so
 * the palette closes (and `runCommand` resolves) before the undo actually
 * completes. Counts can also be invariant across the mutation (a batch move
 * doesn't change `eventStore.length`), so `waitForIndexerToReach` alone is
 * not enough of a gate. `CommandManager.whenIdle()` drains both kinds of
 * pending work.
 */
export async function waitForCommandManagerIdle(page: Page): Promise<void> {
	await page.evaluate(async (pid) => {
		const w = window as unknown as PrismaWindow;
		const plugin = w.app.plugins.plugins[pid] as PrismaPlugin | undefined;
		const bundle = plugin?.calendarBundles?.[0];
		await bundle?.commandManager.whenIdle();
	}, PLUGIN_ID);
}
