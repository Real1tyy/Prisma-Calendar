import { LicenseStatusSchema, type LicenseManager, type LicenseStatus } from "@real1ty/obsidian-plugins";
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

interface ManagerFns {
	deactivateDevice?: () => Promise<boolean>;
	refreshLicense?: () => Promise<void>;
	isPro?: boolean;
}

function makeManager(status: LicenseStatus, fns?: ManagerFns): LicenseManager {
	const status$ = new BehaviorSubject<LicenseStatus>(status);
	return {
		status$,
		get status() {
			return status$.getValue();
		},
		isPro: fns?.isPro ?? false,
		productName: "Test Plugin",
		purchaseUrl: "https://example.com/buy",
		refreshLicense: fns?.refreshLicense ?? vi.fn().mockResolvedValue(undefined),
		deactivateDevice: fns?.deactivateDevice ?? vi.fn().mockResolvedValue(true),
	} as unknown as LicenseManager;
}

interface SetupProps {
	licenseSecretId?: string;
	onSecretChange?: (value: string) => Promise<void>;
}

function setup(status: LicenseStatus, fns?: ManagerFns, props?: SetupProps) {
	const manager = makeManager(status, fns);
	const ui = (
		<LicenseSection
			licenseManager={manager}
			currentSecretName="my-secret"
			onSecretChange={props?.onSecretChange ?? (() => Promise.resolve())}
			accountUrls={ACCOUNT_URLS}
			{...(props?.licenseSecretId !== undefined ? { licenseSecretId: props.licenseSecretId } : {})}
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

	describe("one-click activation (licenseSecretId set)", () => {
		const SECRET_ID = "test-plugin-license";

		it("renders a paste-and-activate field instead of the raw secret picker", () => {
			const { container } = setup(makeStatus({ state: "none" }), undefined, { licenseSecretId: SECRET_ID });

			expect(screen.getByRole("textbox", { name: "License key" })).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument();
			// The raw secret picker stays hidden behind the advanced toggle.
			expect(container.querySelector(".setting-secret-host")).toBeNull();
			expect(screen.getByRole("button", { name: "Select existing secret" })).toBeInTheDocument();
		});

		it("disables Activate until a non-blank key is entered", async () => {
			const { user } = setup(makeStatus({ state: "none" }), undefined, { licenseSecretId: SECRET_ID });

			const activate = screen.getByRole("button", { name: "Activate" });
			expect(activate).toBeDisabled();

			await user.type(screen.getByRole("textbox", { name: "License key" }), "   ");
			expect(activate).toBeDisabled();

			await user.type(screen.getByRole("textbox", { name: "License key" }), "KEY-123");
			expect(activate).toBeEnabled();
		});

		it("creates the secret, points settings at it, verifies, and clears the field on success", async () => {
			const refreshLicense = vi.fn().mockResolvedValue(undefined);
			const onSecretChange = vi.fn().mockResolvedValue(undefined);
			const { user, app } = setup(
				makeStatus({ state: "none" }),
				{ refreshLicense, isPro: true },
				{
					licenseSecretId: SECRET_ID,
					onSecretChange,
				}
			);

			const input = screen.getByRole("textbox", { name: "License key" });
			await user.type(input, "  KEY-ABC-789  ");
			await user.click(screen.getByRole("button", { name: "Activate" }));

			expect(app.secretStorage.setSecret).toHaveBeenCalledWith(SECRET_ID, "KEY-ABC-789");
			expect(onSecretChange).toHaveBeenCalledWith(SECRET_ID);
			expect(refreshLicense).toHaveBeenCalledOnce();
			expect(input).toHaveValue("");
		});

		it("keeps the typed key when activation does not yield Pro", async () => {
			const onSecretChange = vi.fn().mockResolvedValue(undefined);
			const { user, app } = setup(
				makeStatus({ state: "invalid", errorMessage: "bad key" }),
				{ isPro: false },
				{
					licenseSecretId: SECRET_ID,
					onSecretChange,
				}
			);

			const input = screen.getByRole("textbox", { name: "License key" });
			await user.type(input, "BAD-KEY");
			await user.click(screen.getByRole("button", { name: "Activate" }));

			expect(app.secretStorage.setSecret).toHaveBeenCalledWith(SECRET_ID, "BAD-KEY");
			expect(input).toHaveValue("BAD-KEY");
		});

		it("reveals the secret picker when the advanced option is chosen", async () => {
			const { user, container } = setup(makeStatus({ state: "none" }), undefined, { licenseSecretId: SECRET_ID });

			await user.click(screen.getByRole("button", { name: "Select existing secret" }));

			expect(container.querySelector(".setting-secret-host")).not.toBeNull();
			expect(screen.queryByRole("button", { name: "Select existing secret" })).toBeNull();
		});
	});
});
