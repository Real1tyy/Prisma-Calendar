import { addCls, cls, registerSubmitHotkey, showModal } from "@real1ty-obsidian-plugins";
import { type App, PluginSettingTab, Setting } from "obsidian";

import { FREE_MAX_CALENDARS } from "../../core/license";
import { CalendarSettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import {
	createDefaultCalendarConfig,
	duplicateCalendarConfig,
	generateUniqueCalendarId,
} from "../../utils/calendar-settings";
import { SingleCalendarSettings } from "./single-calendar-settings";

export class CustomCalendarSettingsTab extends PluginSettingTab {
	plugin: CustomCalendarPlugin;
	private selectedCalendarId: string = "default";
	private calendarSettings: Map<string, SingleCalendarSettings> = new Map();
	private calendarStores: Map<string, CalendarSettingsStore> = new Map();

	private getMaxCalendars(): number {
		return this.plugin.isProEnabled ? Infinity : FREE_MAX_CALENDARS;
	}

	private isAtMaxCalendars(): boolean {
		return this.plugin.settingsStore.currentSettings.calendars.length >= this.getMaxCalendars();
	}

	private configureMaxCalendarsButton(button: HTMLButtonElement): void {
		if (this.isAtMaxCalendars()) {
			button.disabled = true;
			addCls(button, "calendar-button-disabled");
			const max = this.getMaxCalendars();
			button.title = `Free plan allows up to ${max} calendars. Upgrade to Pro for unlimited.`;
		}
	}

	private configureMinCalendarsButton(button: HTMLButtonElement): void {
		const settings = this.plugin.settingsStore.currentSettings;
		if (settings.calendars.length <= 1) {
			button.disabled = true;
			addCls(button, "calendar-button-disabled");
			button.title = "At least one calendar is required";
		}
	}

	constructor(app: App, plugin: CustomCalendarPlugin) {
		super(app, plugin);
		this.plugin = plugin;

		const firstCalendar = this.plugin.settingsStore.currentSettings.calendars[0];
		this.selectedCalendarId = firstCalendar.id;

		this.plugin.licenseManager.status$.subscribe(() => {
			if (this.containerEl.isShown()) {
				this.display();
			}
		});
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.createCalendarManagementHeader();
		this.renderSelectedCalendarSettings();
	}

	private createCalendarManagementHeader(): void {
		const { containerEl } = this;
		const settings = this.plugin.settingsStore.currentSettings;

		new Setting(containerEl).setName("Calendar management").setHeading();

		const headerContainer = containerEl.createDiv(`${cls("calendar-management")} ${cls("calendar-management-header")}`);

		new Setting(headerContainer)
			.setName("Active calendar")
			.setDesc("Select which calendar to configure")
			.addDropdown((dropdown) => {
				settings.calendars.forEach((calendar) => {
					dropdown.addOption(calendar.id, `${calendar.name} ${calendar.enabled ? "" : "(disabled)"}`);
				});

				dropdown.setValue(this.selectedCalendarId);
				dropdown.onChange((value) => {
					this.selectedCalendarId = value;
					this.display();
				});
			});

		// Calendar actions
		const actionsContainer = headerContainer.createDiv(cls("calendar-actions"));

		// Create New Calendar button
		const createButton = actionsContainer.createEl("button", {
			text: "Create new",
			cls: `${cls("calendar-action-button")} ${cls("calendar-create-button")}`,
		});
		createButton.setAttribute("data-testid", "prisma-settings-calendar-add");

		this.configureMaxCalendarsButton(createButton);
		createButton.addEventListener("click", () => {
			void this.createNewCalendar();
		});

		// Clone Calendar button
		const cloneButton = actionsContainer.createEl("button", {
			text: "Clone current",
			cls: `${cls("calendar-action-button")} ${cls("calendar-clone-button")}`,
		});
		cloneButton.setAttribute("data-testid", "prisma-settings-calendar-clone");

		this.configureMaxCalendarsButton(cloneButton);
		cloneButton.addEventListener("click", () => {
			void this.cloneCurrentCalendar();
		});

		// Rename Calendar button
		const renameButton = actionsContainer.createEl("button", {
			text: "Rename current",
			cls: `${cls("calendar-action-button")} ${cls("calendar-rename-button")}`,
		});
		renameButton.setAttribute("data-testid", "prisma-settings-calendar-rename");

		renameButton.addEventListener("click", () => {
			void this.renameCurrentCalendar();
		});

		// Delete Calendar button
		const deleteButton = actionsContainer.createEl("button", {
			text: "Delete current",
			cls: `${cls("calendar-action-button")} ${cls("calendar-delete-button")}`,
		});
		deleteButton.setAttribute("data-testid", "prisma-settings-calendar-delete");

		this.configureMinCalendarsButton(deleteButton);
		deleteButton.addEventListener("click", () => {
			void this.deleteCurrentCalendar();
		});

		// Calendar count info
		const countInfo = headerContainer.createDiv(cls("calendar-count-info"));
		const max = this.getMaxCalendars();
		countInfo.textContent =
			max === Infinity ? `${settings.calendars.length} calendars` : `${settings.calendars.length}/${max} calendars`;
	}

	private renderSelectedCalendarSettings(): void {
		const { containerEl } = this;

		const settingsContainer = containerEl.createDiv(cls("calendar-settings-container"));

		const calendarStore = this.getOrCreateCalendarStore(this.selectedCalendarId);
		if (!calendarStore) {
			settingsContainer.createEl("p", {
				text: "Calendar not found",
				cls: "setting-item-description",
			});
			return;
		}

		const singleCalendarSettings = this.getOrCreateSingleCalendarSettings(calendarStore);
		singleCalendarSettings.display(settingsContainer);
	}

	private getOrCreateCalendarStore(calendarId: string): CalendarSettingsStore | null {
		if (!this.calendarStores.has(calendarId)) {
			try {
				const store = new CalendarSettingsStore(this.plugin.settingsStore, calendarId);
				this.calendarStores.set(calendarId, store);
				return store;
			} catch (error) {
				console.error(`[Settings] Failed to create calendar store for ${calendarId}:`, error);
				return null;
			}
		}
		return this.calendarStores.get(calendarId)!;
	}

	private getOrCreateSingleCalendarSettings(calendarStore: CalendarSettingsStore): SingleCalendarSettings {
		const calendarId = calendarStore.calendarId;
		if (!this.calendarSettings.has(calendarId)) {
			const settings = new SingleCalendarSettings(calendarStore, this.app, this.plugin, this.plugin.settingsStore);
			this.calendarSettings.set(calendarId, settings);
			return settings;
		}
		return this.calendarSettings.get(calendarId)!;
	}

	private async createNewCalendar(): Promise<void> {
		const settings = this.plugin.settingsStore.currentSettings;
		if (this.isAtMaxCalendars()) {
			return;
		}

		const newId = generateUniqueCalendarId(settings);
		const newName = `Calendar ${settings.calendars.length + 1}`;
		const newCalendar = createDefaultCalendarConfig(newId, newName);

		await this.plugin.settingsStore.updateSettings((currentSettings) => ({
			...currentSettings,
			calendars: [...currentSettings.calendars, newCalendar],
		}));

		this.selectedCalendarId = newId;
		await this.plugin.refreshCalendarBundles();
		this.display();
	}

	private async cloneCurrentCalendar(): Promise<void> {
		const settings = this.plugin.settingsStore.currentSettings;
		if (this.isAtMaxCalendars()) {
			return;
		}

		const currentCalendar = settings.calendars.find((c) => c.id === this.selectedCalendarId);
		if (!currentCalendar) {
			return;
		}

		const newId = generateUniqueCalendarId(settings);
		const newName = `${currentCalendar.name} (Copy)`;
		const clonedCalendar = duplicateCalendarConfig(currentCalendar, newId, newName);

		await this.plugin.settingsStore.updateSettings((currentSettings) => ({
			...currentSettings,
			calendars: [...currentSettings.calendars, clonedCalendar],
		}));

		this.selectedCalendarId = newId;
		await this.plugin.refreshCalendarBundles();
		this.display();
	}

	private async deleteCurrentCalendar(): Promise<void> {
		const settings = this.plugin.settingsStore.currentSettings;
		if (settings.calendars.length <= 1) {
			return;
		}

		const currentCalendarIndex = settings.calendars.findIndex((c) => c.id === this.selectedCalendarId);
		if (currentCalendarIndex === -1) {
			return;
		}

		// Clean up stores and settings for deleted calendar
		const calendarStore = this.calendarStores.get(this.selectedCalendarId);
		if (calendarStore) {
			calendarStore.destroy();
			this.calendarStores.delete(this.selectedCalendarId);
		}
		this.calendarSettings.delete(this.selectedCalendarId);

		const updatedCalendars = settings.calendars.filter((c) => c.id !== this.selectedCalendarId);

		// Select next available calendar
		const nextCalendar = updatedCalendars[Math.min(currentCalendarIndex, updatedCalendars.length - 1)];
		this.selectedCalendarId = nextCalendar.id;

		await this.plugin.settingsStore.updateSettings((currentSettings) => ({
			...currentSettings,
			calendars: updatedCalendars,
		}));

		await this.plugin.refreshCalendarBundles();
		this.display();
	}

	private renameCurrentCalendar(): void {
		const settings = this.plugin.settingsStore.currentSettings;
		const currentCalendar = settings.calendars.find((c) => c.id === this.selectedCalendarId);

		if (!currentCalendar) {
			return;
		}

		showRenameCalendarModal(this.app, currentCalendar.name, async (newName) => {
			if (newName && newName !== currentCalendar.name) {
				await this.plugin.settingsStore.updateSettings((currentSettings) => ({
					...currentSettings,
					calendars: currentSettings.calendars.map((calendar) =>
						calendar.id === this.selectedCalendarId ? { ...calendar, name: newName } : calendar
					),
				}));

				await this.plugin.refreshCalendarBundles();
				this.display();
			}
		});
	}
}

function showRenameCalendarModal(app: App, currentName: string, onSubmit: (name: string) => void): void {
	let newName = currentName;

	showModal({
		app,
		cls: cls("rename-calendar-modal"),
		render: (el, ctx) => {
			el.createEl("h2", { text: "Rename calendar" });

			new Setting(el)
				.setName("Calendar name")
				.setDesc("Enter the new name for the calendar.")
				.addText((text) => {
					text.setValue(currentName).onChange((value) => {
						newName = value.trim();
					});
					text.inputEl.setAttribute("data-cy", "rename-calendar-input");
					text.inputEl.setAttribute("data-testid", "prisma-settings-calendar-rename-input");
					setTimeout(() => {
						text.inputEl.focus();
						text.inputEl.select();
					}, 50);
				});

			new Setting(el)
				.addButton((button) => {
					button.setButtonText("Cancel").onClick(() => {
						ctx.close();
					});
					button.buttonEl.setAttribute("data-testid", "prisma-settings-calendar-rename-cancel");
				})
				.addButton((button) => {
					button
						.setButtonText("Save")
						.setCta()
						.onClick(() => {
							onSubmit(newName);
							ctx.close();
						});
					button.buttonEl.setAttribute("data-testid", "prisma-settings-calendar-rename-save");
				});

			if (ctx.type === "modal") {
				registerSubmitHotkey(ctx.scope, () => {
					onSubmit(newName);
					ctx.close();
				});
			}
		},
	});
}
