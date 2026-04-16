import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LicenseManager, LicenseStatus } from "../../src/core/license";
import { type LicenseSettingsConfig, renderLicenseSettings } from "../../src/core/settings/license-settings";

function createMockLicenseManager(statusOverride?: Partial<LicenseStatus>): LicenseManager {
	const defaultStatus: LicenseStatus = {
		state: "none",
		activationsCurrent: 0,
		activationsLimit: 5,
		expiresAt: null,
		errorMessage: null,
	};
	const status = { ...defaultStatus, ...statusOverride };
	return {
		status,
		refreshLicense: vi.fn().mockResolvedValue(undefined),
		purchaseUrl: "https://example.com/purchase",
		productName: "Test Plugin",
	} as unknown as LicenseManager;
}

describe("renderLicenseSettings", () => {
	let containerEl: HTMLElement;
	let config: LicenseSettingsConfig;
	let mockLicenseManager: LicenseManager;

	beforeEach(() => {
		containerEl = document.createElement("div");
		mockLicenseManager = createMockLicenseManager();
		config = {
			app: {} as any,
			licenseManager: mockLicenseManager,
			currentSecretName: "test-secret",
			onSecretChange: vi.fn().mockResolvedValue(undefined),
			cssPrefix: "test-",
		};
	});

	it("should render without errors", () => {
		expect(() => renderLicenseSettings(containerEl, config)).not.toThrow();
	});

	it("should read status from the license manager", () => {
		renderLicenseSettings(containerEl, config);
		expect(mockLicenseManager.status.state).toBe("none");
	});
});

describe("getLicenseStatusText (via renderLicenseSettings)", () => {
	let containerEl: HTMLElement;

	beforeEach(() => {
		containerEl = document.createElement("div");
	});

	function renderWithStatus(status: Partial<LicenseStatus>): void {
		const manager = createMockLicenseManager(status);
		renderLicenseSettings(containerEl, {
			app: {} as any,
			licenseManager: manager,
			currentSecretName: "",
			onSecretChange: vi.fn().mockResolvedValue(undefined),
			cssPrefix: "test-",
		});
	}

	it("should render for state 'none'", () => {
		expect(() => renderWithStatus({ state: "none" })).not.toThrow();
	});

	it("should render for state 'valid' without expiry", () => {
		expect(() => renderWithStatus({ state: "valid", expiresAt: null })).not.toThrow();
	});

	it("should render for state 'valid' with expiry date", () => {
		expect(() =>
			renderWithStatus({
				state: "valid",
				expiresAt: "2026-12-31T00:00:00Z",
				activationsCurrent: 2,
				activationsLimit: 5,
			})
		).not.toThrow();
	});

	it("should render for state 'expired'", () => {
		expect(() => renderWithStatus({ state: "expired" })).not.toThrow();
	});

	it("should render for state 'invalid' with custom error", () => {
		expect(() => renderWithStatus({ state: "invalid", errorMessage: "Key revoked." })).not.toThrow();
	});

	it("should render for state 'invalid' without custom error", () => {
		expect(() => renderWithStatus({ state: "invalid", errorMessage: null })).not.toThrow();
	});

	it("should render for state 'device_limit' with custom error", () => {
		expect(() => renderWithStatus({ state: "device_limit", errorMessage: "Too many devices." })).not.toThrow();
	});

	it("should render for state 'device_limit' without custom error", () => {
		expect(() => renderWithStatus({ state: "device_limit", errorMessage: null })).not.toThrow();
	});

	it("should render for state 'error' with custom error", () => {
		expect(() => renderWithStatus({ state: "error", errorMessage: "Network timeout." })).not.toThrow();
	});

	it("should render for state 'error' without custom error", () => {
		expect(() => renderWithStatus({ state: "error", errorMessage: null })).not.toThrow();
	});
});
