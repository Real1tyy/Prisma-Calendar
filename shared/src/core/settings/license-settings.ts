import { SecretComponent, Setting, type App } from "obsidian";

import { getLicenseStatusText, type LicenseManager } from "../license";

export interface LicenseSettingsConfig {
	app: App;
	licenseManager: LicenseManager;
	currentSecretName: string;
	onSecretChange: (value: string) => Promise<void>;
	cssPrefix: string;
}

function refreshStatusDesc(setting: Setting, licenseManager: LicenseManager, cssPrefix: string): void {
	const status = licenseManager.status;
	const fragment = document.createDocumentFragment();
	fragment.appendText(getLicenseStatusText(status));
	if (status.state === "valid") {
		const badge = fragment.createSpan({ cls: `${cssPrefix}license-activations-badge` });
		badge.textContent = `${status.activationsCurrent}/${status.activationsLimit} devices`;
	}
	setting.setDesc(fragment);
}

export function renderLicenseSettings(containerEl: HTMLElement, config: LicenseSettingsConfig): void {
	const { app, licenseManager, currentSecretName, onSecretChange, cssPrefix } = config;
	const purchaseUrl = licenseManager.purchaseUrl;
	const productName = licenseManager.productName;

	new Setting(containerEl).setName("License").setHeading();

	const desc = document.createDocumentFragment();
	desc.appendText(`Enter your ${productName} Pro license key to unlock advanced features. `);
	const link = desc.createEl("a", { text: "Get a license", href: purchaseUrl });
	link.setAttr("target", "_blank");
	link.setAttr("rel", "noopener noreferrer");

	new Setting(containerEl)
		.setName("License key")
		.setDesc(desc)
		.addComponent((el) =>
			new SecretComponent(app, el).setValue(currentSecretName).onChange(async (value) => {
				await onSecretChange(value);
			})
		);

	const statusSetting = new Setting(containerEl).setName("License status");
	refreshStatusDesc(statusSetting, licenseManager, cssPrefix);

	statusSetting.addButton((button) =>
		button
			.setButtonText("Verify")
			.setCta()
			.onClick(async () => {
				try {
					button.setDisabled(true);
					button.setButtonText("Verifying...");
					await licenseManager.refreshLicense();
				} catch (error) {
					console.error("[Settings] License verification failed:", error);
				} finally {
					refreshStatusDesc(statusSetting, licenseManager, cssPrefix);
					button.setButtonText("Verify");
					button.setDisabled(false);
				}
			})
	);
}
