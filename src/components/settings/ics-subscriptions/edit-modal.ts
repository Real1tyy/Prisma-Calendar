import { cls } from "@real1ty-obsidian-plugins";
import { type App, Modal, Notice, SecretComponent, Setting } from "obsidian";

import { ICS_SUBSCRIPTION_DEFAULTS } from "../../../constants";
import { COMMON_TIMEZONES } from "../../../core/integrations/ics-export";
import type { PrismaCalendarSettingsStore } from "../../../types";
import type { ICSSubscription } from "../../../types/integrations";

export class EditICSSubscriptionModal extends Modal {
	private name: string;
	private enabled: boolean;
	private urlSecretName: string;
	private syncIntervalMinutes: number;
	private timezone: string;
	private icon: string;

	constructor(
		app: App,
		private settingsStore: PrismaCalendarSettingsStore,
		private subscription: ICSSubscription,
		private onSave: () => void
	) {
		super(app);
		this.name = subscription.name;
		this.enabled = subscription.enabled;
		this.urlSecretName = subscription.urlSecretName;
		this.syncIntervalMinutes = subscription.syncIntervalMinutes ?? ICS_SUBSCRIPTION_DEFAULTS.SYNC_INTERVAL_MINUTES;
		this.timezone = subscription.timezone ?? "UTC";
		this.icon = subscription.icon ?? "";
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass(cls("caldav-modal"));

		contentEl.createEl("h2", { text: `Edit: ${this.subscription.name}` });

		new Setting(contentEl).setName("Subscription name").addText((text) => {
			text.setValue(this.name).onChange((value) => {
				this.name = value;
			});
		});

		new Setting(contentEl)
			.setName("Enabled")
			.setDesc("Enable or disable syncing for this subscription")
			.addToggle((toggle) => {
				toggle.setValue(this.enabled).onChange((value) => {
					this.enabled = value;
				});
			});

		new Setting(contentEl)
			.setName("ICS URL")
			.setDesc("Select a secret from SecretStorage containing the ICS calendar URL")
			.addComponent((el) =>
				new SecretComponent(this.app, el).setValue(this.urlSecretName).onChange((value) => {
					this.urlSecretName = value;
				})
			);

		new Setting(contentEl)
			.setName("Sync interval (minutes)")
			.setDesc("How often to automatically sync (1-1440 minutes)")
			.addText((text) => {
				text.inputEl.type = "number";
				text.inputEl.min = "1";
				text.inputEl.max = "1440";
				text.inputEl.step = "1";
				text.setValue(this.syncIntervalMinutes.toString());
				text.onChange((value) => {
					const numValue = parseInt(value, 10);
					if (!Number.isNaN(numValue) && numValue >= 1 && numValue <= 1440) {
						this.syncIntervalMinutes = numValue;
					}
				});
			});

		new Setting(contentEl)
			.setName("Timezone")
			.setDesc("Timezone for event times. If it matches your calendar events, times are preserved as-is.")
			.addDropdown((dropdown) => {
				for (const tz of COMMON_TIMEZONES) {
					dropdown.addOption(tz.id, tz.label);
				}
				dropdown.setValue(this.timezone);
				dropdown.onChange((value) => {
					this.timezone = value;
				});
			});

		new Setting(contentEl)
			.setName("Calendar icon")
			.setDesc("Optional icon/emoji to display on synced events (e.g., 📅, 🔄, ☁️)")
			.addText((text) => {
				text
					.setPlaceholder("📅")
					.setValue(this.icon)
					.onChange((value) => {
						this.icon = value;
					});
			});

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText("Cancel").onClick(() => this.close());
			})
			.addButton((button) => {
				button
					.setButtonText("Save")
					.setCta()
					.onClick(() => void this.saveSubscription());
			});
	}

	private async saveSubscription(): Promise<void> {
		await this.settingsStore.updateSettings((s) => ({
			...s,
			icsSubscriptions: {
				...s.icsSubscriptions,
				subscriptions: s.icsSubscriptions.subscriptions.map((sub) =>
					sub.id === this.subscription.id
						? {
								...sub,
								name: this.name,
								enabled: this.enabled,
								urlSecretName: this.urlSecretName,
								syncIntervalMinutes: this.syncIntervalMinutes,
								timezone: this.timezone,
								icon: this.icon || undefined,
							}
						: sub
				),
			},
		}));

		new Notice(`Updated subscription: ${this.name}`);
		this.onSave();
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
