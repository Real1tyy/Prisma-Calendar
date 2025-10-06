import type { CalendarSettingsStore } from "../../core/settings-store";
import { CalendarSettings, GeneralSettings, GoogleCalendarSettings, PropertiesSettings, RulesSettings } from ".";

export class SingleCalendarSettings {
	private activeSection: "general" | "properties" | "calendar" | "google" | "rules" = "general";

	private generalSettings: GeneralSettings;
	private propertiesSettings: PropertiesSettings;
	private calendarSettings: CalendarSettings;
	private googleCalendarSettings: GoogleCalendarSettings;
	private rulesSettings: RulesSettings;

	constructor(settingsStore: CalendarSettingsStore) {
		this.generalSettings = new GeneralSettings(settingsStore);
		this.propertiesSettings = new PropertiesSettings(settingsStore);
		this.calendarSettings = new CalendarSettings(settingsStore);
		this.googleCalendarSettings = new GoogleCalendarSettings(settingsStore);
		this.rulesSettings = new RulesSettings(settingsStore);
	}

	display(containerEl: HTMLElement): void {
		containerEl.empty();

		this.createSectionNavigation(containerEl);
		this.renderActiveSection(containerEl);
	}

	private createSectionNavigation(containerEl: HTMLElement): void {
		const navContainer = containerEl.createDiv("settings-nav");
		const buttonContainer = navContainer.createDiv("nav-buttons");

		const sections = [
			{ id: "general" as const, label: "General" },
			{ id: "properties" as const, label: "Properties" },
			{ id: "calendar" as const, label: "Calendar" },
			{ id: "google" as const, label: "Google Calendar" },
			{ id: "rules" as const, label: "Rules" },
		];

		sections.forEach((section) => {
			const button = buttonContainer.createEl("button", { text: section.label });
			if (this.activeSection === section.id) {
				button.addClass("active");
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
			case "google":
				this.googleCalendarSettings.display(contentContainer);
				break;
			case "rules":
				this.rulesSettings.display(contentContainer);
				break;
		}
	}
}
