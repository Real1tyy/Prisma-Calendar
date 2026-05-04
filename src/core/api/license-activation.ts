import { Notice } from "obsidian";

import type CustomCalendarPlugin from "../../main";

const LICENSE_SECRET_ID = "prisma-calendar-license";

export async function activateLicense(plugin: CustomCalendarPlugin, key: string): Promise<void> {
	plugin.app.secretStorage.setSecret(LICENSE_SECRET_ID, key);

	await plugin.settingsStore.updateSettings((s) => ({
		...s,
		licenseKeySecretName: LICENSE_SECRET_ID,
	}));

	await plugin.licenseManager.refreshLicense();

	if (plugin.licenseManager.isPro) {
		new Notice("Prisma Calendar Pro activated successfully!");
	} else {
		const status = plugin.licenseManager.status;
		new Notice(`Prisma Calendar: activation failed — ${status.errorMessage ?? status.state}`);
	}
}
