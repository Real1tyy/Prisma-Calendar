import type { LicenseManager } from "@real1ty/obsidian-plugins";

/**
 * The key a submission may be attributed to, or `null` when it must go
 * anonymously. Shared by the Review and Feedback flows so "when may we attach
 * a license key" has one answer: a *verified* Pro entitlement plus a key that
 * actually reads back.
 */
export async function getAttributableLicenseKey(licenseManager: LicenseManager | undefined): Promise<string | null> {
	if (licenseManager?.isPro !== true) return null;
	try {
		return (await licenseManager.getLicenseKey()) || null;
	} catch {
		// Secret storage must never be able to block a universal flow. A failed
		// read degrades to an anonymous submission without exposing the secret
		// name, key, or storage error.
		return null;
	}
}
