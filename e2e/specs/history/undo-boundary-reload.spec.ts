import { test } from "../../fixtures/electron";
import { createEventViaToolbar, isoLocal, undoViaPalette, waitForFileExists } from "../../fixtures/history-helpers";
import { openCalendarReady } from "../events/events-helpers";

// The undo stack lives only in memory. Its behaviour across a renderer
// reload is a product decision, not a bug. This spec locks in today's
// behaviour (reload clears the undo stack; subsequent undo is a no-op) so a
// future change forces the spec to be updated explicitly.

test.describe("undo boundary: reload (UI-driven)", () => {
	test("undo after renderer reload is a no-op — the created file stays", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);

		const path = await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Reload Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await obsidian.page.reload();
		await obsidian.page.waitForFunction(() => {
			const w = window as unknown as {
				app?: { plugins?: { plugins?: Record<string, { calendarBundles?: unknown[] }> } };
			};
			return Boolean(w.app?.plugins?.plugins?.["prisma-calendar"]?.calendarBundles?.length);
		});
		await openCalendarReady(obsidian.page);

		await undoViaPalette(obsidian.page);
		await waitForFileExists(obsidian.vaultDir, path, true);

		await undoViaPalette(obsidian.page);
		await waitForFileExists(obsidian.vaultDir, path, true);
	});
});
