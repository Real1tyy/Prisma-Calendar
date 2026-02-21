import { SettingsNavigation, type SettingsSection } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import type { CalendarSettingsStore, SettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import {
	BasesSettings,
	CalendarSettings,
	CategoriesSettings,
	ConfigurationSettings,
	EventGroupsSettings,
	GeneralSettings,
	IntegrationsSettings,
	NotificationsSettings,
	PropertiesSettings,
	RulesSettings,
} from ".";

export class SingleCalendarSettings {
	private navigation: SettingsNavigation;

	constructor(
		settingsStore: CalendarSettingsStore,
		app: App,
		plugin: CustomCalendarPlugin,
		mainSettingsStore: SettingsStore
	) {
		const settingsInstances = {
			general: new GeneralSettings(settingsStore, app, plugin),
			properties: new PropertiesSettings(settingsStore),
			calendar: new CalendarSettings(settingsStore),
			eventGroups: new EventGroupsSettings(settingsStore),
			configuration: new ConfigurationSettings(settingsStore),
			notifications: new NotificationsSettings(settingsStore),
			rules: new RulesSettings(settingsStore),
			categories: new CategoriesSettings(settingsStore, plugin),
			bases: new BasesSettings(settingsStore),
			integrations: new IntegrationsSettings(settingsStore, app, plugin, mainSettingsStore),
		};

		const sections: SettingsSection[] = [
			{ id: "general", label: "General", display: (el) => settingsInstances.general.display(el) },
			{ id: "properties", label: "Properties", display: (el) => settingsInstances.properties.display(el) },
			{ id: "calendar", label: "Calendar", display: (el) => settingsInstances.calendar.display(el) },
			{ id: "event-groups", label: "Event Groups", display: (el) => settingsInstances.eventGroups.display(el) },
			{ id: "configuration", label: "Configuration", display: (el) => settingsInstances.configuration.display(el) },
			{ id: "notifications", label: "Notifications", display: (el) => settingsInstances.notifications.display(el) },
			{ id: "rules", label: "Rules", display: (el) => settingsInstances.rules.display(el) },
			{ id: "categories", label: "Categories", display: (el) => settingsInstances.categories.display(el) },
			{ id: "bases", label: "Bases", display: (el) => settingsInstances.bases.display(el) },
			{ id: "integrations", label: "Integrations", display: (el) => settingsInstances.integrations.display(el) },
		];

		this.navigation = new SettingsNavigation({
			cssPrefix: "prisma-",
			sections,
			footerLinks: [
				{ text: "Documentation", href: "https://real1tyy.github.io/Prisma-Calendar/" },
				{ text: "Changelog", href: "https://real1tyy.github.io/Prisma-Calendar/changelog" },
				{ text: "Gallery", href: "https://real1tyy.github.io/Prisma-Calendar/gallery" },
				{ text: "Support", href: "https://matejvavroproductivity.com/support/" },
				{ text: "Playlist", href: "https://www.youtube.com/playlist?list=PLMVJknbUasLCULubO4MdCDvg9MyXu3kG4" },
			],
		});
	}

	display(containerEl: HTMLElement): void {
		this.navigation.display(containerEl);
	}
}
