import { getLicenseStatusText, type LicenseManager, type LicenseStatus } from "@real1ty-obsidian-plugins";
import { memo, type ReactNode, useCallback, useState } from "react";

import { useExternalSnapshot } from "../hooks/use-external-snapshot";
import { useInjectedStyles } from "../hooks/use-injected-styles";
import { buildLicenseStyles } from "./license-section.styles";
import { SecretField } from "./secret-field";
import { SettingHeading, SettingItem } from "./setting-item";

interface LicenseSectionProps {
	licenseManager: LicenseManager;
	currentSecretName: string;
	onSecretChange: (value: string) => Promise<void>;
	cssPrefix: string;
	accountUrl?: string;
}

function StatusDescription({ status, cssPrefix }: { status: LicenseStatus; cssPrefix: string }): ReactNode {
	return (
		<>
			{getLicenseStatusText(status)}
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
	useInjectedStyles(`${cssPrefix}license-styles`, buildLicenseStyles(cssPrefix));
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
				Start your 30-day free trial
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
							: `Try every ${licenseManager.productName} Pro feature with a 30-day free trial — cancel anytime`
					}
				>
					<button
						type="button"
						className={status.state !== "valid" ? "mod-cta" : ""}
						onClick={() => window.open(status.state === "valid" ? accountUrl : licenseManager.purchaseUrl, "_blank")}
					>
						{status.state === "valid" ? "Manage Subscription" : "Start free trial"}
					</button>
				</SettingItem>
			)}
		</>
	);
});
