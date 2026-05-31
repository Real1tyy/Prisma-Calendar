import { formatLocaleLongDate } from "../../utils/date/date";
import type { LicenseStatus } from "./types";

export function getLicenseStatusText(status: LicenseStatus): string {
	if (status.state === "none") return "No license key configured";
	if (status.state === "valid") {
		if (status.expiresAt) {
			const expiryDate = formatLocaleLongDate(new Date(status.expiresAt));
			return `License active — valid offline until ${expiryDate}`;
		}
		return "License active";
	}
	if (status.state === "expired") return "License expired. Click Verify to refresh.";
	if (status.state === "invalid") return status.errorMessage ?? "Invalid license key.";
	if (status.state === "entitlement_inactive") return status.errorMessage ?? "Subscription isn't active.";
	if (status.state === "device_limit") return status.errorMessage ?? "Device limit reached.";
	if (status.state === "deactivated") return status.errorMessage ?? "This device was deactivated.";
	return status.errorMessage ?? "Could not verify license.";
}

/**
 * The subscription-lifecycle line — a DIFFERENT clock from the offline-grace
 * `expiresAt` rendered above. Returns null when no entitlement dates are known
 * (e.g. offline cache from before the backend returned them).
 */
export function getSubscriptionDateText(status: LicenseStatus): string | null {
	if (status.state !== "valid") return null;
	const fmt = (iso: string | null): string | null => (iso ? formatLocaleLongDate(new Date(iso)) : null);
	const periodEnd = fmt(status.currentPeriodEnd);

	if (status.entitlementStatus === "active_canceled" || status.entitlementStatus === "trialing_canceled") {
		return periodEnd
			? `Canceled — Pro access until ${periodEnd}`
			: "Canceled — access continues until your period ends";
	}
	if (status.entitlementStatus === "trialing") {
		const trialEnd = fmt(status.trialEndsAt);
		return trialEnd ? `Free trial ends ${trialEnd}` : null;
	}
	if (status.entitlementStatus === "active") {
		return periodEnd ? `Renews ${periodEnd}` : null;
	}
	return null;
}
