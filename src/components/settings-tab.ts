import { type App, PluginSettingTab, Setting } from "obsidian";
import { CalendarSettingsStore } from "../core/settings-store";
import type CustomCalendarPlugin from "../main";
import {
	createDefaultCalendarConfig,
	duplicateCalendarConfig,
	generateUniqueCalendarId,
	MAX_CALENDARS,
} from "../types/settings-schemas";
import { SingleCalendarSettings } from "./single-calendar-settings";

export class CustomCalendarSettingsTab extends PluginSettingTab {
	plugin: CustomCalendarPlugin;
	private selectedCalendarId: string = "default";
	private calendarSettings: Map<string, SingleCalendarSettings> = new Map();
	private calendarStores: Map<string, CalendarSettingsStore> = new Map();

	constructor(app: App, plugin: CustomCalendarPlugin) {
		super(app, plugin);
		this.plugin = plugin;

		const firstCalendar = this.plugin.settingsStore.currentSettings.calendars[0];
		this.selectedCalendarId = firstCalendar.id;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Custom Calendar Settings" });

		this.createCalendarManagementHeader();
		this.renderSelectedCalendarSettings();
	}

	private createCalendarManagementHeader(): void {
		const { containerEl } = this;
		const settings = this.plugin.settingsStore.currentSettings;

		const headerContainer = containerEl.createDiv("calendar-management");
		headerContainer.style.marginBottom = "24px";
		headerContainer.style.padding = "16px";
		headerContainer.style.backgroundColor = "var(--background-secondary)";
		headerContainer.style.borderRadius = "8px";
		headerContainer.style.border = "1px solid var(--background-modifier-border)";

		headerContainer.createEl("h3", { text: "Calendar Management" });

		new Setting(headerContainer)
			.setName("Active Calendar")
			.setDesc("Select which calendar to configure")
			.addDropdown((dropdown) => {
				settings.calendars.forEach((calendar) => {
					dropdown.addOption(
						calendar.id,
						`${calendar.name} ${calendar.enabled ? "" : "(disabled)"}`
					);
				});

				dropdown.setValue(this.selectedCalendarId);
				dropdown.onChange(async (value) => {
					this.selectedCalendarId = value;
					this.display();
				});
			});

		// Calendar actions
		const actionsContainer = headerContainer.createDiv("calendar-actions");
		actionsContainer.style.display = "flex";
		actionsContainer.style.gap = "8px";
		actionsContainer.style.marginTop = "12px";
		actionsContainer.style.flexWrap = "wrap";

		// Create New Calendar button
		const createButton = actionsContainer.createEl("button", { text: "Create New" });
		createButton.style.padding = "6px 12px";
		createButton.style.border = "1px solid var(--interactive-accent)";
		createButton.style.borderRadius = "4px";
		createButton.style.backgroundColor = "var(--interactive-accent)";
		createButton.style.color = "var(--text-on-accent)";
		createButton.style.cursor = "pointer";

		if (settings.calendars.length >= MAX_CALENDARS) {
			createButton.disabled = true;
			createButton.style.opacity = "0.5";
			createButton.title = `Maximum ${MAX_CALENDARS} calendars allowed`;
		}

		createButton.addEventListener("click", () => this.createNewCalendar());

		// Clone Calendar button
		const cloneButton = actionsContainer.createEl("button", { text: "Clone Current" });
		cloneButton.style.padding = "6px 12px";
		cloneButton.style.border = "1px solid var(--background-modifier-border)";
		cloneButton.style.borderRadius = "4px";
		cloneButton.style.backgroundColor = "var(--background-secondary)";
		cloneButton.style.cursor = "pointer";

		if (settings.calendars.length >= MAX_CALENDARS) {
			cloneButton.disabled = true;
			cloneButton.style.opacity = "0.5";
			cloneButton.title = `Maximum ${MAX_CALENDARS} calendars allowed`;
		}

		cloneButton.addEventListener("click", () => this.cloneCurrentCalendar());

		// Delete Calendar button
		const deleteButton = actionsContainer.createEl("button", { text: "Delete Current" });
		deleteButton.style.padding = "6px 12px";
		deleteButton.style.border = "1px solid var(--text-error)";
		deleteButton.style.borderRadius = "4px";
		deleteButton.style.backgroundColor = "var(--background-primary)";
		deleteButton.style.color = "var(--text-error)";
		deleteButton.style.cursor = "pointer";

		if (settings.calendars.length <= 1) {
			deleteButton.disabled = true;
			deleteButton.style.opacity = "0.5";
			deleteButton.title = "At least one calendar is required";
		}

		deleteButton.addEventListener("click", () => this.deleteCurrentCalendar());

		// Calendar count info
		const countInfo = headerContainer.createDiv();
		countInfo.style.marginTop = "8px";
		countInfo.style.fontSize = "12px";
		countInfo.style.color = "var(--text-muted)";
		countInfo.textContent = `${settings.calendars.length}/${MAX_CALENDARS} calendars`;
	}

	private renderSelectedCalendarSettings(): void {
		const { containerEl } = this;

		const settingsContainer = containerEl.createDiv("calendar-settings-container");

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
				console.error(`Failed to create calendar store for ${calendarId}:`, error);
				return null;
			}
		}
		return this.calendarStores.get(calendarId)!;
	}

	private getOrCreateSingleCalendarSettings(
		calendarStore: CalendarSettingsStore
	): SingleCalendarSettings {
		const calendarId = calendarStore.calendarId;
		if (!this.calendarSettings.has(calendarId)) {
			const settings = new SingleCalendarSettings(calendarStore);
			this.calendarSettings.set(calendarId, settings);
			return settings;
		}
		return this.calendarSettings.get(calendarId)!;
	}

	private async createNewCalendar(): Promise<void> {
		const settings = this.plugin.settingsStore.currentSettings;

		if (settings.calendars.length >= MAX_CALENDARS) {
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

		if (settings.calendars.length >= MAX_CALENDARS) {
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

		const currentCalendarIndex = settings.calendars.findIndex(
			(c) => c.id === this.selectedCalendarId
		);
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
		const nextCalendar =
			updatedCalendars[Math.min(currentCalendarIndex, updatedCalendars.length - 1)];
		this.selectedCalendarId = nextCalendar.id;

		await this.plugin.settingsStore.updateSettings((currentSettings) => ({
			...currentSettings,
			calendars: updatedCalendars,
		}));

		await this.plugin.refreshCalendarBundles();
		this.display();
	}
}
