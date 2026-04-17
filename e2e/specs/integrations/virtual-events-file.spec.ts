import type { Page } from "@playwright/test";

import { runCommand } from "../../fixtures/commands";
import { expect, test } from "../../fixtures/electron";

// The "Open virtual events file" command is per-bundle. VirtualEventStore
// auto-creates `Events/Virtual Events.md` on plugin init
// (`createIfMissing: true` in store.bind), so the "file not found" branch in
// calendar-bundle.ts:194 is only reachable if the user manually deletes the
// file — not a realistic flow to smoke-test here. We verify the happy path:
// the command activates the file in the workspace.

const VIRTUAL_EVENTS_PATH = "Events/Virtual Events.md";

function activeFilePath(page: Page): Promise<string | null> {
	return page.evaluate(() => {
		const w = window as unknown as {
			app: { workspace: { getActiveFile: () => { path: string } | null } };
		};
		return w.app.workspace.getActiveFile()?.path ?? null;
	});
}

test("virtual events: command opens the auto-created file", async ({ obsidian }) => {
	await runCommand(obsidian.page, "Prisma Calendar: Open virtual events file (Main Calendar)");
	await expect.poll(() => activeFilePath(obsidian.page)).toBe(VIRTUAL_EVENTS_PATH);
});
