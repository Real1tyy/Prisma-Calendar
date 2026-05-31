import { describe, expect, it } from "vitest";

import { getLicenseStatusText, getSubscriptionDateText } from "../../src/core/license/status-text";
import { LicenseStatusSchema, type LicenseStatus } from "../../src/core/license/types";

function makeStatus(overrides: Partial<LicenseStatus>): LicenseStatus {
	return { ...LicenseStatusSchema.parse({}), ...overrides };
}

describe("getLicenseStatusText", () => {
	it("surfaces the error message for the new entitlement_inactive and deactivated states", () => {
		expect(
			getLicenseStatusText(makeStatus({ state: "entitlement_inactive", errorMessage: "Subscription lapsed" }))
		).toBe("Subscription lapsed");
		expect(getLicenseStatusText(makeStatus({ state: "deactivated", errorMessage: "Device deactivated" }))).toBe(
			"Device deactivated"
		);
	});

	it("falls back to default copy when no error message is present", () => {
		expect(getLicenseStatusText(makeStatus({ state: "entitlement_inactive" }))).toBe("Subscription isn't active.");
		expect(getLicenseStatusText(makeStatus({ state: "deactivated" }))).toBe("This device was deactivated.");
	});
});

describe("getSubscriptionDateText", () => {
	it("renders a trial line for a trialing subscription", () => {
		const text = getSubscriptionDateText(
			makeStatus({ state: "valid", entitlementStatus: "trialing", trialEndsAt: "2026-06-01T00:00:00Z" })
		);
		expect(text).toMatch(/^Free trial ends /);
	});

	it("renders a renewal line for an active subscription", () => {
		const text = getSubscriptionDateText(
			makeStatus({ state: "valid", entitlementStatus: "active", currentPeriodEnd: "2026-06-25T00:00:00Z" })
		);
		expect(text).toMatch(/^Renews /);
	});

	it.each(["active_canceled", "trialing_canceled"] as const)(
		"renders an access-until line for a %s subscription with a period end",
		(entitlementStatus) => {
			const text = getSubscriptionDateText(
				makeStatus({ state: "valid", entitlementStatus, currentPeriodEnd: "2026-07-01T00:00:00Z" })
			);
			expect(text).toMatch(/^Canceled — Pro access until /);
		}
	);

	it("falls back to generic copy when a canceled subscription has no period end", () => {
		const text = getSubscriptionDateText(makeStatus({ state: "valid", entitlementStatus: "active_canceled" }));
		expect(text).toBe("Canceled — access continues until your period ends");
	});

	it("returns null when the license is not valid", () => {
		expect(
			getSubscriptionDateText(
				makeStatus({ state: "error", entitlementStatus: "active", currentPeriodEnd: "2026-06-25T00:00:00Z" })
			)
		).toBeNull();
	});

	it("returns null when no entitlement dates are known", () => {
		expect(getSubscriptionDateText(makeStatus({ state: "valid" }))).toBeNull();
		expect(getSubscriptionDateText(makeStatus({ state: "valid", entitlementStatus: "trialing" }))).toBeNull();
	});
});
