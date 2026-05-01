import type { Page } from "@playwright/test";

import { DEFAULT_CALENDAR_ID, PLUGIN_ID } from "../../fixtures/constants";
import { expect, test } from "../../fixtures/electron";

// The "Open virtual events file" command is per-bundle. VirtualEventStore
// auto-creates `Events/Virtual Events.md` on plugin init
// (`createIfMissing: true` in store.bind), so the "file not found" branch in
// calendar-bundle.ts:194 is only reachable if the user manually deletes the
// file — not a realistic flow to smoke-test here. We verify the happy path:
// the command activates the file in the workspace.
//
// Uses executeCommandById instead of the command palette to avoid palette-UI
// index races — same pattern as `openCalendarView` in fixtures/helpers.ts.

const VIRTUAL_EVENTS_PATH = "Events/Virtual Events.md";

function activeFilePath(page: Page): Promise<string | null> {
	return page.evaluate(() => {
		const w = window as unknown as {
			app: { workspace: { getActiveFile: () => { path: string } | null } };
		};
		return w.app.workspace.getActiveFile()?.path ?? null;
	});
}

test("virtual events: command opens the auto-created file", async ({ calendar }) => {
	await calendar.page.evaluate(
		({ pid, calId }) => {
			const w = window as unknown as {
				app: { commands: { executeCommandById: (id: string) => boolean } };
			};
			const ok = w.app.commands.executeCommandById(`${pid}:open-virtual-events-${calId}`);
			if (!ok) throw new Error("command not found in registry");
		},
		{ pid: PLUGIN_ID, calId: DEFAULT_CALENDAR_ID }
	);
	await expect.poll(() => activeFilePath(calendar.page)).toBe(VIRTUAL_EVENTS_PATH);
});
