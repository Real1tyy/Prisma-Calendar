import { cls, SettingsUIBuilder } from "@real1ty-obsidian-plugins";
import { type App, Setting } from "obsidian";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import type CustomCalendarPlugin from "../../../main";
import type { PrismaCalendarSettingsStore } from "../../../types";
import type { CalDAVAccount } from "../../../types/integrations";
import { CalDAVSettingsSchema } from "../../../types/integrations";
import type { CustomCalendarSettingsSchema } from "../../../types/settings";
import { getCalendarById } from "../../../utils/calendar-settings";
import { showCalendarIntegrationDeleteEventsModal } from "../../modals";
import { showConfirmDeleteModal } from "../generic";
import { deleteTrackedIntegrationEvents } from "../integration-shared";
import { showAddCalDAVAccountModal } from "./add-modal";
import { showEditCalDAVAccountModal } from "./edit-modal";

const CaldavShape = CalDAVSettingsSchema.shape;

export class CalDAVSettings {
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
		new Setting(containerEl).setName("Calendar sync (read-only)").setHeading();

		const descContainer = containerEl.createDiv(cls("settings-caldav-desc"));
		descContainer.createEl("p").setText("Sync events from external calendar servers.");
		descContainer.createEl("p", { cls: cls("settings-muted") }).setText("Events are synced one-way from the server.");

		this.renderAccountsList(containerEl);
		this.renderGlobalSettings(containerEl);
	}

	private renderAccountsList(containerEl: HTMLElement): void {
		const wrapper = containerEl.createDiv(cls("caldav-accounts-wrapper"));
		this.renderAccountsListContent(wrapper);
	}

	private renderAccountsListContent(wrapper: HTMLElement): void {
		wrapper.empty();

		const caldavSettings = this.settingsStore.currentSettings.caldav;
		const accountsContainer = wrapper.createDiv(cls("caldav-accounts-container"));

		if (caldavSettings.accounts.length === 0) {
			const emptyState = accountsContainer.createDiv(cls("caldav-accounts-empty"));
			emptyState.setText("No accounts configured.");
		} else {
			for (const account of caldavSettings.accounts) {
				this.renderAccountItem(accountsContainer, account);
			}
		}

		const addButton = wrapper.createEl("button", {
			text: "Add account",
			cls: cls("caldav-add-account-button"),
		});
		addButton.addEventListener("click", () => {
			showAddCalDAVAccountModal(this.app, this.settingsStore, this.calendarId, () => {
				this.refreshAccountsList(wrapper);
			});
		});
	}

	private renderGlobalSettings(containerEl: HTMLElement): void {
		this.ui.addSchemaField(containerEl, { syncOnStartup: CaldavShape.syncOnStartup }, { key: "caldav.syncOnStartup" });
		this.ui.addSchemaField(
			containerEl,
			{ enableAutoSync: CaldavShape.enableAutoSync },
			{ key: "caldav.enableAutoSync", name: "Allow auto-sync" }
		);
		this.ui.addSchemaField(
			containerEl,
			{ notifyOnSync: CaldavShape.notifyOnSync },
			{ key: "caldav.notifyOnSync", name: "Show sync notifications" }
		);

		this.ui.addOptionalColorPicker(containerEl, {
			key: "caldav.integrationEventColor",
			name: "Integration event color",
			descWhenSet: "Color applied to synced events. Clear to use your color rules instead.",
			descWhenEmpty: "Disabled — synced events use your color rules.",
			fallback: "#8b5cf6",
		});
	}

	private renderAccountItem(container: HTMLElement, account: CalDAVAccount): void {
		const itemEl = container.createDiv(cls("caldav-account-item"));

		const infoEl = itemEl.createDiv(cls("caldav-account-info"));
		const nameEl = infoEl.createEl("div", { cls: cls("caldav-account-name") });
		nameEl.setText(account.name);

		const urlEl = infoEl.createEl("div", { cls: cls("caldav-account-url") });
		urlEl.setText(account.serverUrl);

		const statusEl = infoEl.createEl("div", {
			cls: `${cls("caldav-account-status")} ${account.enabled ? cls("caldav-status-enabled") : cls("caldav-status-disabled")}`,
		});
		statusEl.setText(account.enabled ? "Enabled" : "Disabled");

		if (account.selectedCalendars.length > 0) {
			const calendarsEl = infoEl.createEl("div", {
				cls: cls("caldav-account-calendars"),
			});
			calendarsEl.setText(`${account.selectedCalendars.length} calendar(s) selected`);
		}

		const controlsEl = itemEl.createDiv(cls("caldav-account-controls"));

		const syncButton = controlsEl.createEl("button", {
			text: "Sync now",
			cls: cls("caldav-account-btn"),
		});
		syncButton.addEventListener("click", () => {
			this.handleSyncClick(syncButton, account);
		});

		const editButton = controlsEl.createEl("button", {
			text: "Edit",
			cls: cls("caldav-account-btn"),
		});
		editButton.addEventListener("click", () => {
			showEditCalDAVAccountModal(this.app, this.settingsStore, this.plugin, this.calendarId, account, () => {
				this.refreshAccountsList(container.parentElement!);
			});
		});

		const deleteButton = controlsEl.createEl("button", {
			text: "Delete",
			cls: `${cls("caldav-account-btn")} ${cls("caldav-account-btn-delete")}`,
		});
		deleteButton.addEventListener("click", () => {
			this.handleDeleteAccount(account, container);
		});
	}

	private handleSyncClick(button: HTMLButtonElement, account: CalDAVAccount): void {
		button.disabled = true;
		button.setText("Syncing...");

		void (async () => {
			try {
				await this.plugin.syncSingleAccount(account);
			} finally {
				button.disabled = false;
				button.setText("Sync now");
			}
		})();
	}

	private handleDeleteAccount(account: CalDAVAccount, container: HTMLElement): void {
		const bundle = this.plugin.calendarBundles.find((b) => b.calendarId === account.calendarId);
		if (!bundle) {
			showConfirmDeleteModal(this.app, account.name, "account", () => {
				void this.deleteAccount(account.id, container);
			});
			return;
		}

		const events = bundle.caldavSyncStateManager.getAllForAccount(account.id);
		if (events.length === 0) {
			showConfirmDeleteModal(this.app, account.name, "account", () => {
				void this.deleteAccount(account.id, container);
			});
			return;
		}

		showCalendarIntegrationDeleteEventsModal(this.app, {
			accountName: account.name,
			eventCount: events.length,
			onConfirm: async () => {
				await this.deleteEventsForAccount(bundle, account.id);
				await this.deleteAccount(account.id, container);
			},
			onCancel: async () => {
				await this.deleteAccount(account.id, container);
			},
		});
	}

	private async deleteEventsForAccount(bundle: CalendarBundle, accountId: string): Promise<void> {
		const events = bundle.caldavSyncStateManager.getAllForAccount(accountId);
		await deleteTrackedIntegrationEvents(
			this.app,
			bundle,
			events,
			getCalendarById(this.settingsStore.currentSettings, this.calendarId)?.fileConcurrencyLimit,
			"CalDAV",
			`account ${accountId}`
		);
	}

	private async deleteAccount(accountId: string, container: HTMLElement): Promise<void> {
		await this.settingsStore.updateSettings((s) => ({
			...s,
			caldav: {
				...s.caldav,
				accounts: s.caldav.accounts.filter((a) => a.id !== accountId),
			},
		}));
		this.refreshAccountsList(container.parentElement!);
	}

	private refreshAccountsList(wrapper: HTMLElement): void {
		this.renderAccountsListContent(wrapper);
	}
}
