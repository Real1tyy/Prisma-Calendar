import {
	getLicenseStatusText,
	getSubscriptionDateText,
	type LicenseManager,
	type LicenseStatus,
} from "@real1ty/obsidian-plugins";
import { Notice } from "obsidian";
import { memo, useCallback, useState, type ReactNode } from "react";

import { useApp } from "../../contexts/app-context";
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
	// When set, the License key row becomes a one-click paste-and-activate flow:
	// the user pastes their key, we write it to the OS keychain under THIS fixed
	// id (`app.secretStorage.setSecret`), point the plugin's settings at it via
	// `onSecretChange`, and verify — no manual secret-creation steps. The
	// "select an existing secret" path stays available behind an advanced toggle.
	// Omit to keep only the raw secret-picker (plugins without a fixed key id).
	licenseSecretId?: string;
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
	const statusText = getLicenseStatusText(status);
	// Anything that isn't a healthy "active" or the empty "none" baseline is a
	// problem the user must act on (expired / invalid / billing / seat limit).
	// Surfaced in the same row as the action CTA, a muted line gets missed — so
	// give the alert line weight/colour to make it the row's dominant text.
	const needsAttention = status.state !== "valid" && status.state !== "none";
	return (
		<>
			{needsAttention ? <span className={cls("status-alert")}>{statusText}</span> : statusText}
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
	licenseSecretId,
	accountUrls,
	activationGuideUrl,
}: LicenseSectionProps) {
	const app = useApp();
	const cssPrefix = useCssPrefix();
	const cls = useScopedCls("license");
	useInjectedStyles(`${cssPrefix}license-styles`, buildLicenseStyles(cssPrefix));
	const status = useExternalSnapshot(licenseManager.status$);
	const [deactivating, setDeactivating] = useState(false);
	const [confirmDeactivate, setConfirmDeactivate] = useState(false);
	const [keyInput, setKeyInput] = useState("");
	const [activating, setActivating] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [showSecretPicker, setShowSecretPicker] = useState(false);

	const oneClick = licenseSecretId !== undefined;

	// Picking an existing secret should verify on the spot — same as pasting a
	// key — so there's never a separate "now click Verify" step.
	const handleSecretSelected = useCallback(
		async (value: string) => {
			await onSecretChange(value);
			await licenseManager.refreshLicense();
		},
		[onSecretChange, licenseManager]
	);

	const handleActivate = useCallback(async () => {
		if (licenseSecretId === undefined) return;
		const key = keyInput.trim();
		if (key === "") return;
		setActivating(true);
		try {
			// Store the raw key in the OS keychain ourselves and point settings at
			// our fixed id — the user never touches Obsidian's create-secret dialog.
			app.secretStorage.setSecret(licenseSecretId, key);
			await onSecretChange(licenseSecretId);
			await licenseManager.refreshLicense();
			if (licenseManager.isPro) {
				new Notice(`${licenseManager.productName} Pro activated successfully!`);
				setKeyInput("");
			} else {
				const current = licenseManager.status;
				new Notice(`Activation failed — ${current.errorMessage ?? current.state}`);
			}
		} catch (error) {
			console.error("[Settings] License activation failed:", error);
			new Notice("Activation failed — see the console for details.");
		} finally {
			setActivating(false);
		}
	}, [app, keyInput, licenseManager, licenseSecretId, onSecretChange]);

	// Activation already auto-verifies; this is the manual "re-check with the
	// server" escape hatch for when the situation changed elsewhere (renewed
	// billing, freed a seat) without the local secret value changing.
	const handleRefresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await licenseManager.refreshLicense();
		} catch (error) {
			console.error("[Settings] License refresh failed:", error);
		} finally {
			setRefreshing(false);
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

	const keyIntro = oneClick
		? `Paste your ${licenseManager.productName} Pro license key and click Activate to unlock Pro features. That's it. `
		: `Paste your ${licenseManager.productName} Pro license key as the Secret to unlock advanced features — the ID can be anything. The one-click activation link from your sign-up email or account page sets this up for you. `;

	const keyDescription: ReactNode = (
		<>
			{keyIntro}
			{activationGuideUrl !== undefined && <OutboundLink href={activationGuideUrl}>How activation works</OutboundLink>}
			{/* The trial CTA already lives in the Subscription row; only repeat it
			    here for consumers that have no Subscription row to carry it. */}
			{accountUrls === undefined && (
				<>
					{activationGuideUrl !== undefined && " · "}
					<OutboundLink href={licenseManager.purchaseUrl}>Start your 30-day free trial</OutboundLink>
				</>
			)}
		</>
	);

	const showDeviceMgmt = status.state === "valid" || status.state === "device_limit";
	// Once Pro is active on this device there's nothing to activate — the key is
	// already in the keychain. Hide the activation surface (paste field + secret
	// picker) and let "Deactivate this device" take the Activate slot.
	const activated = status.state === "valid";
	const subAction = subscriptionAction(status);
	const subHref =
		subAction.action != null && accountUrls != null ? accountUrls[subAction.action] : licenseManager.purchaseUrl;
	// The error/lapsed states fold their status into the Subscription row (no
	// separate row, no Refresh — the fix is a new key or a billing/device action,
	// and we re-check reactively as the secret changes). When valid, status gets
	// its own row with the manual Refresh button, so here we show the plain action
	// hint; with no key yet there's nothing to report, so it's the trial pitch.
	const subDescription: ReactNode =
		status.state === "none" ? (
			`Try every ${licenseManager.productName} Pro feature with a 30-day free trial — cancel anytime`
		) : activated ? (
			(subAction.description ?? "Manage billing and subscription settings")
		) : (
			<StatusDescription status={status} />
		);

	return (
		<>
			<SettingHeading name="License" docHref={activationGuideUrl} docLabel="Setup guide" />
			{!activated && (
				<>
					<SettingItem name="License key" description={keyDescription}>
						{oneClick ? (
							<div className={cls("activate-row")}>
								<input
									type="text"
									className={cls("activate-input")}
									placeholder="Paste your license key"
									aria-label="License key"
									value={keyInput}
									disabled={activating}
									onChange={(e) => setKeyInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											void handleActivate();
										}
									}}
								/>
								<button
									type="button"
									className="mod-cta"
									disabled={activating || keyInput.trim() === ""}
									onClick={() => void handleActivate()}
								>
									{activating ? "Activating..." : "Activate"}
								</button>
							</div>
						) : (
							<SecretField value={currentSecretName} onChange={(v) => void handleSecretSelected(v)} />
						)}
					</SettingItem>
					{oneClick && (
						<SettingItem
							name="Use an existing secret"
							description="Already keep your license key as a secret in Obsidian's secret storage? Select it here instead of pasting the key again."
						>
							{showSecretPicker ? (
								<SecretField value={currentSecretName} onChange={(v) => void handleSecretSelected(v)} />
							) : (
								<button type="button" onClick={() => setShowSecretPicker(true)}>
									Select existing secret
								</button>
							)}
						</SettingItem>
					)}
				</>
			)}
			{showDeviceMgmt && (
				<SettingItem
					name="This device"
					description="Free up this device's seat — for example before switching computers. To use a different license key, deactivate here, then paste the new one."
				>
					<button type="button" disabled={deactivating} onClick={() => void handleDeactivate()}>
						{deactivating ? "Deactivating..." : confirmDeactivate ? "Click again to confirm" : "Deactivate this device"}
					</button>
				</SettingItem>
			)}
			{activated && (
				<SettingItem name="License status" description={<StatusDescription status={status} />}>
					<button type="button" disabled={refreshing} onClick={() => void handleRefresh()}>
						{refreshing ? "Refreshing..." : "Refresh"}
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
			{accountUrls == null && !activated && status.state !== "none" && (
				<SettingItem name="License status" description={<StatusDescription status={status} />}>
					{null}
				</SettingItem>
			)}
		</>
	);
});
