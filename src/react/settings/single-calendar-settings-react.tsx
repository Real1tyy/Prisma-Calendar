import { buildUtmUrl } from "@real1ty-obsidian-plugins";
import { type SettingsFooterLink, SettingsNav } from "@real1ty-obsidian-plugins-react";
import { memo, useState } from "react";

import { PRO_FEATURES } from "../../core/license";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import type { PrismaCalendarSettingsStore } from "../../types";
import { AISettingsReact } from "./ai-settings";
import { BasesSettingsReact } from "./bases-settings";
import { CalendarSettingsReact } from "./calendar-settings";
import { CategoriesSettingsReact } from "./categories-settings";
import { ConfigurationSettingsReact } from "./configuration-settings";
import { EventGroupsSettingsReact } from "./event-groups-settings";
import { GeneralSettingsReact } from "./general-settings";
import { IntegrationsSettingsReact } from "./integrations-settings";
import { NotificationsSettingsReact } from "./notifications-settings";
import { PerformanceSettingsReact } from "./performance-settings";
import { ProUpgradeBanner } from "./pro-upgrade-banner";
import { PropertiesSettingsReact } from "./properties-settings";
import { RulesSettingsReact } from "./rules-settings";
import { SETTINGS_TAB_DEFINITIONS } from "./tabs";

const FOOTER_LINKS: SettingsFooterLink[] = [
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
];

interface SingleCalendarSettingsReactProps {
	settingsStore: CalendarSettingsStore;
	plugin: CustomCalendarPlugin;
	mainSettingsStore: PrismaCalendarSettingsStore;
	initialTab?: string;
}

export const SingleCalendarSettingsReact = memo(function SingleCalendarSettingsReact({
	settingsStore,
	plugin,
	mainSettingsStore,
	initialTab = "general",
}: SingleCalendarSettingsReactProps) {
	const [activeTab, setActiveTab] = useState(initialTab);
	const [searchQuery, setSearchQuery] = useState("");

	const isSearching = searchQuery.trim().length >= 2;

	return (
		<div className="prisma-settings-calendar">
			<SettingsNav
				tabs={SETTINGS_TAB_DEFINITIONS}
				activeId={activeTab}
				onChange={setActiveTab}
				searchValue={searchQuery}
				onSearchChange={setSearchQuery}
				footerLinks={FOOTER_LINKS}
				cssPrefix="prisma-"
			>
				<div className="prisma-settings-tab-content">
					{isSearching ? (
						<SearchResults settingsStore={settingsStore} plugin={plugin} mainSettingsStore={mainSettingsStore} />
					) : (
						<TabContent
							tabId={activeTab}
							settingsStore={settingsStore}
							plugin={plugin}
							mainSettingsStore={mainSettingsStore}
						/>
					)}
				</div>
			</SettingsNav>
		</div>
	);
});

// ─── Tab Content ────────────────────────────────────────────────────────

interface TabContentProps {
	tabId: string;
	settingsStore: CalendarSettingsStore;
	plugin: CustomCalendarPlugin;
	mainSettingsStore: PrismaCalendarSettingsStore;
}

const TabContent = memo(function TabContent({ tabId, settingsStore, plugin, mainSettingsStore }: TabContentProps) {
	switch (tabId) {
		case "general":
			return <GeneralSettingsReact settingsStore={settingsStore} plugin={plugin} />;
		case "properties":
			return <PropertiesSettingsReact settingsStore={settingsStore} />;
		case "calendar":
			return <CalendarSettingsReact settingsStore={settingsStore} />;
		case "event-groups":
			return <EventGroupsSettingsReact settingsStore={settingsStore} />;
		case "configuration":
			return <ConfigurationSettingsReact settingsStore={settingsStore} />;
		case "performance":
			return <PerformanceSettingsReact settingsStore={settingsStore} />;
		case "notifications":
			return <NotificationsSettingsReact settingsStore={settingsStore} />;
		case "rules":
			return <RulesSettingsReact settingsStore={settingsStore} />;
		case "categories":
			return <CategoriesSettingsReact settingsStore={settingsStore} plugin={plugin} />;
		case "bases":
			return <BasesSettingsReact settingsStore={settingsStore} />;
		case "integrations":
			return (
				<IntegrationsSettingsReact
					settingsStore={settingsStore}
					plugin={plugin}
					mainSettingsStore={mainSettingsStore}
				/>
			);
		case "ai":
			return plugin.isProEnabled ? (
				<AISettingsReact mainSettingsStore={mainSettingsStore} />
			) : (
				<ProUpgradeBanner
					featureName={PRO_FEATURES.AI_CHAT}
					description="AI chat with Claude and GPT, including query, manipulation, and planning modes, requires Prisma Calendar Pro."
					previewKey="AI_CHAT"
				/>
			);
		default:
			return null;
	}
});

// ─── Search Results ─────────────────────────────────────────────────────

interface SearchResultsProps {
	settingsStore: CalendarSettingsStore;
	plugin: CustomCalendarPlugin;
	mainSettingsStore: PrismaCalendarSettingsStore;
}

const SearchResults = memo(function SearchResults({ settingsStore, plugin, mainSettingsStore }: SearchResultsProps) {
	return (
		<div className="prisma-settings-search-results">
			{SETTINGS_TAB_DEFINITIONS.map((tab) => (
				<div key={tab.id} className="prisma-settings-search-section">
					<TabContent
						tabId={tab.id}
						settingsStore={settingsStore}
						plugin={plugin}
						mainSettingsStore={mainSettingsStore}
					/>
				</div>
			))}
		</div>
	);
});
