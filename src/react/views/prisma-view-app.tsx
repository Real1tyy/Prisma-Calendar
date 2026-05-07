import {
	createPageHeader,
	createTabbedContainer,
	type PageHeaderHandle,
	registerPageHeaderCommands,
	registerTabCommands,
	type TabbedContainerHandle,
	type TabbedContainerState,
	type TabDefinition,
	type TabEntry,
} from "@real1ty-obsidian-plugins";
import { renderReactInline, useApp } from "@real1ty-obsidian-plugins-react";
import type { App, WorkspaceLeaf } from "obsidian";
import { createElement, memo, type RefObject, useEffect, useRef } from "react";

import { CalendarComponent } from "../../components/calendar-view";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type CustomCalendarPlugin from "../../main";
import { getLeafContainerEl } from "../../utils/obsidian";
import { CapacityIndicator, type CapacityIndicatorHandle } from "./capacity-indicator";
import { DailyStatsTab, type DailyStatsTabHandle } from "./daily-stats-tab";
import { buildDashboardChildren } from "./dashboard-tab";
import { DualDailyTab, type DualDailyTabHandle } from "./dual-daily-tab";
import { GanttTab } from "./gantt-tab";
import { HeatmapMonthlyStatsTab, type HeatmapMonthlyStatsTabHandle } from "./heatmap-monthly-stats-tab";
import { HeatmapTab, type HeatmapTabHandle } from "./heatmap-tab";
import { makeReactTab } from "./make-react-tab";
import { MonthlyCalendarStatsTab, type MonthlyCalendarStatsTabHandle } from "./monthly-calendar-stats-tab";
import { DEFAULT_ORDERED_ACTION_IDS, PageHeaderActions, PRISMA_HEADER_TOOLBAR_ACTIONS } from "./page-header-actions";
import { TimelineTab } from "./timeline-tab";

const DEFAULT_VISIBLE_TAB_IDS: readonly string[] = [
	"calendar",
	"timeline",
	"heatmap",
	"gantt",
	"daily-stats",
	"monthly-calendar-stats",
	"dual-daily",
	"dashboard",
];

export interface PrismaViewRef {
	calendarComponent: CalendarComponent | null;
	tabbedHandle: TabbedContainerHandle | null;
	pageHeaderHandle: PageHeaderHandle | null;
	capacityIndicatorHandle: CapacityIndicatorHandle | null;
	viewConfig: { displayText: string } | null;
}

interface PrismaViewAppProps {
	plugin: CustomCalendarPlugin;
	bundle: CalendarBundle;
	leaf: WorkspaceLeaf;
	headerEl: HTMLElement;
	el: HTMLElement;
	viewRef: PrismaViewRef;
}

type ArrowKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

/** Forwards arrow keys to a ref-held handle's methods. Skips undefined entries. */
function arrowKeyHandlers<H>(
	ref: RefObject<H | null>,
	kinds: Partial<Record<ArrowKey, (handle: H) => void>>
): NonNullable<TabDefinition["keyHandlers"]> {
	const out: Record<string, (e: KeyboardEvent) => void> = {};
	for (const key of Object.keys(kinds) as ArrowKey[]) {
		const fn = kinds[key];
		if (!fn) continue;
		out[key] = () => {
			const handle = ref.current;
			if (handle) fn(handle);
		};
	}
	return out;
}

interface TabHandleRefs {
	heatmap: RefObject<HeatmapTabHandle | null>;
	heatmapMonthly: RefObject<HeatmapMonthlyStatsTabHandle | null>;
	dailyStats: RefObject<DailyStatsTabHandle | null>;
	monthlyStats: RefObject<MonthlyCalendarStatsTabHandle | null>;
	dualDaily: RefObject<DualDailyTabHandle | null>;
}

function buildTabs(
	app: App,
	bundle: CalendarBundle,
	leaf: WorkspaceLeaf,
	viewRef: PrismaViewRef,
	refs: TabHandleRefs
): TabEntry[] {
	const hostEl = getLeafContainerEl(leaf);

	const calendarTab: TabDefinition = {
		id: "calendar",
		label: "Calendar",
		icon: "calendar",
		render: (tabEl) => {
			viewRef.calendarComponent = new CalendarComponent(app, bundle, tabEl, hostEl, leaf);
			viewRef.calendarComponent.load();
		},
		cleanup: () => {
			viewRef.calendarComponent?.unload();
			viewRef.calendarComponent = null;
		},
	};

	const dashboardChildren = buildDashboardChildren(app, bundle).map(
		(child): TabDefinition =>
			makeReactTab(app, {
				id: child.id,
				label: child.label,
				testId: `prisma-${child.id}`,
				render: () => child.component(),
			})
	);

	return [
		calendarTab,
		makeReactTab(app, {
			id: "timeline",
			label: "Timeline",
			icon: "clock",
			testId: "prisma-timeline-tab",
			render: () => createElement(TimelineTab, { app, bundle }),
		}),
		makeReactTab(app, {
			id: "heatmap",
			label: "Heatmap",
			icon: "flame",
			testId: "prisma-heatmap-tab",
			keyHandlers: arrowKeyHandlers(refs.heatmap, {
				ArrowLeft: (h) => h.handleArrow("left"),
				ArrowRight: (h) => h.handleArrow("right"),
				ArrowUp: (h) => h.handleArrow("up"),
				ArrowDown: (h) => h.handleArrow("down"),
			}),
			render: () => createElement(HeatmapTab, { app, bundle, handleRef: refs.heatmap }),
		}),
		makeReactTab(app, {
			id: "gantt",
			label: "Gantt",
			icon: "gantt-chart",
			testId: "prisma-gantt-tab",
			render: () => createElement(GanttTab, { app, bundle }),
		}),
		makeReactTab(app, {
			id: "daily-stats",
			label: "Daily + Stats",
			icon: "bar-chart-3",
			testId: "prisma-daily-stats-tab",
			keyHandlers: arrowKeyHandlers(refs.dailyStats, {
				ArrowLeft: (h) => h.prev(),
				ArrowRight: (h) => h.next(),
			}),
			render: () => createElement(DailyStatsTab, { app, bundle, handleRef: refs.dailyStats }),
		}),
		makeReactTab(app, {
			id: "monthly-calendar-stats",
			label: "Monthly + Stats",
			icon: "calendar-range",
			testId: "prisma-monthly-calendar-stats-tab",
			keyHandlers: arrowKeyHandlers(refs.monthlyStats, {
				ArrowLeft: (h) => h.prev(),
				ArrowRight: (h) => h.next(),
			}),
			render: () => createElement(MonthlyCalendarStatsTab, { app, bundle, handleRef: refs.monthlyStats }),
		}),
		makeReactTab(app, {
			id: "dual-daily",
			label: "Dual Daily",
			icon: "columns-2",
			testId: "prisma-dual-daily",
			keyHandlers: arrowKeyHandlers(refs.dualDaily, {
				ArrowLeft: (h) => h.prev(),
				ArrowRight: (h) => h.next(),
			}),
			render: () => createElement(DualDailyTab, { app, bundle, handleRef: refs.dualDaily }),
		}),
		{
			id: "dashboard",
			label: "Dashboard",
			icon: "layout-dashboard",
			children: dashboardChildren,
		},
		makeReactTab(app, {
			id: "heatmap-monthly-stats",
			label: "Heatmap Monthly + Stats",
			icon: "flame",
			testId: "prisma-heatmap-monthly-stats-tab",
			keyHandlers: arrowKeyHandlers(refs.heatmapMonthly, {
				ArrowLeft: (h) => h.handleArrow("left"),
				ArrowRight: (h) => h.handleArrow("right"),
				ArrowUp: (h) => h.handleArrow("up"),
				ArrowDown: (h) => h.handleArrow("down"),
			}),
			render: () => createElement(HeatmapMonthlyStatsTab, { app, bundle, handleRef: refs.heatmapMonthly }),
		}),
	];
}

interface SetupTabbedContainerCtx {
	el: HTMLElement;
	headerEl: HTMLElement;
	titleContainer: HTMLElement | null;
	plugin: CustomCalendarPlugin;
	app: App;
	bundle: CalendarBundle;
	leaf: WorkspaceLeaf;
	viewRef: PrismaViewRef;
	refs: TabHandleRefs;
}

function setupTabbedContainer({
	el,
	headerEl,
	titleContainer,
	plugin,
	app,
	bundle,
	leaf,
	viewRef,
	refs,
}: SetupTabbedContainerCtx): () => void {
	const tabs = buildTabs(app, bundle, leaf, viewRef, refs);
	const savedState = bundle.settingsStore.currentSettings.activeTab;
	const defaultState: TabbedContainerState = { visibleTabIds: [...DEFAULT_VISIBLE_TAB_IDS] };

	const handle = createTabbedContainer(el, {
		tabs,
		cssPrefix: "prisma-",
		tabBarContainer: headerEl,
		...(titleContainer ? { tabBarInsertBefore: titleContainer } : {}),
		editable: true,
		app,
		initialState: savedState ?? defaultState,
		onStateChange: (state) => {
			void bundle.settingsStore.updateSettings((s) => ({ ...s, activeTab: state }));
			tabCommandUpdater.updateLabels(handle.getVisibleLabels());
		},
	});
	viewRef.tabbedHandle = handle;

	const tabCommandUpdater = registerTabCommands(
		plugin,
		"prisma-calendar",
		"Prisma Calendar",
		handle,
		tabs.map((t) => t.label)
	);

	return () => handle.destroy();
}

function setupCapacityIndicator(
	titleContainer: HTMLElement,
	app: App,
	bundle: CalendarBundle,
	viewRef: PrismaViewRef
): () => void {
	const host = titleContainer.createDiv("prisma-capacity-indicator-host");
	const unmount = renderReactInline(
		host,
		createElement(CapacityIndicator, {
			bundle,
			ref: (handle: CapacityIndicatorHandle | null) => {
				viewRef.capacityIndicatorHandle = handle;
			},
		}),
		app
	);
	return () => {
		unmount();
		host.remove();
	};
}

function setupPageHeader(
	plugin: CustomCalendarPlugin,
	app: App,
	bundle: CalendarBundle,
	leaf: WorkspaceLeaf,
	viewRef: PrismaViewRef
): () => void {
	const savedState = bundle.settingsStore.currentSettings.pageHeaderState;
	const handle = createPageHeader({
		actions: PRISMA_HEADER_TOOLBAR_ACTIONS,
		cssPrefix: "prisma-",
		app,
		editable: true,
		initialState: savedState ?? { visibleActionIds: DEFAULT_ORDERED_ACTION_IDS },
		onStateChange: (state) => {
			void bundle.settingsStore.updateSettings((s) => ({ ...s, pageHeaderState: state }));
		},
		mountActionBar: ({ host, displayState, executeAction }) =>
			renderReactInline(
				host,
				createElement(PageHeaderActions, {
					visibleActionIds: displayState.orderedIds,
					renames: displayState.renames,
					iconOverrides: displayState.iconOverrides,
					colorOverrides: displayState.colorOverrides,
					executeAction,
					cssPrefix: "prisma-",
				}),
				app
			),
	});
	viewRef.pageHeaderHandle = handle;
	handle.apply(leaf);
	registerPageHeaderCommands(plugin, "prisma-calendar", "Prisma Calendar", handle);
	return () => handle.destroy();
}

export const PrismaViewApp = memo(function PrismaViewApp({
	plugin,
	bundle,
	leaf,
	headerEl,
	el,
	viewRef,
}: PrismaViewAppProps) {
	const app = useApp();
	const heatmapRef = useRef<HeatmapTabHandle>(null);
	const heatmapMonthlyRef = useRef<HeatmapMonthlyStatsTabHandle>(null);
	const dailyStatsRef = useRef<DailyStatsTabHandle>(null);
	const monthlyStatsRef = useRef<MonthlyCalendarStatsTabHandle>(null);
	const dualDailyRef = useRef<DualDailyTabHandle>(null);

	useEffect(() => {
		const titleContainer = (headerEl.querySelector(".view-header-title-container") as HTMLElement | null) ?? null;
		const refs: TabHandleRefs = {
			heatmap: heatmapRef,
			heatmapMonthly: heatmapMonthlyRef,
			dailyStats: dailyStatsRef,
			monthlyStats: monthlyStatsRef,
			dualDaily: dualDailyRef,
		};

		const teardownTabs = setupTabbedContainer({
			el,
			headerEl,
			titleContainer,
			plugin,
			app,
			bundle,
			leaf,
			viewRef,
			refs,
		});
		const teardownCapacity = titleContainer ? setupCapacityIndicator(titleContainer, app, bundle, viewRef) : null;
		const teardownPageHeader = setupPageHeader(plugin, app, bundle, leaf, viewRef);

		return () => {
			viewRef.calendarComponent?.unload();
			viewRef.calendarComponent = null;
			teardownCapacity?.();
			viewRef.capacityIndicatorHandle = null;
			teardownPageHeader();
			viewRef.pageHeaderHandle = null;
			teardownTabs();
			viewRef.tabbedHandle = null;
		};
	}, [el, headerEl, plugin, app, bundle, leaf, viewRef]);

	return null;
});
