import {
	getLicenseStatusText,
	getSubscriptionDateText,
	type LicenseManager,
	type LicenseStatus,
} from "@real1ty-obsidian-plugins";
import { Notice } from "obsidian";
import { memo, useCallback, useState, type ReactNode } from "react";

import { useCssPrefix, useScopedCls } from "../../contexts/theme-context";
import { useExternalSnapshot } from "../../hooks/reactive/use-external-snapshot";
import { useInjectedStyles } from "../../hooks/styles/use-styles";
import { OutboundLink } from "../../primitives/atoms/outbound-link";
import { SecretField } from "../../primitives/atoms/secret-field";
import { SettingHeading, SettingItem } from "../../primitives/layout/setting-item";
import { openExternal } from "../../utils/open-external";
import { buildLicenseStyles } from "./license-section.styles";

interface LicenseSectionProps {
	licenseManager: LicenseManager;
	currentSecretName: string;
	onSecretChange: (value: string) => Promise<void>;
	// Per-CTA account-management URLs, each pre-built with a distinct
	// `utm_content` so subscription / billing / device-limit clicks are
	// attributable separately. Omit to hide the Subscription row entirely
	// (e.g. plugins without a web account page).
	accountUrls?: {
		subscription: string;
		billing: string;
		devices: string;
	};
	// Doc page explaining how activation works (where the key comes from, that
	// the device ID is arbitrary, keychain storage, second-device activation).
	// When set, the License heading links to it and the key field points at it.
	activationGuideUrl?: string;
}

// Nudge to reconnect once the cached offline token is within this window of
// expiring. The daily heartbeat normally refreshes it long before, so this only
// surfaces for someone who has been offline for several days.
const GRACE_NUDGE_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000;

function graceNudge(status: LicenseStatus): string | null {
	if (status.state !== "valid" || !status.expiresAt) return null;
	const msLeft = new Date(status.expiresAt).getTime() - Date.now();
	if (msLeft > GRACE_NUDGE_THRESHOLD_MS) return null;
	return "Connect to the internet soon to keep Pro available offline.";
}

// Per-state fix-it action surfaced as the Subscription row. Billing and the full
// device list live on the web account page, so inactive / seat-limit states
// point there with their OWN utm_content; everything else falls back to the
// trial CTA (purchase URL).
type SubscriptionActionKey = "subscription" | "billing" | "devices";

interface SubscriptionAction {
	label: string;
	cta: boolean;
	action: SubscriptionActionKey | null;
	description: string | null;
}

function subscriptionAction(status: LicenseStatus): SubscriptionAction {
	switch (status.state) {
		case "valid":
			return {
				label: "Manage subscription",
				cta: false,
				action: "subscription",
				description: "Manage billing and subscription settings",
			};
		case "entitlement_inactive":
			return {
				label: "Manage billing",
				cta: true,
				action: "billing",
				description: "Your subscription isn't active — update billing to restore Pro.",
			};
		case "device_limit":
			return {
				label: "Manage devices",
				cta: true,
				action: "devices",
				description: "You've reached your device limit — remove a device to free a seat.",
			};
		default:
			return { label: "Start free trial", cta: true, action: null, description: null };
	}
}

function StatusDescription({ status }: { status: LicenseStatus }): ReactNode {
	const cls = useScopedCls("license");
	const subscriptionLine = getSubscriptionDateText(status);
	const nudge = graceNudge(status);
	return (
		<>
			{getLicenseStatusText(status)}
			{status.state === "valid" && (
				<span className={cls("activations-badge")}>
					{status.activationsCurrent}/{status.activationsLimit} devices
				</span>
			)}
			{subscriptionLine != null && <div className={cls("sub-line")}>{subscriptionLine}</div>}
			{nudge != null && <div className={cls("grace-nudge")}>{nudge}</div>}
		</>
	);
}

export const LicenseSection = memo(function LicenseSection({
	licenseManager,
	currentSecretName,
	onSecretChange,
	accountUrls,
	activationGuideUrl,
}: LicenseSectionProps) {
	const cssPrefix = useCssPrefix();
	useInjectedStyles(`${cssPrefix}license-styles`, buildLicenseStyles(cssPrefix));
	const status = useExternalSnapshot(licenseManager.status$);
	const [verifying, setVerifying] = useState(false);
	const [deactivating, setDeactivating] = useState(false);
	const [confirmDeactivate, setConfirmDeactivate] = useState(false);

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

	const handleDeactivate = useCallback(async () => {
		if (!confirmDeactivate) {
			setConfirmDeactivate(true);
			return;
		}
		setConfirmDeactivate(false);
		setDeactivating(true);
		try {
			const ok = await licenseManager.deactivateDevice();
			new Notice(ok ? "This device has been deactivated." : "Couldn't deactivate this device — please try again.");
		} finally {
			setDeactivating(false);
		}
	}, [confirmDeactivate, licenseManager]);

	const keyDescription: ReactNode = (
		<>
			{`Paste your ${licenseManager.productName} Pro license key as the Secret to unlock advanced features — the ID can be anything. The one-click activation link from your sign-up email or account page sets this up for you. `}
			{activationGuideUrl !== undefined && (
				<>
					<OutboundLink href={activationGuideUrl}>How activation works</OutboundLink>
					{" · "}
				</>
			)}
			<OutboundLink href={licenseManager.purchaseUrl}>Start your 30-day free trial</OutboundLink>
		</>
	);

	const showDeviceMgmt = status.state === "valid" || status.state === "device_limit";
	const subAction = subscriptionAction(status);
	const subHref =
		subAction.action != null && accountUrls != null ? accountUrls[subAction.action] : licenseManager.purchaseUrl;
	const subDescription =
		subAction.description ??
		`Try every ${licenseManager.productName} Pro feature with a 30-day free trial — cancel anytime`;

	return (
		<>
			<SettingHeading name="License" docHref={activationGuideUrl} docLabel="Setup guide" />
			<SettingItem name="License key" description={keyDescription}>
				<SecretField value={currentSecretName} onChange={(v) => void onSecretChange(v)} />
			</SettingItem>
			<SettingItem name="License status" description={<StatusDescription status={status} />}>
				<button type="button" className="mod-cta" disabled={verifying} onClick={() => void handleVerify()}>
					{verifying ? "Verifying..." : "Verify"}
				</button>
			</SettingItem>
			{showDeviceMgmt && (
				<SettingItem
					name="This device"
					description="Free up this device's activation seat — for example before moving to another computer. Click Verify to re-activate anytime."
				>
					<button type="button" disabled={deactivating} onClick={() => void handleDeactivate()}>
						{deactivating ? "Deactivating..." : confirmDeactivate ? "Click again to confirm" : "Deactivate this device"}
					</button>
				</SettingItem>
			)}
			{accountUrls != null && (
				<SettingItem name="Subscription" description={subDescription}>
					<button type="button" className={subAction.cta ? "mod-cta" : ""} onClick={() => openExternal(subHref)}>
						{subAction.label}
					</button>
				</SettingItem>
			)}
		</>
	);
});
