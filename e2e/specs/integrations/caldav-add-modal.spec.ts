import { expect } from "@playwright/test";

import { testIntegrations as test } from "../../fixtures/electron";
import { closeSettings, expectNoticeText, openPrismaSettings, switchSettingsTab } from "../../fixtures/helpers";
import {
	CALDAV_ADD_ACCOUNT_BTN_CLASS,
	CALDAV_MODAL_TID,
	CALDAV_PRESET_TID,
	CALDAV_TEST_CONNECTION_TID,
	caldavField,
	integrationDocsLink,
	integrationHeadingDoc,
	proGate,
	sel,
} from "../../fixtures/testids";

// Feasibility probe for the CalDAV add modal. Real CalDAV sync is
// network-bound (Nextcloud / Radicale endpoints) and out of scope for
// E2E. This spec covers the UI surface only — proving the integrations
// settings tab + "Add account" button + the open CalDAV modal render
// correctly with the Pro license active. Live sync is documented in
// `docs/specs/caldav-e2e-radicale.md` for a future Radicale-backed run.
//
// Pre-license: the integrations tab shows the Pro upgrade banner. Post
// `unlockPro()`, the "Add account" button is visible and the modal
// opens to the discovery form. Clicking the test-connection button
// without a server URL fires a Notice rather than crashing.

test.describe("integrations: CalDAV add modal UI surface", () => {
	test("locked: integrations tab shows Pro upgrade banner before activation", async ({ calendar }) => {
		const page = calendar.page;
		await openPrismaSettings(page);
		await switchSettingsTab(page, "integrations");

		// Banner from `pro-gated-content` — surfaces when `plugin.isProEnabled === false`.
		await expect(page.locator(sel(proGate("CALDAV_SYNC"))).first()).toBeVisible();

		// "Add account" button must NOT be visible while gated.
		await expect(page.locator(CALDAV_ADD_ACCOUNT_BTN_CLASS)).toHaveCount(0);
		await closeSettings(page);
	});

	test("unlocked: Add account opens the modal with form fields and a Test connection button", async ({ calendar }) => {
		const page = calendar.page;
		await calendar.unlockPro();
		await openPrismaSettings(page);
		await switchSettingsTab(page, "integrations");

		// Add-account button is now visible.
		const addBtn = page.locator(CALDAV_ADD_ACCOUNT_BTN_CLASS).first();
		await expect(addBtn).toBeVisible();
		await addBtn.click();

		const modal = page.locator(sel(CALDAV_MODAL_TID)).first();
		await expect(modal).toBeVisible();

		// Preset dropdown is the entry point of the form.
		await expect(modal.locator(sel(CALDAV_PRESET_TID))).toBeVisible();

		// Schema-rendered fields are present (name + serverUrl + username at
		// minimum). `SchemaForm` stamps `<prefix>control-<field>` on the inner
		// control element.
		await expect(modal.locator(sel(caldavField("name")))).toBeVisible();
		await expect(modal.locator(sel(caldavField("serverUrl")))).toBeVisible();
		await expect(modal.locator(sel(caldavField("username")))).toBeVisible();

		// Test connection button is rendered.
		const testBtn = modal.locator(sel(CALDAV_TEST_CONNECTION_TID));
		await expect(testBtn).toBeVisible();

		// Clicking Test connection with empty credentials surfaces the
		// "Please fill in server address..." Notice instead of crashing.
		await testBtn.click();
		await expectNoticeText(page, "Please fill in server address");

		// Modal stays open — no submit attempted.
		await expect(modal).toBeVisible();

		// Cancel returns to the integrations tab without writing any account.
		await page.keyboard.press("Escape");
		await expect(modal).toBeHidden();
		await closeSettings(page);
	});

	// Onboarding aid: each Pro sync section has a clickable "Guide ↗" heading
	// linking to its docs anchor, plus an inline "Google Calendar setup guide"
	// link — so the docs are one click away while configuring a sync source.
	test("unlocked: CalDAV and ICS sections link to the integration + Google Calendar guides", async ({ calendar }) => {
		const page = calendar.page;
		await calendar.unlockPro();
		await openPrismaSettings(page);
		await switchSettingsTab(page, "integrations");

		const caldavHeading = page.locator(sel(integrationHeadingDoc("caldav")));
		await expect(caldavHeading).toBeVisible();
		await expect(caldavHeading).toHaveAttribute("href", /\/features\/advanced\/integrations\?.*#caldav-integration$/);

		const icsHeading = page.locator(sel(integrationHeadingDoc("ics")));
		await expect(icsHeading).toBeVisible();
		await expect(icsHeading).toHaveAttribute("href", /\/features\/advanced\/integrations\?.*#ics-url-subscriptions$/);

		for (const section of ["caldav", "ics"] as const) {
			const google = page.locator(sel(integrationDocsLink(section)));
			await expect(google).toBeVisible();
			await expect(google).toHaveAttribute("href", /\/features\/advanced\/integrations\/google-calendar\?/);
		}

		await closeSettings(page);
	});
});
