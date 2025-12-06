import { addCls, cls } from "@real1ty-obsidian-plugins/utils";
import type { App } from "obsidian";
import type { CalendarSettingsStore, SettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import { CalendarSettings, GeneralSettings, NotificationsSettings, PropertiesSettings, RulesSettings } from ".";

export class SingleCalendarSettings {
	private activeSection: "general" | "properties" | "calendar" | "notifications" | "rules" = "general";

	private generalSettings: GeneralSettings;
	private propertiesSettings: PropertiesSettings;
	private calendarSettings: CalendarSettings;
	private notificationsSettings: NotificationsSettings;
	private rulesSettings: RulesSettings;

	constructor(
		settingsStore: CalendarSettingsStore,
		app: App,
		plugin: CustomCalendarPlugin,
		mainSettingsStore: SettingsStore
	) {
		this.generalSettings = new GeneralSettings(settingsStore, app, plugin, mainSettingsStore);
		this.propertiesSettings = new PropertiesSettings(settingsStore);
		this.calendarSettings = new CalendarSettings(settingsStore);
		this.notificationsSettings = new NotificationsSettings(settingsStore);
		this.rulesSettings = new RulesSettings(settingsStore);
	}

	display(containerEl: HTMLElement): void {
		containerEl.empty();

		this.createSectionNavigation(containerEl);
		this.renderActiveSection(containerEl);
	}

	private createSectionNavigation(containerEl: HTMLElement): void {
		const navContainer = containerEl.createDiv(cls("settings-nav"));
		const buttonContainer = navContainer.createDiv(cls("nav-buttons"));

		const sections = [
			{ id: "general" as const, label: "General" },
			{ id: "properties" as const, label: "Properties" },
			{ id: "calendar" as const, label: "Calendar" },
			{ id: "notifications" as const, label: "Notifications" },
			{ id: "rules" as const, label: "Rules" },
		];

		sections.forEach((section) => {
			const button = buttonContainer.createEl("button", { text: section.label });
			if (this.activeSection === section.id) {
				addCls(button, "active");
			}

			button.addEventListener("click", () => {
				this.activeSection = section.id;
				this.display(containerEl); // Re-render with new active section
			});
		});
	}

	private renderActiveSection(containerEl: HTMLElement): void {
		// Create container for active section content
		const contentContainer = containerEl.createDiv("settings-content");

		switch (this.activeSection) {
			case "general":
				this.generalSettings.display(contentContainer);
				break;
			case "properties":
				this.propertiesSettings.display(contentContainer);
				break;
			case "calendar":
				this.calendarSettings.display(contentContainer);
				break;
			case "notifications":
				this.notificationsSettings.display(contentContainer);
				break;
			case "rules":
				this.rulesSettings.display(contentContainer);
				break;
		}
	}
}
