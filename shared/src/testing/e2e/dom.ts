import type { Page } from "@playwright/test";

// Cross-cutting renderer helpers. Plugin-agnostic: no plugin ids, no
// plugin-specific test-id prefixes. Plugin-specific helpers (activating a
// view, switching tabs by stamped test-id) live in each plugin's own e2e dir.

/**
 * Ensure no modal is currently blocking the workspace. Any visible `.modal`
 * is dismissed via its close button or Escape. Useful at test start to clear
 * a stray "What's new" / error modal before driving the UI.
 */
export async function waitForNoModal(page: Page): Promise<void> {
	const modal = page.locator(".modal-container .modal").first();
	const count = await modal.count();
	if (count === 0) return;
	const closeBtn = modal.locator(".modal-close-button").first();
	if ((await closeBtn.count()) > 0) {
		await closeBtn.click().catch(() => {});
	} else {
		await page.keyboard.press("Escape").catch(() => {});
	}
	await page
		.locator(".modal-container .modal")
		.waitFor({ state: "hidden", timeout: 5_000 })
		.catch(() => {});
}

/** Dismiss the topmost Obsidian Notice (if any) so screenshots stay clean. */
export async function dismissNotice(page: Page): Promise<void> {
	const notice = page.locator(".notice").first();
	if ((await notice.count()) > 0) {
		await notice.click().catch(() => {});
	}
}

/** Return the text of the most recently rendered Obsidian Notice, or null. */
export async function getLastNotice(page: Page): Promise<string | null> {
	const notice = page.locator(".notice").last();
	if ((await notice.count()) === 0) return null;
	return (await notice.textContent())?.trim() ?? null;
}

/**
 * Dispatch a hotkey chord using Obsidian's portable modifier: `Mod+<key>` picks
 * `Meta` on macOS and `Control` elsewhere. Pass the literal combo as shown in
 * Obsidian's hotkey settings (e.g. `Mod+P`).
 */
export async function dispatchKey(page: Page, combo: string): Promise<void> {
	const isMac = process.platform === "darwin";
	const resolved = combo.replace(/\bMod\b/g, isMac ? "Meta" : "Control");
	await page.keyboard.press(resolved);
}
