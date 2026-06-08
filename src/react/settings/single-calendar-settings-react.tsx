import { buildUtmUrl } from "@real1ty-obsidian-plugins";
import { SettingsNav, type SettingsFooterLink } from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useDeferredValue, useState } from "react";

import { cls, docsUrl } from "../../constants";
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
import { NormalizationConflictBanner } from "./normalization-conflict-banner";
import { NotificationsSettingsReact } from "./notifications-settings";
import { PerformanceSettingsReact } from "./performance-settings";
import { ProUpgradeBanner } from "./pro-upgrade-banner";
import { PropertiesSettingsReact } from "./properties-settings";
import { RulesSettingsReact } from "./rules-settings";
import { SETTINGS_TAB_DEFINITIONS } from "./tabs";

const settingsLink = (url: string, content: string): string =>
	buildUtmUrl(url, "prisma-calendar", "plugin", "settings", content);

const FOOTER_LINKS: SettingsFooterLink[] = [
	{
		text: "Product Page",
		href: settingsLink("https://matejvavroproductivity.com/tools/prisma-calendar/", "product_page"),
	},
	{
		text: "Documentation",
		href: settingsLink(docsUrl("/"), "documentation"),
	},
	{
		text: "Changelog",
		href: settingsLink(docsUrl("/changelog"), "changelog"),
	},
	{
		text: "Gallery",
		href: settingsLink(docsUrl("/gallery"), "gallery"),
	},
	{
		text: "Free vs Pro",
		href: settingsLink(docsUrl("/features/free-vs-pro"), "free_vs_pro"),
	},
	{
		text: "Other Plugins",
		href: settingsLink("https://matejvavroproductivity.com/tools/", "other_plugins"),
	},
	{
		text: "Support",
		href: settingsLink("https://matejvavroproductivity.com/support/", "support"),
	},
	{
		text: "Playlist",
		href: settingsLink("https://www.youtube.com/playlist?list=PLMVJknbUasLCULubO4MdCDvg9MyXu3kG4", "youtube"),
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
	const [activeTab, setActiveTabRaw] = useState(() =>
		initialTab !== "general" ? initialTab : plugin.settingsSessionState.tab
	);
	const [searchQuery, setSearchQuery] = useState("");
	const deferredSearchQuery = useDeferredValue(searchQuery);

	const setActiveTab = useCallback(
		(tab: string) => {
			setActiveTabRaw(tab);
			plugin.settingsSessionState.tab = tab;
		},
		[plugin]
	);

	const isSearching = deferredSearchQuery.trim().length >= 2;

	return (
		<div className={cls("settings-calendar")}>
			<NormalizationConflictBanner calendarId={settingsStore.calendarId} mainSettingsStore={mainSettingsStore} />
			<SettingsNav
				tabs={SETTINGS_TAB_DEFINITIONS}
				activeId={activeTab}
				onChange={setActiveTab}
				searchValue={searchQuery}
				onSearchChange={setSearchQuery}
				footerLinks={FOOTER_LINKS}
			>
				<div className={cls("settings-tab-content")}>
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
		<div className={cls("settings-search-results")}>
			{SETTINGS_TAB_DEFINITIONS.map((tab) => (
				<div key={tab.id} className={cls("settings-search-section")}>
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
