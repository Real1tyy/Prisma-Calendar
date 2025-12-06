import { cls } from "@real1ty-obsidian-plugins/utils";
import { nanoid } from "nanoid";
import { type App, Modal, Notice, Setting } from "obsidian";
import {
	CALDAV_PRESETS,
	type CalDAVAccount,
	type CalDAVCalendarInfo,
	CalDAVClientService,
	type CalDAVPresetKey,
} from "../../core/integrations/caldav";
import type { SettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";

export class CalDAVSettings {
	private client: CalDAVClientService;

	constructor(
		private app: App,
		private settingsStore: SettingsStore,
		private plugin: CustomCalendarPlugin
	) {
		this.client = new CalDAVClientService();
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
		const caldavSettings = this.settingsStore.currentSettings.caldav;
		const accountsContainer = containerEl.createDiv(cls("caldav-accounts-container"));

		if (caldavSettings.accounts.length === 0) {
			const emptyState = accountsContainer.createDiv(cls("caldav-accounts-empty"));
			emptyState.setText("No accounts configured.");
		} else {
			for (const account of caldavSettings.accounts) {
				this.renderAccountItem(accountsContainer, account);
			}
		}

		const addButton = containerEl.createEl("button", {
			text: "Add account",
			cls: cls("caldav-add-account-button"),
		});
		addButton.addEventListener("click", () => {
			new AddCalDAVAccountModal(this.app, this.settingsStore, this.client, () => {
				this.refreshAccountsList(containerEl);
			}).open();
		});
	}

	private renderGlobalSettings(containerEl: HTMLElement): void {
		const caldavSettings = this.settingsStore.currentSettings.caldav;
		new Setting(containerEl)
			.setName("Sync on startup")
			.setDesc("Automatically sync calendars when the app starts")
			.addToggle((toggle) => {
				toggle.setValue(caldavSettings.syncOnStartup).onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({
						...s,
						caldav: {
							...s.caldav,
							syncOnStartup: value,
						},
					}));
				});
			});
	}

	private renderAccountItem(container: HTMLElement, account: CalDAVAccount): void {
		const itemEl = container.createDiv(cls("caldav-account-item"));

		const infoEl = itemEl.createDiv(cls("caldav-account-info"));
		const nameEl = infoEl.createEl("div", { cls: cls("caldav-account-name") });
		nameEl.setText(account.name);

		const urlEl = infoEl.createEl("div", { cls: cls("caldav-account-url") });
		urlEl.setText(account.serverUrl);

		const dirEl = infoEl.createEl("div", { cls: cls("caldav-account-dir") });
		dirEl.setText(`📁 ${account.syncDirectory}`);

		const statusEl = infoEl.createEl("div", {
			cls: `${cls("caldav-account-status")} ${account.enabled ? cls("caldav-status-enabled") : cls("caldav-status-disabled")}`,
		});
		statusEl.setText(account.enabled ? "Enabled" : "Disabled");

		if (account.selectedCalendars.length > 0) {
			const calendarsEl = infoEl.createEl("div", { cls: cls("caldav-account-calendars") });
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
			new EditCalDAVAccountModal(this.app, this.settingsStore, this.client, account, () => {
				this.refreshAccountsList(container.parentElement!);
			}).open();
		});

		const deleteButton = controlsEl.createEl("button", {
			text: "Delete",
			cls: `${cls("caldav-account-btn")} ${cls("caldav-account-btn-delete")}`,
		});
		deleteButton.addEventListener("click", () => {
			new ConfirmDeleteAccountModal(this.app, account.name, () => {
				void this.deleteAccount(account.id, container);
			}).open();
		});
	}

	private handleSyncClick(button: HTMLButtonElement, account: CalDAVAccount): void {
		button.disabled = true;
		button.setText("Syncing...");

		void (async () => {
			try {
				await this.plugin.syncSingleAccount(account.id);
			} finally {
				button.disabled = false;
				button.setText("Sync now");
			}
		})();
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

	private refreshAccountsList(parentContainer: HTMLElement): void {
		const accountsContainer = parentContainer.querySelector(`.${cls("caldav-accounts-container")}`);
		if (accountsContainer) {
			accountsContainer.remove();
		}
		const addButton = parentContainer.querySelector(`.${cls("caldav-add-account-button")}`);
		if (addButton) {
			addButton.remove();
		}
		this.renderAccountsList(parentContainer);
	}
}

class ConfirmDeleteAccountModal extends Modal {
	constructor(
		app: App,
		private accountName: string,
		private onConfirm: () => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Delete account" });
		contentEl.createEl("p", { text: `Are you sure you want to delete the account "${this.accountName}"?` });

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText("Cancel").onClick(() => {
					this.close();
				});
			})
			.addButton((button) => {
				button
					.setButtonText("Delete")
					.setWarning()
					.onClick(() => {
						this.onConfirm();
						this.close();
					});
			});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class AddCalDAVAccountModal extends Modal {
	private name = "";
	private serverUrl = "";
	private username = "";
	private password = "";
	private syncDirectory = "";
	private syncIntervalMinutes = 15;
	private authMethod: "Basic" | "Oauth" = "Basic";
	private discoveredCalendars: CalDAVCalendarInfo[] = [];
	private selectedCalendars: string[] = [];
	private testPassed = false;

	constructor(
		app: App,
		private settingsStore: SettingsStore,
		private client: CalDAVClientService,
		private onSave: () => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass(cls("caldav-modal"));

		contentEl.createEl("h2", { text: "Add account" });

		this.renderPresetSelector(contentEl);
		this.renderForm(contentEl);
		this.renderCalendarSelector(contentEl);
		this.renderActions(contentEl);
	}

	private renderPresetSelector(container: HTMLElement): void {
		new Setting(container)
			.setName("Provider preset")
			.setDesc("Select a provider to pre-fill the server address")
			.addDropdown((dropdown) => {
				dropdown.addOption("", "Custom");
				for (const [key, preset] of Object.entries(CALDAV_PRESETS)) {
					dropdown.addOption(key, preset.name);
				}
				dropdown.onChange((value) => {
					if (value && value in CALDAV_PRESETS) {
						const preset = CALDAV_PRESETS[value as CalDAVPresetKey];
						this.name = preset.name;
						this.serverUrl = preset.serverUrl;
						this.authMethod = preset.authMethod;
						this.refreshForm();
					}
				});
			});
	}

	private renderForm(container: HTMLElement): void {
		const formContainer = container.createDiv(cls("caldav-form"));

		new Setting(formContainer)
			.setName("Account name")
			.setDesc("Display name for this account")
			.addText((text) => {
				text
					.setPlaceholder("My calendar")
					.setValue(this.name)
					.onChange((value) => {
						this.name = value;
						if (!this.syncDirectory) {
							this.syncDirectory = `Calendars/${value.replace(/[/\\?%*:|"<>]/g, "-")}`;
						}
					});
			});

		new Setting(formContainer)
			.setName("Sync directory")
			.setDesc("Folder where events from this account will be stored")
			.addText((text) => {
				text
					.setPlaceholder("Folder name")
					.setValue(this.syncDirectory)
					.onChange((value) => {
						this.syncDirectory = value;
					});
			});

		new Setting(formContainer)
			.setName("Sync interval (minutes)")
			.setDesc("How often to automatically sync this account (1-1440 minutes)")
			.addSlider((slider) => {
				slider
					.setLimits(1, 1440, 1)
					.setValue(this.syncIntervalMinutes)
					.setDynamicTooltip()
					.onChange((value) => {
						this.syncIntervalMinutes = value;
					});
			});

		new Setting(formContainer)
			.setName("Server address")
			.setDesc("The calendar server address")
			.addText((text) => {
				text
					.setPlaceholder("https://caldav.example.com/dav/")
					.setValue(this.serverUrl)
					.onChange((value) => {
						this.serverUrl = value;
						this.testPassed = false;
					});
			});

		new Setting(formContainer).setName("Username").addText((text) => {
			text
				.setPlaceholder("Your username")
				.setValue(this.username)
				.onChange((value) => {
					this.username = value;
					this.testPassed = false;
				});
		});

		new Setting(formContainer)
			.setName("Password / app password")
			.setDesc("Use an app-specific password for cloud providers")
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setPlaceholder("••••••••")
					.setValue(this.password)
					.onChange((value) => {
						this.password = value;
						this.testPassed = false;
					});
			});

		const testButton = formContainer.createEl("button", {
			text: "Test connection & discover calendars",
			cls: cls("caldav-test-button"),
		});
		testButton.addEventListener("click", () => {
			void this.testConnection(testButton);
		});
	}

	private renderCalendarSelector(container: HTMLElement): void {
		const selectorContainer = container.createDiv(cls("caldav-calendar-selector"));

		if (this.discoveredCalendars.length === 0) {
			selectorContainer.createEl("p", {
				text: "Test connection to discover available calendars",
				cls: cls("settings-muted"),
			});
			return;
		}

		selectorContainer.createEl("h3", { text: "Select calendars to sync" });

		for (const calendar of this.discoveredCalendars) {
			const calendarItem = selectorContainer.createDiv(cls("caldav-calendar-item"));

			const checkbox = calendarItem.createEl("input", { type: "checkbox" });
			checkbox.checked = this.selectedCalendars.includes(calendar.url);
			checkbox.addEventListener("change", () => {
				if (checkbox.checked) {
					this.selectedCalendars.push(calendar.url);
				} else {
					this.selectedCalendars = this.selectedCalendars.filter((u) => u !== calendar.url);
				}
			});

			const label = calendarItem.createEl("label");
			label.createEl("strong", { text: calendar.displayName });
			if (calendar.description) {
				label.createEl("span", { text: ` — ${calendar.description}`, cls: cls("settings-muted") });
			}
		}
	}

	private renderActions(container: HTMLElement): void {
		new Setting(container)
			.addButton((button) => {
				button.setButtonText("Cancel").onClick(() => {
					this.close();
				});
			})
			.addButton((button) => {
				button
					.setButtonText("Add account")
					.setCta()
					.onClick(() => {
						void this.saveAccount();
					});
			});
	}

	private async testConnection(button: HTMLButtonElement): Promise<void> {
		if (!this.serverUrl || !this.username || !this.password) {
			new Notice("Please fill in server address, username, and password");
			return;
		}

		button.disabled = true;
		button.setText("Testing...");

		try {
			const result = await this.client.testConnection({
				id: "test",
				name: this.name || "Test",
				serverUrl: this.serverUrl,
				authMethod: this.authMethod,
				credentials: {
					username: this.username,
					password: this.password,
				},
				enabled: true,
				syncDirectory: this.syncDirectory || "Calendars",
				selectedCalendars: [],
				syncIntervalMinutes: this.syncIntervalMinutes,
				createdAt: Date.now(),
			});

			if (result.success && result.calendars) {
				this.discoveredCalendars = result.calendars;
				this.selectedCalendars = result.calendars.map((c) => c.url);
				this.testPassed = true;
				new Notice(`Found ${result.calendars.length} calendar(s)`);
				this.refreshCalendarSelector();
			} else {
				new Notice(`Connection failed: ${result.error || "Unknown error"}`);
				this.testPassed = false;
			}
		} catch (error) {
			new Notice(`Connection failed: ${error}`);
			this.testPassed = false;
		} finally {
			button.disabled = false;
			button.setText("Test connection & discover calendars");
		}
	}

	private async saveAccount(): Promise<void> {
		if (!this.name || !this.serverUrl || !this.username || !this.password) {
			new Notice("Please fill in all required fields");
			return;
		}

		if (!this.syncDirectory) {
			new Notice("Please specify a sync directory");
			return;
		}

		if (!this.testPassed) {
			new Notice("Please test the connection first");
			return;
		}

		const account: CalDAVAccount = {
			id: nanoid(),
			name: this.name,
			serverUrl: this.serverUrl,
			authMethod: this.authMethod,
			credentials: {
				username: this.username,
				password: this.password,
			},
			enabled: true,
			syncDirectory: this.syncDirectory,
			selectedCalendars: this.selectedCalendars,
			syncIntervalMinutes: this.syncIntervalMinutes,
			createdAt: Date.now(),
		};

		await this.settingsStore.updateSettings((s) => ({
			...s,
			caldav: {
				...s.caldav,
				accounts: [...s.caldav.accounts, account],
			},
		}));

		new Notice(`Added account: ${this.name}`);
		this.onSave();
		this.close();
	}

	private refreshForm(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.onOpen();
	}

	private refreshCalendarSelector(): void {
		const selector = this.contentEl.querySelector(`.${cls("caldav-calendar-selector")}`);
		if (selector) {
			selector.remove();
		}
		const actions = this.contentEl.querySelector(".setting-item:last-child");
		if (actions) {
			this.renderCalendarSelector(this.contentEl);
			this.contentEl.appendChild(actions);
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class EditCalDAVAccountModal extends Modal {
	private name: string;
	private syncDirectory: string;
	private enabled: boolean;
	private syncIntervalMinutes: number;
	private selectedCalendars: string[];
	private discoveredCalendars: CalDAVCalendarInfo[] = [];

	constructor(
		app: App,
		private settingsStore: SettingsStore,
		private client: CalDAVClientService,
		private account: CalDAVAccount,
		private onSave: () => void
	) {
		super(app);
		this.name = account.name;
		this.syncDirectory = account.syncDirectory;
		this.enabled = account.enabled;
		this.syncIntervalMinutes = account.syncIntervalMinutes ?? 15;
		this.selectedCalendars = [...account.selectedCalendars];
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass(cls("caldav-modal"));

		contentEl.createEl("h2", { text: `Edit: ${this.account.name}` });

		new Setting(contentEl).setName("Account name").addText((text) => {
			text.setValue(this.name).onChange((value) => {
				this.name = value;
			});
		});

		new Setting(contentEl)
			.setName("Sync directory")
			.setDesc("Folder where events from this account are stored")
			.addText((text) => {
				text.setValue(this.syncDirectory).onChange((value) => {
					this.syncDirectory = value;
				});
			});

		new Setting(contentEl)
			.setName("Enabled")
			.setDesc("Enable or disable syncing for this account")
			.addToggle((toggle) => {
				toggle.setValue(this.enabled).onChange((value) => {
					this.enabled = value;
				});
			});

		new Setting(contentEl)
			.setName("Sync interval (minutes)")
			.setDesc("How often to automatically sync this account (1-1440 minutes)")
			.addSlider((slider) => {
				slider
					.setLimits(1, 1440, 1)
					.setValue(this.syncIntervalMinutes)
					.setDynamicTooltip()
					.onChange((value) => {
						this.syncIntervalMinutes = value;
					});
			});

		const refreshButton = contentEl.createEl("button", {
			text: "Refresh calendars",
			cls: cls("caldav-refresh-button"),
		});
		refreshButton.addEventListener("click", () => {
			void this.refreshCalendars(refreshButton);
		});

		this.renderCalendarSelector(contentEl);

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText("Cancel").onClick(() => {
					this.close();
				});
			})
			.addButton((button) => {
				button
					.setButtonText("Save")
					.setCta()
					.onClick(() => {
						void this.saveAccount();
					});
			});
	}

	private renderCalendarSelector(container: HTMLElement): void {
		const selectorContainer = container.createDiv(cls("caldav-calendar-selector"));

		if (this.discoveredCalendars.length === 0 && this.selectedCalendars.length === 0) {
			selectorContainer.createEl("p", {
				text: "Click the refresh button to see available calendars",
				cls: cls("settings-muted"),
			});
			return;
		}

		const calendarsToShow =
			this.discoveredCalendars.length > 0
				? this.discoveredCalendars
				: this.selectedCalendars.map((url) => ({
						url,
						displayName: url.split("/").pop() || url,
					}));

		selectorContainer.createEl("h3", { text: "Calendars to sync" });

		for (const calendar of calendarsToShow) {
			const calendarItem = selectorContainer.createDiv(cls("caldav-calendar-item"));

			const checkbox = calendarItem.createEl("input", { type: "checkbox" });
			checkbox.checked = this.selectedCalendars.includes(calendar.url);
			checkbox.addEventListener("change", () => {
				if (checkbox.checked) {
					this.selectedCalendars.push(calendar.url);
				} else {
					this.selectedCalendars = this.selectedCalendars.filter((u) => u !== calendar.url);
				}
			});

			const label = calendarItem.createEl("label");
			label.createEl("strong", { text: calendar.displayName });
		}
	}

	private async refreshCalendars(button: HTMLButtonElement): Promise<void> {
		button.disabled = true;
		button.setText("Refreshing...");

		try {
			const calendars = await this.client.fetchCalendars(this.account);
			this.discoveredCalendars = calendars;
			new Notice(`Found ${calendars.length} calendar(s)`);

			const selector = this.contentEl.querySelector(`.${cls("caldav-calendar-selector")}`);
			if (selector) {
				selector.remove();
			}
			const actions = this.contentEl.querySelector(".setting-item:last-child");
			if (actions) {
				this.renderCalendarSelector(this.contentEl);
				this.contentEl.appendChild(actions);
			}
		} catch (error) {
			new Notice(`Failed to refresh: ${error}`);
		} finally {
			button.disabled = false;
			button.setText("Refresh calendars");
		}
	}

	private async saveAccount(): Promise<void> {
		if (!this.syncDirectory) {
			new Notice("Please specify a sync directory");
			return;
		}

		await this.settingsStore.updateSettings((s) => ({
			...s,
			caldav: {
				...s.caldav,
				accounts: s.caldav.accounts.map((a) =>
					a.id === this.account.id
						? {
								...a,
								name: this.name,
								syncDirectory: this.syncDirectory,
								enabled: this.enabled,
								syncIntervalMinutes: this.syncIntervalMinutes,
								selectedCalendars: this.selectedCalendars,
							}
						: a
				),
			},
		}));

		new Notice(`Updated account: ${this.name}`);
		this.onSave();
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
