import { readPluginData, settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { PLUGIN_ID } from "../../fixtures/constants";
import { expectConfirmationModal } from "../../fixtures/dsl";
import {
	expect,
	SEEDED_ICS_SUBSCRIPTION_ID,
	SEEDED_ICS_SUBSCRIPTION_NAME,
	testWithSeededICSSubscription as test,
} from "../../fixtures/electron";
import { openPrismaSettings, switchSettingsTab, unlockPro } from "../../fixtures/helpers";

// Exercises `showConfirmationModal` from shared/src/components/component-renderer/
// confirmation.ts. Prisma calls it through `showConfirmDeleteModal` (settings/
// generic) when the user deletes an ICS subscription that has no events on
// disk. The shared modal stamps unprefixed `confirmation-modal`,
// `confirmation-modal-confirm`, `confirmation-modal-cancel` testids (it is
// plugin-agnostic by design — see 2026-04-15-e2e-full-coverage.md for the
// cross-plugin testid contract).
//
// Two branches the shared component guarantees:
//   • cancel → `onCancel` fires, caller's work is NOT executed, modal closes.
//   • confirm → `onConfirm` fires, modal closes once the promise resolves.

function subscriptionCount(vaultDir: string): number {
	const data = readPluginData(vaultDir, PLUGIN_ID) as {
		icsSubscriptions?: { subscriptions?: unknown[] };
	};
	return data.icsSubscriptions?.subscriptions?.length ?? 0;
}

test.describe("shared: confirmation-modal", () => {
	test.beforeEach(async ({ obsidian }) => {
		// ICS subscription UI is Pro-gated; without unlockPro the integrations
		// tab shows a Pro-upgrade banner and the subscription list never renders.
		await unlockPro(obsidian.page);
		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "integrations");
	});

	test("cancel keeps the entity; title + buttons show caller-supplied labels", async ({ obsidian }) => {
		expect(subscriptionCount(obsidian.vaultDir)).toBe(1);

		await obsidian.page
			.locator(`[data-testid="prisma-settings-ics-sub-delete-${SEEDED_ICS_SUBSCRIPTION_ID}"]`)
			.first()
			.click();

		const modal = await expectConfirmationModal(obsidian.page);

		// Title + caller's `Delete`/`Cancel` button labels flow through the shared
		// component unchanged — the test proves the `confirmButton: { text: "Delete",
		// warning: true }` config from showConfirmDeleteModal propagated to DOM.
		await expect(modal.root).toContainText(`Delete subscription`);
		await expect(modal.root).toContainText(SEEDED_ICS_SUBSCRIPTION_NAME);
		await expect(modal.confirmBtn).toHaveText("Delete");
		await expect(modal.cancelBtn).toHaveText("Cancel");
		// `warning: true` resolves to mod-warning on the confirm button (see
		// resolveButton in confirmation.ts) — the visual distinction users rely
		// on for destructive actions.
		await expect(modal.confirmBtn).toHaveClass(/mod-warning/);

		await modal.cancel();

		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		expect(subscriptionCount(obsidian.vaultDir)).toBe(1);
	});

	test("confirm executes the caller's handler and closes the modal", async ({ obsidian }) => {
		expect(subscriptionCount(obsidian.vaultDir)).toBe(1);

		await obsidian.page
			.locator(`[data-testid="prisma-settings-ics-sub-delete-${SEEDED_ICS_SUBSCRIPTION_ID}"]`)
			.first()
			.click();

		const modal = await expectConfirmationModal(obsidian.page);
		await modal.confirm();

		await settleSettings(obsidian.page, { pluginId: PLUGIN_ID });
		await expect.poll(() => subscriptionCount(obsidian.vaultDir)).toBe(0);
	});
});
