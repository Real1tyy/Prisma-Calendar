import { cls } from "@real1ty-obsidian-plugins";
import { type App, Modal, Notice } from "obsidian";
import { ICS_SUBSCRIPTION_DEFAULTS } from "../../../constants";
import type { ICSSubscription } from "../../../core/integrations/ics-subscription";
import type { SettingsStore } from "../../../core/settings-store";
import {
	renderActionButtons,
	renderEnabledToggle,
	renderNameField,
	renderSyncIntervalField,
	renderTimezoneField,
	renderUrlField,
} from "../generic";

export class EditICSSubscriptionModal extends Modal {
	private name: string;
	private enabled: boolean;
	private url: string;
	private syncIntervalMinutes: number;
	private timezone: string;

	constructor(
		app: App,
		private settingsStore: SettingsStore,
		private subscription: ICSSubscription,
		private onSave: () => void
	) {
		super(app);
		this.name = subscription.name;
		this.enabled = subscription.enabled;
		this.url = subscription.url;
		this.syncIntervalMinutes = subscription.syncIntervalMinutes ?? ICS_SUBSCRIPTION_DEFAULTS.SYNC_INTERVAL_MINUTES;
		this.timezone = subscription.timezone ?? "UTC";
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass(cls("caldav-modal"));

		contentEl.createEl("h2", { text: `Edit: ${this.subscription.name}` });

		renderNameField(contentEl, {
			label: "Subscription name",
			value: this.name,
			onChange: (value) => {
				this.name = value;
			},
		});

		renderEnabledToggle(contentEl, {
			desc: "Enable or disable syncing for this subscription",
			value: this.enabled,
			onChange: (value) => {
				this.enabled = value;
			},
		});

		renderUrlField(contentEl, {
			label: "ICS URL",
			desc: "Public URL to an .ics calendar file",
			value: this.url,
			onChange: (value) => {
				this.url = value;
			},
		});

		renderSyncIntervalField(contentEl, {
			value: this.syncIntervalMinutes,
			onChange: (value) => {
				this.syncIntervalMinutes = value;
			},
		});

		renderTimezoneField(contentEl, {
			value: this.timezone,
			onChange: (value) => {
				this.timezone = value;
			},
		});

		renderActionButtons(contentEl, {
			cancelFn: () => this.close(),
			saveFn: () => void this.saveSubscription(),
			saveText: "Save",
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
								url: this.url,
								syncIntervalMinutes: this.syncIntervalMinutes,
								timezone: this.timezone,
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
