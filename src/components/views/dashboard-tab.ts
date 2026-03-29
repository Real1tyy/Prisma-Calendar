import {
	createGridLayout,
	type GridLayoutHandle,
	type GroupTabDefinition,
	type TabDefinition,
} from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { debounceTime, distinctUntilChanged, merge, skip, type Subscription } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { PRO_FEATURES } from "../../core/license";
import { formatRecurrenceLabel, isPresetType } from "../../types/recurring-event";
import type { ChartDataItem } from "../../utils/chart-utils";
import { removeZettelId } from "../../utils/event-naming";
import { getCategoriesFromFilePath } from "../../utils/obsidian";
import { EventSeriesModal } from "../list-modals/event-series-modal";
import { renderProUpgradeBanner } from "../settings/pro-upgrade-banner";
import {
	buildChartDataFromItems,
	type ColumnDef,
	type DashboardChartHandle,
	type DashboardItem,
	type DashboardTableHandle,
	renderDashboardChart,
	renderDashboardRanking,
	renderDashboardTable,
	type StatEntry,
} from "./dashboard-section";

const DASHBOARD_CSS_PREFIX = "prisma-dashboard-";
const REFRESH_DEBOUNCE_MS = 300;
const TOOLTIP_FORMATTER = (label: string, value: number, percentage: string): string =>
	`${label}: ${value} event${value === 1 ? "" : "s"} (${percentage}%)`;

interface DashboardGridState {
	gridHandle: GridLayoutHandle | null;
	chartHandle: DashboardChartHandle | null;
	tableHandle: DashboardTableHandle | null;
	subscriptions: Subscription[];
}

function createDashboardChild(
	id: string,
	label: string,
	bundle: CalendarBundle,
	buildData: () => {
		items: DashboardItem[];
		columns: ColumnDef[];
		chartData: ChartDataItem[];
		stats: StatEntry[];
		onItemClick?: (item: DashboardItem) => void;
		emptyMessage: string;
	}
): TabDefinition {
	const state: DashboardGridState = {
		gridHandle: null,
		chartHandle: null,
		tableHandle: null,
		subscriptions: [],
	};

	function renderContent(el: HTMLElement): void {
		const data = buildData();

		state.gridHandle = createGridLayout(el, {
			cssPrefix: DASHBOARD_CSS_PREFIX,
			columns: 2,
			rows: 2,
			gap: "12px",
			dividers: true,
			resizable: "track",
			initialState: {
				columns: 2,
				rows: 2,
				cells: [],
				rowSizes: [0.25, 1],
				columnSizes: undefined,
				cellColumnSizes: undefined,
				cellRowSizes: undefined,
			},
			cells: [
				{
					id: "chart",
					label: "Chart",
					row: 0,
					col: 0,
					render: (cellEl) => {
						state.chartHandle = renderDashboardChart(cellEl, data.chartData, id, TOOLTIP_FORMATTER);
					},
					cleanup: () => {
						state.chartHandle?.destroy();
						state.chartHandle = null;
					},
				},
				{
					id: "ranking",
					label: "Top Items",
					row: 0,
					col: 1,
					render: (cellEl) => {
						renderDashboardRanking(cellEl, data.items, data.stats);
					},
				},
				{
					id: "table",
					label: "Table",
					row: 1,
					col: 0,
					colSpan: 2,
					render: (cellEl) => {
						state.tableHandle = renderDashboardTable(cellEl, {
							items: data.items,
							columns: data.columns,
							...(data.onItemClick ? { onItemClick: data.onItemClick } : {}),
							emptyMessage: data.emptyMessage,
						});
					},
					cleanup: () => {
						state.tableHandle?.destroy();
						state.tableHandle = null;
					},
				},
			],
		});
	}

	function doRender(el: HTMLElement): void {
		state.chartHandle?.destroy();
		state.tableHandle?.destroy();
		state.gridHandle?.destroy();
		state.gridHandle = null;
		el.empty();
		renderContent(el);
	}

	let isProSub: Subscription | null = null;

	function cleanupContent(): void {
		state.chartHandle?.destroy();
		state.tableHandle?.destroy();
		state.gridHandle?.destroy();
		state.gridHandle = null;
		for (const sub of state.subscriptions) sub.unsubscribe();
		state.subscriptions = [];
	}

	return {
		id,
		label,
		render: (el) => {
			function renderTab(): void {
				cleanupContent();
				el.empty();

				if (!bundle.plugin.licenseManager.isPro) {
					renderProUpgradeBanner(
						el,
						PRO_FEATURES.DASHBOARD,
						"Get a comprehensive overview of your calendar with charts, rankings, and key statistics — all in one place. Organized by name, category and recurring event series. ",
						"DASHBOARD"
					);
					return;
				}

				renderContent(el);

				state.subscriptions = [
					merge(bundle.categoryTracker.categories$, bundle.eventStore.changes$, bundle.recurringEventManager.changes$)
						.pipe(debounceTime(REFRESH_DEBOUNCE_MS))
						.subscribe(() => doRender(el)),
				];
			}

			renderTab();

			isProSub = bundle.plugin.licenseManager.isPro$.pipe(skip(1), distinctUntilChanged()).subscribe(() => renderTab());
		},
		cleanup: () => {
			isProSub?.unsubscribe();
			isProSub = null;
			cleanupContent();
		},
	};
}

function buildByNameData(app: App, bundle: CalendarBundle) {
	return () => {
		const nameSeries = bundle.nameSeriesTracker.getNameBasedSeries();

		const items: DashboardItem[] = Array.from(nameSeries.entries()).map(([nameKey, files]) => ({
			key: nameKey,
			title: nameKey.charAt(0).toUpperCase() + nameKey.slice(1),
			count: files.size,
			extraProps: {},
		}));

		const totalEvents = items.reduce((sum, i) => sum + i.count, 0);

		return {
			items,
			columns: [
				{ key: "title", label: "Name" },
				{ key: "count", label: "Events", align: "center" as const },
			],
			chartData: buildChartDataFromItems(items),
			stats: [
				{ label: "Series", value: items.length },
				{ label: "Total Events", value: totalEvents },
				{ label: "Avg / Series", value: items.length > 0 ? Math.round(totalEvents / items.length) : 0 },
			],
			onItemClick: (item: DashboardItem) => {
				new EventSeriesModal(app, bundle, item.key, null).open();
			},
			emptyMessage: "No name-based series found.",
		};
	};
}

function buildByCategoryData(app: App, bundle: CalendarBundle) {
	return () => {
		const categories = bundle.categoryTracker.getCategories();

		const items: DashboardItem[] = categories.map((categoryName) => {
			const stats = bundle.categoryTracker.getCategoryStats(categoryName);
			const color = bundle.categoryTracker.getCategoryColor(categoryName);
			const total = stats.total;
			const timedPct = total > 0 ? `${((stats.timed / total) * 100).toFixed(0)}%` : "0%";
			const allDayPct = total > 0 ? `${((stats.allDay / total) * 100).toFixed(0)}%` : "0%";

			return {
				key: categoryName,
				title: categoryName,
				count: total,
				color,
				extraProps: { timed: stats.timed, timedPct, allDay: stats.allDay, allDayPct },
			};
		});

		const totalEvents = items.reduce((sum, i) => sum + i.count, 0);
		const totalTimed = items.reduce((sum, i) => sum + (i.extraProps["timed"] as number), 0);
		const totalAllDay = items.reduce((sum, i) => sum + (i.extraProps["allDay"] as number), 0);

		return {
			items,
			columns: [
				{ key: "title", label: "Category" },
				{ key: "count", label: "Total", align: "center" as const },
				{ key: "timed", label: "Timed", align: "center" as const },
				{ key: "timedPct", label: "Timed %", align: "center" as const },
				{ key: "allDay", label: "All-day", align: "center" as const },
				{ key: "allDayPct", label: "All-day %", align: "center" as const },
			],
			chartData: buildChartDataFromItems(items),
			stats: [
				{ label: "Categories", value: items.length },
				{ label: "Total Events", value: totalEvents },
				{ label: "Timed", value: totalTimed },
				{ label: "All-day", value: totalAllDay },
			],
			onItemClick: (item: DashboardItem) => {
				new EventSeriesModal(app, bundle, null, null, [item.key]).open();
			},
			emptyMessage: "No categories found. Add a category property to your events.",
		};
	};
}

function buildRecurringData(app: App, bundle: CalendarBundle) {
	return () => {
		const allRecurring = bundle.recurringEventManager.getAllRecurringEvents();
		const settings = bundle.settingsStore.currentSettings;

		const items: DashboardItem[] = allRecurring.map((event) => {
			const displayTitle = removeZettelId(event.title);
			const categories = getCategoriesFromFilePath(app, event.sourceFilePath, settings.categoryProp);
			const instanceCount = bundle.recurringEventManager.getInstanceCountByRRuleId(event.rRuleId);
			const categoryColor = categories.length > 0 ? bundle.categoryTracker.getCategoryColor(categories[0]) : undefined;
			const recurrenceType = event.rrules.type;
			const badgeLabel = formatRecurrenceLabel(recurrenceType);
			const isDisabled = !!event.metadata.skip;

			return {
				key: event.rRuleId,
				title: displayTitle,
				count: instanceCount,
				...(categoryColor ? { color: categoryColor } : {}),
				extraProps: {
					type: badgeLabel,
					typeSort: isPresetType(recurrenceType) ? recurrenceType : "custom",
					category: categories.join(", ") || "\u2014",
					status: isDisabled ? "Disabled" : "Enabled",
				},
			};
		});

		const typeCounts = new Map<string, number>();
		for (const event of allRecurring) {
			const label = formatRecurrenceLabel(event.rrules.type);
			typeCounts.set(label, (typeCounts.get(label) ?? 0) + 1);
		}
		const chartData = buildChartDataFromItems(
			Array.from(typeCounts.entries()).map(([label, count]) => ({
				key: label,
				title: label,
				count,
				extraProps: {},
			}))
		);

		const enabledCount = allRecurring.filter((e) => !e.metadata.skip).length;
		const totalInstances = items.reduce((sum, i) => sum + i.count, 0);

		return {
			items,
			columns: [
				{ key: "title", label: "Name" },
				{ key: "type", label: "Type" },
				{ key: "count", label: "Instances", align: "center" as const },
				{ key: "category", label: "Category" },
				{ key: "status", label: "Status", align: "center" as const },
			],
			chartData,
			stats: [
				{ label: "Rules", value: allRecurring.length },
				{ label: "Enabled", value: enabledCount },
				{ label: "Disabled", value: allRecurring.length - enabledCount },
				{ label: "Instances", value: totalInstances },
			],
			onItemClick: (item: DashboardItem) => {
				new EventSeriesModal(app, bundle, item.title.toLowerCase(), item.key).open();
			},
			emptyMessage: "No recurring events found.",
		};
	};
}

export function createDashboardTabDefinition(app: App, bundle: CalendarBundle): GroupTabDefinition {
	return {
		id: "dashboard",
		label: "Dashboard",
		children: [
			createDashboardChild("dashboard-by-name", "By Name", bundle, buildByNameData(app, bundle)),
			createDashboardChild("dashboard-by-category", "By Category", bundle, buildByCategoryData(app, bundle)),
			createDashboardChild("dashboard-recurring", "Recurring", bundle, buildRecurringData(app, bundle)),
		],
	};
}
