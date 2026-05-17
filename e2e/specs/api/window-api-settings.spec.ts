import { readPluginData } from "@real1ty-obsidian-plugins/testing/e2e";

import { createPrismaApi } from "../../fixtures/api-helpers";
import { PLUGIN_ID } from "../../fixtures/constants";
import { expect, test } from "../../fixtures/electron";

// Tier 1 contract spec for the settings actions. `getSettings` /
// `updateSettings` are the only window-API actions explicitly annotated as
// "Window-API only — URL transport cannot represent the nested settings
// object." If they regress, no other test catches it: settings have no
// command palette entry, no DOM button, and no other E2E spec drives them
// through the public window contract.
//
// Disk cross-check via `readPluginData(vaultDir, PLUGIN_ID)` proves the
// update actually persisted to `.obsidian/plugins/prisma-calendar/data.json`.

interface CalendarEntry {
	id: string;
	defaultDurationMinutes?: number;
	showDurationField?: boolean;
}

function readDefaultCalendar(vaultDir: string): CalendarEntry {
	const data = readPluginData(vaultDir, PLUGIN_ID) as { calendars?: CalendarEntry[] };
	const entry = data.calendars?.find((c) => c.id === "default") ?? data.calendars?.[0];
	if (!entry) throw new Error("default calendar entry missing from data.json");
	return entry;
}

test.describe("plugin api contract — settings via window.PrismaCalendar", () => {
	test("getSettings returns the active calendar's settings; updateSettings persists patch to data.json", async ({
		calendar,
		obsidian,
	}) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		// ── getSettings (snapshot before mutation) ─────────────────────
		const before = await api.getSettings({ calendarId: "default" });
		expect(before, "default calendar must be resolvable").not.toBeNull();

		// Pick two fields with different types so the patch exercises both
		// number and boolean coercion paths through the settings store.
		const newDuration = before!.defaultDurationMinutes + 30;
		const newShowDurationField = !before!.showDurationField;

		try {
			// ── updateSettings ─────────────────────────────────────────
			const updated = await api.updateSettings({
				calendarId: "default",
				settings: {
					defaultDurationMinutes: newDuration,
					showDurationField: newShowDurationField,
				},
			});
			expect(updated).toBe(true);

			// ── getSettings (verify in-memory reflects the patch) ──────
			const after = await api.getSettings({ calendarId: "default" });
			expect(after!.defaultDurationMinutes).toBe(newDuration);
			expect(after!.showDurationField).toBe(newShowDurationField);

			// ── Disk cross-check: data.json reflects the patch ─────────
			// The settings store debounces persistence. Poll until the on-disk
			// copy matches the in-memory snapshot — proves the action's success
			// boolean is not optimistic.
			await expect.poll(() => readDefaultCalendar(obsidian.vaultDir).defaultDurationMinutes).toBe(newDuration);
			await expect.poll(() => readDefaultCalendar(obsidian.vaultDir).showDurationField).toBe(newShowDurationField);
		} finally {
			// Restore the original values so the test is idempotent (test runners
			// reuse the vault when leanVaultOnClose keeps the plugin dir).
			await api.updateSettings({
				calendarId: "default",
				settings: {
					defaultDurationMinutes: before!.defaultDurationMinutes,
					showDurationField: before!.showDurationField,
				},
			});
		}
	});

	test("getSettings against an unknown calendarId returns null (no exception)", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		expect(await api.getSettings({ calendarId: "does-not-exist" })).toBeNull();
	});

	test("updateSettings against an unknown calendarId returns false (no exception)", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		expect(
			await api.updateSettings({
				calendarId: "does-not-exist",
				settings: { defaultDurationMinutes: 90 },
			})
		).toBe(false);
	});
});
