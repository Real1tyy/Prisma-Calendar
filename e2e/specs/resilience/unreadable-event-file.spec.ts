import { chmodSync } from "node:fs";
import { join } from "node:path";

import { expect } from "@playwright/test";
import { isPluginLoaded } from "@real1ty-obsidian-plugins/testing/e2e";

import { testResilience as test } from "../../fixtures/electron";
import { PLUGIN_ID, reloadAndWaitForPrisma } from "../../fixtures/resilience-helpers";
import { seedEvent } from "../../fixtures/seed-events";

// Filesystem permission errors should never take down the calendar. A single
// unreadable file logs or notices and the rest of the vault continues to
// render. Linux-only: macOS sandbox often refuses chmod 000.
test.describe("unreadable event file", () => {
	test.skip(process.platform !== "linux", "chmod 000 is only reliable on Linux");

	test("plugin still loads and other events render", async ({ obsidian }) => {
		const unreadableRelative = seedEvent(obsidian.vaultDir, {
			title: "Unreadable",
			startDate: "2026-08-01T09:00",
			endDate: "2026-08-01T10:00",
		});
		seedEvent(obsidian.vaultDir, {
			title: "Neighbour",
			startDate: "2026-08-02T09:00",
			endDate: "2026-08-02T10:00",
		});
		const absolute = join(obsidian.vaultDir, unreadableRelative);
		try {
			chmodSync(absolute, 0o000);
		} catch {
			test.skip(true, "chmod 000 rejected by filesystem");
		}

		try {
			await reloadAndWaitForPrisma(obsidian.page);

			expect(await isPluginLoaded(obsidian.page, PLUGIN_ID)).toBe(true);
			await expect(obsidian.page.locator(".workspace").first()).toBeVisible();
		} finally {
			// Restore perms so the per-run vault retention / cleanup can delete
			// the file without an EACCES.
			try {
				chmodSync(absolute, 0o644);
			} catch {
				/* best-effort cleanup */
			}
		}
	});
});
