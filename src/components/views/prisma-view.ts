import {
	createPageHeader,
	createTabbedContainer,
	type PageHeaderHandle,
	registerComponentView,
	registerPageHeaderCommands,
	registerTabCommands,
	type TabbedContainerHandle,
	type TabEntry,
	type ViewActivator,
} from "@real1ty-obsidian-plugins";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type CustomCalendarPlugin from "../../main";
import { CalendarComponent } from "../calendar-view";
import { type CapacityIndicatorHandle, createCapacityIndicator } from "../capacity-indicator";
import { createDailyStatsTabDefinition } from "./daily-stats-tab";
import { createDashboardTabDefinition } from "./dashboard-tab";
import { createDualDailyTabDefinition } from "./dual-daily-tab";
import { createHeatmapTabDefinition } from "./heatmap-tab";
import { buildPageHeaderActions, DEFAULT_ACTION_IDS } from "./page-header-actions";
import { createTimelineTabDefinition } from "./timeline-tab";

export interface PrismaViewRef {
	calendarComponent: CalendarComponent | null;
	tabbedHandle: TabbedContainerHandle | null;
	pageHeaderHandle: PageHeaderHandle | null;
	capacityIndicatorHandle: CapacityIndicatorHandle | null;
}

export function registerPrismaCalendarView(
	plugin: CustomCalendarPlugin,
	bundle: CalendarBundle,
	ref: PrismaViewRef
): ViewActivator {
	return registerComponentView(plugin, {
		viewType: bundle.viewType,
		displayText: bundle.settingsStore.currentSettings.name,
		icon: "calendar",
		cls: "prisma-calendar-view-root",
		render: (el, ctx) => {
			const app = ctx.app;
			const leaf = ctx.type === "view" ? ctx.leaf : undefined;
			const headerEl = ctx.type === "view" ? ctx.headerEl : undefined;
			const titleContainer = headerEl?.querySelector(".view-header-title-container") ?? undefined;
			const hostEl = leaf ? (leaf as unknown as { containerEl: HTMLElement }).containerEl : el;

			const calendarTab = {
				id: "calendar",
				label: "Calendar",
				render: (tabEl: HTMLElement) => {
					ref.calendarComponent = new CalendarComponent(app, bundle, tabEl, hostEl, leaf!);
					ref.calendarComponent.load();
				},
				cleanup: () => {
					ref.calendarComponent?.unload();
					ref.calendarComponent = null;
				},
			};

			const timelineTab = createTimelineTabDefinition(app, bundle);
			const heatmapTab = createHeatmapTabDefinition(app, bundle);
			const dailyStatsTab = createDailyStatsTabDefinition(app, bundle);
			const dualDailyTab = createDualDailyTabDefinition(app, bundle);
			const dashboardTab = createDashboardTabDefinition(app, bundle);

			const tabs: TabEntry[] = [calendarTab, timelineTab, heatmapTab, dailyStatsTab, dualDailyTab, dashboardTab];

			ref.tabbedHandle = createTabbedContainer(el, {
				tabs,
				cssPrefix: "prisma-",
				...(headerEl ? { tabBarContainer: headerEl } : {}),
				...(titleContainer ? { tabBarInsertBefore: titleContainer } : {}),
				editable: true,
				app,
				...(bundle.settingsStore.currentSettings.activeTab
					? { initialState: bundle.settingsStore.currentSettings.activeTab }
					: {}),
				onStateChange: (state) => {
					void bundle.settingsStore.updateSettings((s) => ({ ...s, activeTab: state }));
				},
			});

			registerTabCommands(
				plugin,
				"prisma-calendar",
				"Prisma Calendar",
				ref.tabbedHandle,
				tabs.map((t) => t.label)
			);

			if (titleContainer) {
				ref.capacityIndicatorHandle = createCapacityIndicator(titleContainer as HTMLElement, bundle);
			}

			const savedHeaderState = bundle.settingsStore.currentSettings.pageHeaderState;
			ref.pageHeaderHandle = createPageHeader({
				actions: buildPageHeaderActions(app),
				cssPrefix: "prisma-",
				app,
				editable: true,
				initialState: savedHeaderState ?? { visibleActionIds: [...DEFAULT_ACTION_IDS] },
				onStateChange: (state) => {
					void bundle.settingsStore.updateSettings((s) => ({ ...s, pageHeaderState: state }));
				},
			});

			if (ctx.type === "view" && ctx.leaf) {
				ref.pageHeaderHandle.apply(ctx.leaf);
			}

			registerPageHeaderCommands(plugin, "prisma-calendar", "Prisma Calendar", ref.pageHeaderHandle);
		},
		cleanup: () => {
			ref.calendarComponent?.unload();
			ref.calendarComponent = null;
			ref.capacityIndicatorHandle?.destroy();
			ref.capacityIndicatorHandle = null;
			ref.pageHeaderHandle?.destroy();
			ref.pageHeaderHandle = null;
			ref.tabbedHandle?.destroy();
			ref.tabbedHandle = null;
		},
	});
}
