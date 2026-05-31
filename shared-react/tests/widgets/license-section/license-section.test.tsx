import { LicenseStatusSchema, type LicenseManager, type LicenseStatus } from "@real1ty-obsidian-plugins";
import { screen } from "@testing-library/react";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { LicenseSection } from "../../../src/widgets/license-section/license-section";
import { renderWithProviders } from "../../harness/render-with-providers";

const PREFIX = "test-";
const ACCOUNT_URLS = {
	subscription: "https://example.com/account?utm_content=manage_subscription",
	billing: "https://example.com/account?utm_content=manage_billing",
	devices: "https://example.com/account?utm_content=manage_devices",
};

function makeStatus(overrides: Partial<LicenseStatus>): LicenseStatus {
	return { ...LicenseStatusSchema.parse({}), ...overrides };
}

function makeManager(
	status: LicenseStatus,
	fns?: { deactivateDevice?: () => Promise<boolean>; refreshLicense?: () => Promise<void> }
): LicenseManager {
	const status$ = new BehaviorSubject<LicenseStatus>(status);
	return {
		status$,
		get status() {
			return status$.getValue();
		},
		productName: "Test Plugin",
		purchaseUrl: "https://example.com/buy",
		refreshLicense: fns?.refreshLicense ?? vi.fn().mockResolvedValue(undefined),
		deactivateDevice: fns?.deactivateDevice ?? vi.fn().mockResolvedValue(true),
	} as unknown as LicenseManager;
}

function setup(status: LicenseStatus, fns?: Parameters<typeof makeManager>[1]) {
	const manager = makeManager(status, fns);
	const ui = (
		<LicenseSection
			licenseManager={manager}
			currentSecretName="my-secret"
			onSecretChange={() => Promise.resolve()}
			accountUrls={ACCOUNT_URLS}
		/>
	);
	return { manager, ...renderWithProviders(ui, { cssPrefix: PREFIX, testIdPrefix: PREFIX }) };
}

describe("LicenseSection", () => {
	it("renders the trial date line for a trialing subscription (C3)", () => {
		setup(makeStatus({ state: "valid", entitlementStatus: "trialing", trialEndsAt: "2026-06-01T00:00:00Z" }));
		expect(screen.getByText(/^Free trial ends /)).toBeInTheDocument();
	});

	it("renders the renewal line and a non-CTA Manage subscription action when active (C3, C5)", () => {
		setup(makeStatus({ state: "valid", entitlementStatus: "active", currentPeriodEnd: "2026-06-25T00:00:00Z" }));
		expect(screen.getByText(/^Renews /)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Manage subscription" })).toBeInTheDocument();
	});

	it("offers a Manage billing fix-it action when the subscription is inactive (C5)", () => {
		setup(makeStatus({ state: "entitlement_inactive", errorMessage: "Your subscription isn't active." }));
		expect(screen.getByRole("button", { name: "Manage billing" })).toHaveClass("mod-cta");
	});

	it("offers a Manage devices action and device management when at the seat limit (C5)", () => {
		setup(makeStatus({ state: "device_limit", activationsCurrent: 5, activationsLimit: 5 }));
		expect(screen.getByRole("button", { name: "Manage devices" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Deactivate this device" })).toBeInTheDocument();
	});

	it("shows a grace nudge when the offline token is about to expire (C6)", () => {
		const soon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
		setup(makeStatus({ state: "valid", entitlementStatus: "active", expiresAt: soon }));
		expect(screen.getByText(/Connect to the internet soon/)).toBeInTheDocument();
	});

	it("requires a confirm click before deactivating this device (C4)", async () => {
		const deactivateDevice = vi.fn().mockResolvedValue(true);
		const { user } = setup(makeStatus({ state: "valid", entitlementStatus: "active" }), { deactivateDevice });

		await user.click(screen.getByRole("button", { name: "Deactivate this device" }));
		expect(deactivateDevice).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Click again to confirm" })).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Click again to confirm" }));
		expect(deactivateDevice).toHaveBeenCalledOnce();
	});
});
