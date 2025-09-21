import { type App, Modal, PluginSettingTab, Setting } from "obsidian";
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

		this.createCalendarManagementHeader();
		this.renderSelectedCalendarSettings();

		const footerEl = containerEl.createDiv({ cls: "setting-item" });
		footerEl.style.marginTop = "2rem";
		footerEl.style.textAlign = "center";
		footerEl.style.fontSize = "var(--font-ui-smaller)";
		footerEl.style.color = "var(--text-faint)";

		const supportLink = footerEl.createEl("a", {
			text: "Support Prisma Calendar Development",
			href: "https://github.com/sponsors/Real1tyy",
		});
		supportLink.style.textDecoration = "none";
		supportLink.style.color = "var(--text-accent)";
	}

	private createCalendarManagementHeader(): void {
		const { containerEl } = this;
		const settings = this.plugin.settingsStore.currentSettings;

		new Setting(containerEl).setName("Calendar Management").setHeading();

		const headerContainer = containerEl.createDiv("calendar-management");
		headerContainer.style.marginBottom = "24px";
		headerContainer.style.padding = "16px";
		headerContainer.style.backgroundColor = "var(--background-secondary)";
		headerContainer.style.borderRadius = "8px";
		headerContainer.style.border = "1px solid var(--background-modifier-border)";

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

		// Rename Calendar button
		const renameButton = actionsContainer.createEl("button", { text: "Rename current" });
		renameButton.style.padding = "6px 12px";
		renameButton.style.border = "1px solid var(--background-modifier-border)";
		renameButton.style.borderRadius = "4px";
		renameButton.style.backgroundColor = "var(--background-secondary)";
		renameButton.style.cursor = "pointer";

		renameButton.addEventListener("click", () => this.renameCurrentCalendar());

		// Delete Calendar button
		const deleteButton = actionsContainer.createEl("button", { text: "Delete current" });
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

	private async renameCurrentCalendar(): Promise<void> {
		const settings = this.plugin.settingsStore.currentSettings;
		const currentCalendar = settings.calendars.find((c) => c.id === this.selectedCalendarId);

		if (!currentCalendar) {
			return;
		}

		new RenameCalendarModal(this.app, currentCalendar.name, async (newName) => {
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
		}).open();
	}
}

class RenameCalendarModal extends Modal {
	private newName: string;
	private currentName: string;
	private onSubmit: (name: string) => void;

	constructor(app: App, currentName: string, onSubmit: (name: string) => void) {
		super(app);
		this.currentName = currentName;
		this.newName = currentName;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Rename calendar" });

		new Setting(contentEl)
			.setName("Calendar name")
			.setDesc("Enter the new name for the calendar.")
			.addText((text) => {
				text.setValue(this.currentName).onChange((value) => {
					this.newName = value.trim();
				});
				text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
					if (e.key === "Enter") {
						e.preventDefault();
						this.submit();
					}
				});
				text.inputEl.setAttribute("data-cy", "rename-calendar-input");
			});

		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText("Cancel").onClick(() => {
					this.close();
				})
			)
			.addButton((button) =>
				button
					.setButtonText("Save")
					.setCta()
					.onClick(() => {
						this.submit();
					})
			);

		// Ensure the input is focused when the modal opens
		setTimeout(() => {
			const inputEl = this.contentEl.querySelector("input");
			if (inputEl) {
				inputEl.focus();
				inputEl.select();
			}
		}, 50);
	}

	submit() {
		if (this.newName && this.newName !== this.currentName) {
			this.onSubmit(this.newName);
		}
		this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
