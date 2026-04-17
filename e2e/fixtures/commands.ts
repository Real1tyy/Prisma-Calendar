import type { Page } from "@playwright/test";

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
