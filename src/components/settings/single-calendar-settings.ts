import { buildUtmUrl, SettingsNavigation, type SettingsSection } from "@real1ty-obsidian-plugins";
import { renderReactInline } from "@real1ty-obsidian-plugins/react";
import type { App } from "obsidian";
import { createElement } from "react";

import { PRO_FEATURES } from "../../core/license";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import { BasesSettingsReact } from "../../react/settings/bases-settings";
import { ConfigurationSettingsReact } from "../../react/settings/configuration-settings";
import { GeneralSettingsReact } from "../../react/settings/general-settings";
import { NotificationsSettingsReact } from "../../react/settings/notifications-settings";
import { PerformanceSettingsReact } from "../../react/settings/performance-settings";
import { PropertiesSettingsReact } from "../../react/settings/properties-settings";
import type { PrismaCalendarSettingsStore } from "../../types";
import {
	AISettings,
	CalendarSettings,
	CategoriesSettings,
	EventGroupsSettings,
	IntegrationsSettings,
	RulesSettings,
} from ".";
import { renderProUpgradeBanner } from "./pro-upgrade-banner";

export class SingleCalendarSettings {
	private navigation: SettingsNavigation;

	constructor(
		settingsStore: CalendarSettingsStore,
		app: App,
		plugin: CustomCalendarPlugin,
		mainSettingsStore: PrismaCalendarSettingsStore
	) {
		const settingsInstances = {
			calendar: new CalendarSettings(settingsStore),
			eventGroups: new EventGroupsSettings(settingsStore),
			rules: new RulesSettings(settingsStore),
			categories: new CategoriesSettings(settingsStore, plugin),
			integrations: new IntegrationsSettings(settingsStore, app, plugin, mainSettingsStore),
			ai: new AISettings(plugin, mainSettingsStore),
		};

		const sections: SettingsSection[] = [
			{
				id: "general",
				label: "General",
				display: (el) => {
					renderReactInline(el, createElement(GeneralSettingsReact, { settingsStore, plugin }), app);
				},
			},
			{
				id: "properties",
				label: "Properties",
				display: (el) => {
					renderReactInline(el, createElement(PropertiesSettingsReact, { settingsStore }), app);
				},
			},
			{ id: "calendar", label: "Calendar", display: (el) => settingsInstances.calendar.display(el) },
			{ id: "event-groups", label: "Event Groups", display: (el) => settingsInstances.eventGroups.display(el) },
			{
				id: "configuration",
				label: "Configuration",
				display: (el) => {
					renderReactInline(el, createElement(ConfigurationSettingsReact, { settingsStore }), app);
				},
			},
			{
				id: "performance",
				label: "Performance",
				display: (el) => {
					renderReactInline(el, createElement(PerformanceSettingsReact, { settingsStore }), app);
				},
			},
			{
				id: "notifications",
				label: "Notifications",
				display: (el) => {
					renderReactInline(el, createElement(NotificationsSettingsReact, { settingsStore }), app);
				},
			},
			{ id: "rules", label: "Rules", display: (el) => settingsInstances.rules.display(el) },
			{ id: "categories", label: "Categories", display: (el) => settingsInstances.categories.display(el) },
			{
				id: "bases",
				label: "Bases",
				display: (el) => {
					renderReactInline(el, createElement(BasesSettingsReact, { settingsStore }), app);
				},
			},
			{
				id: "integrations",
				label: "Integrations",
				display: (el) => settingsInstances.integrations.display(el),
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
								"AI chat with Claude and GPT, including query, manipulation, and planning modes, requires Prisma Calendar Pro.",
								"AI_CHAT"
							),
			},
		];

		this.navigation = new SettingsNavigation({
			cssPrefix: "prisma-",
			sections,
			footerLinks: [
				{
					text: "Product Page",
					href: buildUtmUrl(
						"https://matejvavroproductivity.com/tools/prisma-calendar/",
						"prisma-calendar",
						"plugin",
						"settings",
						"product_page"
					),
				},
				{
					text: "Documentation",
					href: buildUtmUrl(
						"https://real1tyy.github.io/Prisma-Calendar/",
						"prisma-calendar",
						"plugin",
						"settings",
						"documentation"
					),
				},
				{
					text: "Changelog",
					href: buildUtmUrl(
						"https://real1tyy.github.io/Prisma-Calendar/changelog",
						"prisma-calendar",
						"plugin",
						"settings",
						"changelog"
					),
				},
				{
					text: "Gallery",
					href: buildUtmUrl(
						"https://real1tyy.github.io/Prisma-Calendar/gallery",
						"prisma-calendar",
						"plugin",
						"settings",
						"gallery"
					),
				},
				{
					text: "Free vs Pro",
					href: buildUtmUrl(
						"https://real1tyy.github.io/Prisma-Calendar/features/free-vs-pro",
						"prisma-calendar",
						"plugin",
						"settings",
						"free_vs_pro"
					),
				},
				{
					text: "Other Plugins",
					href: buildUtmUrl(
						"https://matejvavroproductivity.com/tools/",
						"prisma-calendar",
						"plugin",
						"settings",
						"other_plugins"
					),
				},
				{
					text: "Support",
					href: buildUtmUrl(
						"https://matejvavroproductivity.com/support/",
						"prisma-calendar",
						"plugin",
						"settings",
						"support"
					),
				},
				{
					text: "Playlist",
					href: buildUtmUrl(
						"https://www.youtube.com/playlist?list=PLMVJknbUasLCULubO4MdCDvg9MyXu3kG4",
						"prisma-calendar",
						"plugin",
						"settings",
						"youtube"
					),
				},
			],
		});
	}

	display(containerEl: HTMLElement): void {
		this.navigation.display(containerEl);
	}
}
