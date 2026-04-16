import type { Page } from "@playwright/test";

import type { ObsidianWindow } from "./types";

// Action helpers that run against the Obsidian renderer (`window.app`).
// Keep them generic — plugin-specific helpers belong in the plugin's own e2e dir.
// All casts go through the shared `ObsidianWindow` type so the shape lives in
// one place (shared/src/testing/e2e/types.ts) instead of being re-declared per
// helper.

/** Execute an Obsidian command by ID. Yields to the event loop so async side effects settle. */
export async function executeCommand(page: Page, commandId: string): Promise<boolean> {
	return page.evaluate(async (id) => {
		const w = window as unknown as ObsidianWindow;
		const ok = w.app.commands.executeCommandById(id);
		await new Promise((resolve) => setTimeout(resolve, 200));
		return ok;
	}, commandId);
}

/** Open a note by vault-relative link (no leading slash, no `.md` suffix). */
export async function openNote(page: Page, linkText: string): Promise<void> {
	await page.evaluate(async (link) => {
		const w = window as unknown as ObsidianWindow;
		await w.app.workspace.openLinkText(link, "", false);
	}, linkText);
}

/** Open Settings → specific plugin tab (e.g. "prisma-calendar"). */
export async function openSettingsTab(page: Page, tabId: string): Promise<void> {
	await page.evaluate((id) => {
		const w = window as unknown as ObsidianWindow;
		w.app.setting.open();
		w.app.setting.openTabById(id);
	}, tabId);
}

/** Whether a plugin is currently loaded (enabled and initialized). */
export async function isPluginLoaded(page: Page, pluginId: string): Promise<boolean> {
	return page.evaluate((id) => {
		const w = window as unknown as ObsidianWindow;
		return Boolean(w.app.plugins?.plugins?.[id]);
	}, pluginId);
}

/** Count the registered commands whose IDs start with `${pluginId}:`. */
export async function countPluginCommands(page: Page, pluginId: string): Promise<number> {
	return page.evaluate((id) => {
		const w = window as unknown as ObsidianWindow;
		const commands = w.app.commands.commands ?? {};
		return Object.keys(commands).filter((commandId) => commandId.startsWith(`${id}:`)).length;
	}, pluginId);
}
