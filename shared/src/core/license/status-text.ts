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
	if (status.state === "device_limit") return status.errorMessage ?? "Device limit reached.";
	if (status.state === "error") return status.errorMessage ?? "Could not verify license.";
	return "";
}
