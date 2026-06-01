import { expect, type Locator, type Page } from "@playwright/test";

import { test } from "../../fixtures/electron";
import { closeSettings, openPrismaSettings, switchSettingsTab } from "../../fixtures/helpers";
import { LICENSE_ACTIVATIONS_BADGE_CLASS, proGate, sel } from "../../fixtures/testids";

// Schema-rendered settings rows expose only the `.setting-item-name` text as a
// stable anchor; locate the wrapping `.setting-item` by its row label so the
// internal description / button can be reached without coupling to row order.
function settingItemByName(page: Page, name: string): Locator {
	return page.locator(`.setting-item:has(.setting-item-name:text-is("${name}"))`);
}

// End-to-end coverage of the license-activation surface. The activation API
// itself is network-bound (Lemon Squeezy → JWT verify) so the spec drives
// status transitions through the same `licenseManager.status$` BehaviorSubject
// the production flow flips on a verified token, then asserts every wired
// surface reacts: settings-tab status text, settings-tab CTA, and the
// per-view Pro gates rendered by `pro-gated-content.tsx`.
//
// What this spec proves end-to-end:
//   1. Status "none" → status row prints "No license key configured", CTA reads
//      "Start free trial".
//   2. Clicking the Verify button calls `refreshLicense()` without throwing,
//      and (with no key in keychain) leaves the status at "none".
//   3. Status "valid" → status row prints "License active" wording + activations
//      badge, CTA flips to "Manage subscription".
//   4. The same status flip unlocks the heatmap / gantt / dashboard views —
//      the upgrade-gate component is no longer mounted.
//   5. Downgrading the status back to "expired" + setting isPro=false brings
//      the gates back without a reload.

test.describe("settings: pro license activation surface", () => {
	test("free → valid → expired transitions ripple to status text, CTA, and view gates", async ({ calendar }) => {
		const page = calendar.page;

		// ── Phase 1: free state ────────────────────────────────────
		await openPrismaSettings(page);
		await switchSettingsTab(page, "general");

		const statusItem = settingItemByName(page, "License status");
		await expect(statusItem).toBeVisible();
		await expect(statusItem.locator(".setting-item-description")).toContainText("No license key configured");

		const subscriptionItem = settingItemByName(page, "Subscription");
		await expect(subscriptionItem.locator("button")).toHaveText("Start free trial");

		// Verify button is the live entry point for `licenseManager.refreshLicense()`.
		// With no key in the keychain it should resolve cleanly to state "none".
		const verifyBtn = statusItem.locator("button");
		await expect(verifyBtn).toHaveText("Verify");
		await verifyBtn.click();
		// Status stays "none" — no key, no transition.
		await expect(statusItem.locator(".setting-item-description")).toContainText("No license key configured");

		// ── Phase 2: pro gates are visible on every gated view ─────
		await closeSettings(page);
		await calendar.switchView("heatmap");
		await expect(page.locator(sel(proGate("HEATMAP"))).first()).toBeVisible();

		// ── Phase 3: simulate verified activation ──────────────────
		await calendar.setLicenseStatus(
			{
				state: "valid",
				activationsCurrent: 1,
				activationsLimit: 5,
				expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
			},
			{ isPro: true }
		);

		// Settings observers wake reactively — re-open the tab and assert the
		// new wording propagated without a manual reload.
		await openPrismaSettings(page);
		await switchSettingsTab(page, "general");
		await expect(statusItem.locator(".setting-item-description")).toContainText("License active");
		await expect(statusItem.locator(LICENSE_ACTIVATIONS_BADGE_CLASS)).toHaveText("1/5 devices");
		await expect(subscriptionItem.locator("button")).toHaveText("Manage subscription");

		// ── Phase 4: gates unlock everywhere ───────────────────────
		await closeSettings(page);
		await calendar.switchView("heatmap");
		await expect(page.locator(sel(proGate("HEATMAP")))).toHaveCount(0);
		await calendar.switchView("gantt");
		await expect(page.locator(sel(proGate("GANTT")))).toHaveCount(0);
		await calendar.switchToGroupChild("dashboard", "dashboard-by-name");
		await expect(page.locator(sel(proGate("DASHBOARD")))).toHaveCount(0);

		// ── Phase 5: downgrade to expired re-installs the gates ────
		await calendar.setLicenseStatus({ state: "expired", errorMessage: null }, { isPro: false });
		await calendar.switchView("heatmap");
		await expect(page.locator(sel(proGate("HEATMAP"))).first()).toBeVisible();
		await calendar.switchView("gantt");
		await expect(page.locator(sel(proGate("GANTT"))).first()).toBeVisible();

		// Status text reflects the new state with the canonical wording.
		await openPrismaSettings(page);
		await switchSettingsTab(page, "general");
		await expect(statusItem.locator(".setting-item-description")).toContainText("License expired");
		await expect(subscriptionItem.locator("button")).toHaveText("Start free trial");
	});

	test("invalid-key state shows the canonical error wording in the status row", async ({ calendar }) => {
		const page = calendar.page;
		await calendar.setLicenseStatus({ state: "invalid", errorMessage: "License key not recognized" }, { isPro: false });
		await openPrismaSettings(page);
		await switchSettingsTab(page, "general");
		await expect(settingItemByName(page, "License status").locator(".setting-item-description")).toContainText(
			"License key not recognized"
		);
	});

	test("device-limit state surfaces the server message", async ({ calendar }) => {
		const page = calendar.page;
		await calendar.setLicenseStatus(
			{ state: "device_limit", errorMessage: "Device limit reached (5/5)" },
			{ isPro: false }
		);
		await openPrismaSettings(page);
		await switchSettingsTab(page, "general");
		await expect(settingItemByName(page, "License status").locator(".setting-item-description")).toContainText(
			"Device limit reached (5/5)"
		);
	});
});
