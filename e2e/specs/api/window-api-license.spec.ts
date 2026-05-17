import { createPrismaApi, waitForApiAction } from "../../fixtures/api-helpers";
import { PLUGIN_ID } from "../../fixtures/constants";
import { expect, test } from "../../fixtures/electron";
import type { PrismaPlugin, PrismaWindow } from "../../fixtures/window-types";

// Tier 1 contract spec for the license-surface actions (`activate`, `isPro`).
// Every other spec gates Pro via the `__setProForTesting` backdoor on the
// licenseManager — none exercise the real window-API contract surface. This
// spec proves:
//
//   1. `activate({ key })` returns undefined and does not throw, even with an
//      empty key (the short-circuit path that bypasses the license server).
//   2. `isPro()` returns a boolean and reflects the underlying licenseManager
//      state through the window-API path (not the internal accessor).
//
// We do NOT exercise activation with a real key — that would require live
// network access to the license server. Network-bound activation has its own
// coverage in the license-server integration tier; here we only prove the
// envelope contract.

test.describe("plugin api contract — license surface via window.PrismaCalendar", () => {
	test("isPro reflects the licenseManager state through the window-API path", async ({ calendar, obsidian }) => {
		const api = createPrismaApi(obsidian.page);

		// Baseline: no license activated yet. The seed in `electron.ts` does not
		// set a license key, so isPro starts false. The DSL helper `unlockPro`
		// uses the same `__setProForTesting` backdoor — we drive it ourselves
		// here to keep both directions of the boolean within one test.
		expect(await api.isPro()).toBe(false);

		await calendar.unlockPro();
		expect(await api.isPro()).toBe(true);

		// Flip back to false and reassert — proves isPro reads through to the
		// live state, not a cached snapshot.
		await obsidian.page.evaluate((pid) => {
			const w = window as unknown as PrismaWindow;
			const plugin = w.app.plugins.plugins[pid] as PrismaPlugin | undefined;
			plugin?.licenseManager?.__setProForTesting?.(false);
		}, PLUGIN_ID);
		expect(await api.isPro()).toBe(false);
	});

	test("activate with an empty key short-circuits to status:none without throwing", async ({ calendar, obsidian }) => {
		// `activate` is only attached to `window.PrismaCalendar` after the
		// licenseManager subscription fires `apiManager.expose()`. Unlocking
		// via the testing backdoor triggers that synchronously, but the
		// page.evaluate may still arrive before the event loop tick that
		// publishes the new window key — poll to be safe.
		await calendar.unlockPro();
		await waitForApiAction(obsidian.page, "PrismaCalendar", "activate");

		const api = createPrismaApi(obsidian.page);

		// Empty key: `refreshLicense` reads `licenseKey === ""` (falsy), short-
		// circuits to `updateStatus("none")`, and never touches the network.
		// Proves the activate handler doesn't throw for the empty-key path —
		// callers depend on void-return semantics here.
		const result = await api.activate({ key: "" });
		expect(result).toBeUndefined();
	});
});
