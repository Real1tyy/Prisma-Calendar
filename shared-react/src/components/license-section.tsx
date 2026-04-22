import type { LicenseManager, LicenseStatus } from "@real1ty-obsidian-plugins";
import { memo, type ReactNode, useCallback, useState } from "react";

import { useExternalSnapshot } from "../hooks/use-external-snapshot";
import { SecretField } from "./secret-field";
import { SettingHeading, SettingItem } from "./setting-item";

interface LicenseSectionProps {
	licenseManager: LicenseManager;
	currentSecretName: string;
	onSecretChange: (value: string) => Promise<void>;
	cssPrefix: string;
	accountUrl?: string;
}

function formatStatusText(status: LicenseStatus): string {
	if (status.state === "none") return "No license key configured";
	if (status.state === "valid") {
		if (status.expiresAt) {
			const expiryDate = new Date(status.expiresAt).toLocaleDateString(undefined, {
				year: "numeric",
				month: "long",
				day: "numeric",
			});
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

function StatusDescription({ status, cssPrefix }: { status: LicenseStatus; cssPrefix: string }): ReactNode {
	return (
		<>
			{formatStatusText(status)}
			{status.state === "valid" && (
				<span className={`${cssPrefix}license-activations-badge`}>
					{status.activationsCurrent}/{status.activationsLimit} devices
				</span>
			)}
		</>
	);
}

export const LicenseSection = memo(function LicenseSection({
	licenseManager,
	currentSecretName,
	onSecretChange,
	cssPrefix,
	accountUrl,
}: LicenseSectionProps) {
	const status = useExternalSnapshot(licenseManager.status$);
	const [verifying, setVerifying] = useState(false);

	const handleVerify = useCallback(async () => {
		setVerifying(true);
		try {
			await licenseManager.refreshLicense();
		} catch (error) {
			console.error("[Settings] License verification failed:", error);
		} finally {
			setVerifying(false);
		}
	}, [licenseManager]);

	const keyDescription: ReactNode = (
		<>
			{`Enter your ${licenseManager.productName} Pro license key to unlock advanced features. `}
			<a href={licenseManager.purchaseUrl} target="_blank" rel="noopener noreferrer">
				Get a license
			</a>
		</>
	);

	return (
		<>
			<SettingHeading name="License" />
			<SettingItem name="License key" description={keyDescription}>
				<SecretField value={currentSecretName} onChange={(v) => void onSecretChange(v)} />
			</SettingItem>
			<SettingItem name="License status" description={<StatusDescription status={status} cssPrefix={cssPrefix} />}>
				<button type="button" className="mod-cta" disabled={verifying} onClick={() => void handleVerify()}>
					{verifying ? "Verifying..." : "Verify"}
				</button>
			</SettingItem>
			{accountUrl != null && (
				<SettingItem
					name="Subscription"
					description={
						status.state === "valid"
							? "Manage billing and subscription settings"
							: `Get access to all ${licenseManager.productName} Pro features`
					}
				>
					<button
						type="button"
						className={status.state !== "valid" ? "mod-cta" : ""}
						onClick={() => window.open(status.state === "valid" ? accountUrl : licenseManager.purchaseUrl, "_blank")}
					>
						{status.state === "valid" ? "Manage Subscription" : "Subscribe"}
					</button>
				</SettingItem>
			)}
		</>
	);
});
