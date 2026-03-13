import { cls, SettingsUIBuilder } from "@real1ty-obsidian-plugins";
import { type App, Notice, Setting } from "obsidian";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import type CustomCalendarPlugin from "../../../main";
import type { PrismaCalendarSettingsStore } from "../../../types";
import type { ICSSubscription } from "../../../types/integrations";
import type { CustomCalendarSettingsSchema } from "../../../types/settings";
import { getCalendarById } from "../../../utils/calendar-settings";
import { deleteFilesByPaths } from "../../../utils/obsidian";
import { CalendarIntegrationDeleteEventsModal } from "../../modals";
import { ConfirmDeleteModal } from "../generic";
import { AddICSSubscriptionModal } from "./add-modal";
import { EditICSSubscriptionModal } from "./edit-modal";

export class ICSSubscriptionSettings {
	private ui: SettingsUIBuilder<typeof CustomCalendarSettingsSchema>;

	constructor(
		private app: App,
		private settingsStore: PrismaCalendarSettingsStore,
		private plugin: CustomCalendarPlugin,
		private calendarId: string
	) {
		this.ui = new SettingsUIBuilder(this.settingsStore as never);
	}

	display(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("ICS URL subscriptions (read-only)").setHeading();

		const descContainer = containerEl.createDiv(cls("settings-caldav-desc"));
		descContainer.createEl("p").setText("Subscribe to external calendars via public ICS URLs.");
		descContainer
			.createEl("p", { cls: cls("settings-muted") })
			.setText("Events are synced one-way from the URL. Removed events are deleted locally.");

		this.renderSubscriptionsList(containerEl);
		this.renderGlobalSettings(containerEl);
	}

	private renderSubscriptionsList(containerEl: HTMLElement): void {
		const wrapper = containerEl.createDiv(cls("caldav-accounts-wrapper"));
		this.renderSubscriptionsListContent(wrapper);
	}

	private renderSubscriptionsListContent(wrapper: HTMLElement): void {
		wrapper.empty();

		const icsSubSettings = this.settingsStore.currentSettings.icsSubscriptions;
		const subsContainer = wrapper.createDiv(cls("caldav-accounts-container"));

		if (icsSubSettings.subscriptions.length === 0) {
			const emptyState = subsContainer.createDiv(cls("caldav-accounts-empty"));
			emptyState.setText("No subscriptions configured.");
		} else {
			for (const subscription of icsSubSettings.subscriptions) {
				this.renderSubscriptionItem(subsContainer, subscription);
			}
		}

		const addButton = wrapper.createEl("button", {
			text: "Add subscription",
			cls: cls("caldav-add-account-button"),
		});
		addButton.addEventListener("click", () => {
			new AddICSSubscriptionModal(this.app, this.settingsStore, this.calendarId, () => {
				this.refreshSubscriptionsList(wrapper);
			}).open();
		});
	}

	private renderGlobalSettings(containerEl: HTMLElement): void {
		this.ui.addToggle(containerEl, {
			key: "icsSubscriptions.syncOnStartup",
			name: "Sync subscriptions on startup",
			desc: "Automatically sync ICS subscriptions when the app starts",
		});

		this.ui.addToggle(containerEl, {
			key: "icsSubscriptions.enableAutoSync",
			name: "Allow auto-sync for subscriptions",
			desc: "Enable automatic periodic syncing based on each subscription's sync interval",
		});

		this.ui.addToggle(containerEl, {
			key: "icsSubscriptions.notifyOnSync",
			name: "Show subscription sync notifications",
			desc: "Show notifications when ICS subscription sync completes",
		});

		this.ui.addOptionalColorPicker(containerEl, {
			key: "icsSubscriptions.integrationEventColor",
			name: "Integration event color",
			descWhenSet: "Color applied to synced events. Clear to use your color rules instead.",
			descWhenEmpty: "Disabled — synced events use your color rules.",
			fallback: "#8b5cf6",
		});
	}

	private renderSubscriptionItem(container: HTMLElement, subscription: ICSSubscription): void {
		const itemEl = container.createDiv(cls("caldav-account-item"));

		const infoEl = itemEl.createDiv(cls("caldav-account-info"));
		const nameEl = infoEl.createEl("div", { cls: cls("caldav-account-name") });
		nameEl.setText(subscription.name);

		const urlEl = infoEl.createEl("div", { cls: cls("caldav-account-url") });
		urlEl.setText(subscription.urlSecretName ? `Secret: ${subscription.urlSecretName}` : "No URL configured");

		const statusEl = infoEl.createEl("div", {
			cls: `${cls("caldav-account-status")} ${subscription.enabled ? cls("caldav-status-enabled") : cls("caldav-status-disabled")}`,
		});
		statusEl.setText(subscription.enabled ? "Enabled" : "Disabled");

		const controlsEl = itemEl.createDiv(cls("caldav-account-controls"));

		const syncButton = controlsEl.createEl("button", {
			text: "Sync now",
			cls: cls("caldav-account-btn"),
		});
		syncButton.addEventListener("click", () => {
			this.handleSyncClick(syncButton, subscription);
		});

		const editButton = controlsEl.createEl("button", {
			text: "Edit",
			cls: cls("caldav-account-btn"),
		});
		editButton.addEventListener("click", () => {
			new EditICSSubscriptionModal(this.app, this.settingsStore, subscription, () => {
				this.refreshSubscriptionsList(container.parentElement!);
			}).open();
		});

		const deleteButton = controlsEl.createEl("button", {
			text: "Delete",
			cls: `${cls("caldav-account-btn")} ${cls("caldav-account-btn-delete")}`,
		});
		deleteButton.addEventListener("click", () => {
			this.handleDeleteSubscription(subscription, container);
		});
	}

	private handleSyncClick(button: HTMLButtonElement, subscription: ICSSubscription): void {
		button.disabled = true;
		button.setText("Syncing...");

		void (async () => {
			try {
				await this.plugin.syncSingleICSSubscription(subscription);
			} finally {
				button.disabled = false;
				button.setText("Sync now");
			}
		})();
	}

	private handleDeleteSubscription(subscription: ICSSubscription, container: HTMLElement): void {
		const bundle = this.plugin.calendarBundles.find((b) => b.calendarId === subscription.calendarId);
		if (!bundle) {
			new ConfirmDeleteModal(this.app, subscription.name, "subscription", () => {
				void this.deleteSubscription(subscription.id, container);
			}).open();
			return;
		}

		const events = bundle.icsSubscriptionSyncStateManager.getAllForSubscription(subscription.id);
		if (events.length === 0) {
			new ConfirmDeleteModal(this.app, subscription.name, "subscription", () => {
				void this.deleteSubscription(subscription.id, container);
			}).open();
			return;
		}

		new CalendarIntegrationDeleteEventsModal(this.app, {
			accountName: subscription.name,
			eventCount: events.length,
			onConfirm: async () => {
				await this.deleteEventsForSubscription(bundle, subscription.id);
				await this.deleteSubscription(subscription.id, container);
			},
			onCancel: async () => {
				await this.deleteSubscription(subscription.id, container);
			},
		}).open();
	}

	private async deleteEventsForSubscription(bundle: CalendarBundle, subscriptionId: string): Promise<void> {
		const events = bundle.icsSubscriptionSyncStateManager.getAllForSubscription(subscriptionId);
		let deletedCount = events.length;

		// Also delete any recurring instances that were generated from imported events
		for (const event of events) {
			const rruleId = bundle.recurringEventManager.getRRuleIdForSourcePath(event.filePath);
			if (rruleId) {
				const instances = bundle.recurringEventManager.getPhysicalInstancesByRRuleId(rruleId);
				deletedCount += instances.length;
				await bundle.recurringEventManager.deleteAllPhysicalInstances(rruleId);
			}
		}

		const filePaths = events.map((event) => event.filePath);
		await deleteFilesByPaths(
			this.app,
			filePaths,
			getCalendarById(this.settingsStore.currentSettings, this.calendarId)?.fileConcurrencyLimit
		);

		console.log(`[ICS Subscription] Deleted ${deletedCount} event(s) for subscription ${subscriptionId}`);
		new Notice(`Deleted ${deletedCount} event(s)`);
	}

	private async deleteSubscription(subscriptionId: string, container: HTMLElement): Promise<void> {
		await this.settingsStore.updateSettings((s) => ({
			...s,
			icsSubscriptions: {
				...s.icsSubscriptions,
				subscriptions: s.icsSubscriptions.subscriptions.filter((sub) => sub.id !== subscriptionId),
			},
		}));
		this.refreshSubscriptionsList(container.parentElement!);
	}

	private refreshSubscriptionsList(wrapper: HTMLElement): void {
		this.renderSubscriptionsListContent(wrapper);
	}
}
