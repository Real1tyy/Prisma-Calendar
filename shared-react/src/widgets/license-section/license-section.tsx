import { getLicenseStatusText, type LicenseManager, type LicenseStatus } from "@real1ty-obsidian-plugins";
import { memo, type ReactNode, useCallback, useState } from "react";

import { useCssPrefix, useScopedCls } from "../../contexts/theme-context";
import { useExternalSnapshot } from "../../hooks/reactive/use-external-snapshot";
import { useInjectedStyles } from "../../hooks/styles/use-styles";
import { SecretField } from "../../primitives/atoms/secret-field";
import { SettingHeading, SettingItem } from "../../primitives/layout/setting-item";
import { buildLicenseStyles } from "./license-section.styles";

interface LicenseSectionProps {
	licenseManager: LicenseManager;
	currentSecretName: string;
	onSecretChange: (value: string) => Promise<void>;
	accountUrl?: string;
}

function StatusDescription({ status }: { status: LicenseStatus }): ReactNode {
	const cls = useScopedCls("license");
	return (
		<>
			{getLicenseStatusText(status)}
			{status.state === "valid" && (
				<span className={cls("activations-badge")}>
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
	accountUrl,
}: LicenseSectionProps) {
	const cssPrefix = useCssPrefix();
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
			<SettingItem name="License status" description={<StatusDescription status={status} />}>
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
