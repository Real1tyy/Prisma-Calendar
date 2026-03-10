import { SettingsNavigation, type SettingsSection } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import { PRO_FEATURES } from "../../core/license";
import type { CalendarSettingsStore, SettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import {
	AISettings,
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
import { renderProUpgradeBanner } from "./pro-upgrade-banner";

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
			ai: new AISettings(plugin, mainSettingsStore),
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
			{
				id: "integrations",
				label: "Integrations",
				display: (el) =>
					plugin.isProEnabled
						? settingsInstances.integrations.display(el)
						: renderProUpgradeBanner(
								el,
								PRO_FEATURES.CALDAV_SYNC,
								"CalDAV sync, ICS subscriptions, and import/export require Prisma Calendar Pro."
							),
			},
			{
				id: "ai",
				label: "AI",
				display: (el) =>
					plugin.isProEnabled
						? settingsInstances.ai.display(el)
						: renderProUpgradeBanner(
								el,
								PRO_FEATURES.AI_CHAT,
								"AI chat with Claude and GPT, including query, manipulation, and planning modes, requires Prisma Calendar Pro."
							),
			},
		];

		this.navigation = new SettingsNavigation({
			cssPrefix: "prisma-",
			sections,
			footerLinks: [
				{ text: "Product Page", href: "https://matejvavroproductivity.com/tools/prisma-calendar/" },
				{ text: "Documentation", href: "https://real1tyy.github.io/Prisma-Calendar/" },
				{ text: "Changelog", href: "https://real1tyy.github.io/Prisma-Calendar/changelog" },
				{ text: "Gallery", href: "https://real1tyy.github.io/Prisma-Calendar/gallery" },
				{ text: "Other Plugins", href: "https://matejvavroproductivity.com/tools/" },
				{ text: "Support", href: "https://matejvavroproductivity.com/support/" },
				{ text: "Playlist", href: "https://www.youtube.com/playlist?list=PLMVJknbUasLCULubO4MdCDvg9MyXu3kG4" },
			],
		});
	}

	display(containerEl: HTMLElement): void {
		this.navigation.display(containerEl);
	}
}
