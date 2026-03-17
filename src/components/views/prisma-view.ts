import {
	createTabbedContainer,
	registerComponentView,
	registerTabCommands,
	type TabbedContainerHandle,
	type ViewActivator,
} from "@real1ty-obsidian-plugins";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type CustomCalendarPlugin from "../../main";
import { CalendarComponent } from "../calendar-view";
import { createDailyStatsTabDefinition } from "./daily-stats-tab";
import { createDualDailyTabDefinition } from "./dual-daily-tab";
import { createHeatmapTabDefinition } from "./heatmap-tab";
import { createTimelineTabDefinition } from "./timeline-tab";

export interface PrismaViewRef {
	calendarComponent: CalendarComponent | null;
	tabbedHandle: TabbedContainerHandle | null;
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

			const tabs = [calendarTab, timelineTab, heatmapTab, dailyStatsTab, dualDailyTab];

			ref.tabbedHandle = createTabbedContainer(el, {
				tabs,
				cssPrefix: "prisma-",
				tabBarContainer: headerEl,
				tabBarInsertBefore: titleContainer,
				editable: true,
				app,
				initialState: bundle.settingsStore.currentSettings.activeTab,
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
		},
		cleanup: () => {
			ref.calendarComponent?.unload();
			ref.calendarComponent = null;
			ref.tabbedHandle?.destroy();
			ref.tabbedHandle = null;
		},
	});
}
